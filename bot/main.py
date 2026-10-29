"""
DexScreener Bot — full pipeline

1. Discover candidate tokens (token profiles + recent pairs)
2. Apply filters + blacklists
3. Fake-volume heuristic → blacklist if suspicious
4. RugCheck → only "Good"; blacklist bundles
5. Classify rug / pump, save everything
6. Score the survivors; the Desk (risk engine) decides whether to buy
7. Every cycle: mark open positions, fire stop / trail exits, resolve counterfactuals
"""
from __future__ import annotations

import asyncio
import signal
import sys
import time
from pathlib import Path

from loguru import logger

from bot.analysis import (
    classify_rug_or_pump,
    detect_fake_volume,
    filter_block,
    older_token_signal,
    pair_age_min,
    score_pair,
    top10_pct,
)
from bot.config import load_blacklist, load_config, save_blacklist
from bot.desk import Desk
from bot.dexscreener import DexScreenerClient
from bot.rugcheck import RugCheckClient
from bot.storage import Storage
from bot.telegram_trader import TelegramTrader

ROOT = Path(__file__).resolve().parent.parent


async def get_older_token_profiles(cfg: dict, ds: DexScreenerClient) -> list[dict]:
    older_cfg = cfg.get("older_tokens", {})
    if not older_cfg.get("enabled", True):
        return []
    profiles: list[dict] = []
    if older_cfg.get("scan_latest_boosts", True):
        profiles.extend(await ds.get_latest_token_boosts())
    if older_cfg.get("scan_top_boosts", True):
        profiles.extend(await ds.get_top_token_boosts())
    chain = cfg.get("dexscreener", {}).get("chain", "solana")
    profiles.extend(
        {"chainId": chain, "tokenAddress": mint}
        for mint in older_cfg.get("mints", [])
        if isinstance(mint, str) and mint.strip()
    )
    return profiles


async def process_pair(
    pair: dict,
    cfg: dict,
    coin_bl: set[str],
    dev_bl: set[str],
    ds: DexScreenerClient,
    rc: RugCheckClient,
    store: Storage,
    tg: TelegramTrader,
    desk: Desk,
    older_scan: bool = False,
) -> None:
    # Solana mints are base58 and case-sensitive: API calls and buy commands must use the
    # original string. Only the blacklist key is lowercased (see config.load_blacklist).
    mint = pair.get("mint") or ""
    if not mint:
        return
    key = mint.lower()

    if key in coin_bl:
        logger.debug(f"Skip blacklisted coin {mint}")
        return

    filters = cfg.get("filters", {})
    older_cfg = cfg.get("older_tokens", {})
    skip_age = False
    if older_scan and older_cfg.get("enabled", True):
        lookback_s = float(older_cfg.get("liquidity_lookback_minutes", 60)) * 60
        market_change = await store.record_market_snapshot(
            mint,
            time.time(),
            pair.get("liquidity_usd") or 0.0,
            pair.get("price_usd") or 0.0,
            lookback_s,
        )
        age = pair_age_min(pair)
        if age is None:
            desk.block(
                pair,
                "older_age_unknown",
                "Cannot verify pair age for the older-token scan.",
                outcome="skip",
            )
            return
        if age >= older_cfg.get("min_age_days", 7) * 24 * 60:
            signal = older_token_signal(pair, market_change, older_cfg)
            if signal is None:
                desk.block(
                    pair,
                    "older_no_signal",
                    "Older pair has no qualifying liquidity spike or breakout.",
                    outcome="skip",
                )
                return
            pair = {**pair, "older_scan_signal": signal[0], "older_scan_reason": signal[1]}
            skip_age = True

    blocked = filter_block(pair, filters, skip_age=skip_age)
    if blocked:
        desk.block(pair, *blocked)
        return

    # Fake volume
    fv_cfg = cfg.get("fake_volume", {})
    if detect_fake_volume(pair, fv_cfg):
        logger.warning(f"Fake volume suspected → blacklist {mint}")
        coin_bl.add(key)
        save_blacklist(cfg["blacklists"]["coins_file"], coin_bl)
        await store.log_event(mint, "fake_volume", pair)
        desk.block(pair, "fake_volume", "Suspected fake volume")
        await tg.notify_blacklist(mint, "Suspected fake volume")
        return

    # RugCheck
    report = await rc.get_report(mint)
    if not report:
        logger.debug(f"No RugCheck data for {mint}")
        desk.block(pair, "no_rugcheck", "No RugCheck data")
        return

    if cfg.get("rugcheck", {}).get("only_good", True) and not rc.is_good(report):
        logger.info(f"RugCheck not Good → skip {mint} ({report.get('riskLevel')})")
        desk.block(pair, "rugcheck_not_good", f"RugCheck level {report.get('riskLevel')}")
        return

    if cfg.get("rugcheck", {}).get("reject_on_bundle", True) and rc.has_bundle_or_high_concentration(report):
        logger.warning(f"Bundle / concentration → blacklist {mint}")
        coin_bl.add(key)
        save_blacklist(cfg["blacklists"]["coins_file"], coin_bl)
        await store.log_event(mint, "bundle", {"report": report.get("risks")})
        desk.block(pair, "bundle", "Bundle or high concentration detected")
        await tg.notify_blacklist(mint, "Bundle or high concentration detected")
        return

    # Classification
    analysis_cfg = cfg.get("analysis", {})
    classification = classify_rug_or_pump(pair, analysis_cfg)
    record = {
        **pair,
        **classification,
        "rugcheck_good": True,
        "rugcheck_score": report.get("score"),
        "risk_level": report.get("riskLevel"),
    }

    await store.upsert_token(mint, record)
    store.append_jsonl(record)

    if classification["is_rug"]:
        logger.warning(f"RUG: {pair.get('symbol')} {mint}")
        desk.block(pair, "rug_signal", "; ".join(classification["reasons"]))
        await tg.notify_rug(pair, classification["reasons"])
        if cfg["blacklists"].get("auto_add_rugs"):
            coin_bl.add(key)
            save_blacklist(cfg["blacklists"]["coins_file"], coin_bl)
    elif classification["is_pump"]:
        logger.info(f"PUMP: {pair.get('symbol')} {mint}")
        desk.block(pair, "pump_no_chase", "; ".join(classification["reasons"]), outcome="skip")
        await tg.notify_pump(pair, classification["reasons"])
    else:
        # Clean candidate that passed every gate → score it and let the risk engine decide.
        score = score_pair(pair, top10_pct(report))
        logger.success(
            f"CLEAN candidate: {pair.get('symbol')} | liq ${pair.get('liquidity_usd'):,.0f} | score {score:.2f}"
        )
        await desk.consider(pair, score, ds)


async def discovery_cycle(
    cfg: dict,
    ds: DexScreenerClient,
    rc: RugCheckClient,
    store: Storage,
    tg: TelegramTrader,
    coin_bl: set[str],
    dev_bl: set[str],
    desk: Desk,
) -> None:
    logger.info("Starting discovery cycle…")
    # Exits first: stops must not wait behind a slow discovery pass.
    await desk.mark_open(ds)
    await desk.resolve_counterfactuals(ds)

    profiles = await ds.get_latest_token_profiles()
    logger.info(f"Fetched {len(profiles)} latest token profiles")
    older_cfg = cfg.get("older_tokens", {})
    older_profiles = await get_older_token_profiles(cfg, ds)
    seen: set[str] = set()
    max_pairs = cfg.get("runtime", {}).get("max_pairs_per_cycle", 30)
    expected_chain = cfg.get("dexscreener", {}).get("chain", "solana")
    counts = {"older": 0, "latest": 0}
    for candidates, limit, is_older in (
        (older_profiles, older_cfg.get("max_pairs_per_cycle", 20), True),
        (profiles, max_pairs, False),
    ):
        source = "older" if is_older else "latest"
        for profile in candidates:
            if counts[source] >= limit:
                break
            chain = profile.get("chainId")
            if chain and chain != expected_chain:
                continue
            mint = profile.get("tokenAddress")
            if not mint or mint in seen:
                continue
            seen.add(mint)

            pairs = await ds.get_token_pairs(mint)
            if not pairs:
                continue
            sol_pairs = [p for p in pairs if p.get("chainId") == expected_chain]
            if not sol_pairs:
                continue
            best = max(sol_pairs, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)
            normalized = ds.normalize_pair(best)
            await process_pair(
                normalized, cfg, coin_bl, dev_bl, ds, rc, store, tg, desk, older_scan=is_older
            )
            counts[source] += 1

    logger.info(
        f"Cycle finished — processed {counts['older']} older-scan and {counts['latest']} latest-profile candidates"
    )


async def main() -> None:
    cfg = load_config(ROOT / "config.yaml")
    log_level = cfg.get("runtime", {}).get("log_level", "INFO")
    logger.remove()
    logger.add(sys.stderr, level=log_level)
    logger.add(ROOT / "logs" / "bot.log", rotation="10 MB", level=log_level)

    coin_bl = load_blacklist(cfg["blacklists"]["coins_file"])
    dev_bl = load_blacklist(cfg["blacklists"]["devs_file"])
    logger.info(f"Loaded blacklists: {len(coin_bl)} coins, {len(dev_bl)} devs")

    ds = DexScreenerClient(
        base_url=cfg["dexscreener"]["base_url"],
        delay=cfg["dexscreener"].get("rate_limit_delay", 0.25),
    )
    rc = RugCheckClient(base_url=cfg["rugcheck"]["base_url"])
    store = Storage(cfg["storage"]["db_file"], cfg["storage"]["analysis_jsonl"])
    await store.init()

    tg = TelegramTrader(cfg.get("telegram", {}), dry_run=cfg.get("runtime", {}).get("dry_run", True))
    desk = Desk(cfg, tg)

    stop = asyncio.Event()

    def _signal(*_):
        logger.info("Shutdown signal received")
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_event_loop().add_signal_handler(sig, _signal)
        except NotImplementedError:
            pass

    interval = cfg["dexscreener"].get("poll_interval_seconds", 60)
    logger.info(f"Bot started (dry_run={cfg.get('runtime', {}).get('dry_run')}). Poll every {interval}s")

    try:
        while not stop.is_set():
            try:
                await discovery_cycle(cfg, ds, rc, store, tg, coin_bl, dev_bl, desk)
            except Exception as e:
                logger.exception(f"Cycle error: {e}")
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass
    finally:
        await ds.close()
        await rc.close()
        desk.close()
        logger.info("Bot stopped cleanly")


if __name__ == "__main__":
    asyncio.run(main())
