"""
DexScreener Bot — full pipeline

1. Discover candidate tokens (token profiles + recent pairs)
2. Apply filters + blacklists
3. Fake-volume heuristic → blacklist only when auto_add_fake_volume is on
4. RugCheck → Good band; danger-level bundles can be blacklisted; holder concentration only skips
5. Rugs are blocked. Pumps and older-scan breakouts are scored and offered to the desk
6. Score the survivors; the Desk (risk engine) decides whether to buy
7. Every cycle: mark open positions, fire stop / trail exits, resolve counterfactuals

Modes
-----
- normal  : discovery cycle (profiles + older-token boosts)
- sniper  : aggressive DexScreener polling focused on brand-new pairs only
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
    holder_concentration_block,
    older_min_age_minutes,
    older_token_signal,
    pair_age_min,
    report_creator,
    scan_filters,
    score_pair,
    top10_pct,
)
from bot.config import load_blacklist, load_config, save_blacklist
from bot.desk import Desk
from bot.dexscreener import DexScreenerClient
from bot.new_pair_scanner import NewPairScanner, ScannerConfig, SeenCache
from bot.report import paper_report
from bot.risk import RiskConfig
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


def _blacklist_coin(cfg: dict, coin_bl: set[str], key: str) -> None:
    coin_bl.add(key)
    path = (cfg.get("blacklists") or {}).get("coins_file")
    if path:
        save_blacklist(path, coin_bl)


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
        if age >= older_min_age_minutes(older_cfg, filters):
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

    blocked = filter_block(pair, scan_filters(filters, older_cfg, skip_age), skip_age=skip_age)
    if blocked:
        desk.block(pair, *blocked)
        return

    fv_cfg = cfg.get("fake_volume", {})
    if detect_fake_volume(pair, fv_cfg):
        bl = cfg.get("blacklists") or {}
        if bl.get("auto_add_fake_volume"):
            logger.warning(f"Fake volume suspected → blacklist {mint}")
            _blacklist_coin(cfg, coin_bl, key)
            await tg.notify_blacklist(mint, "Suspected fake volume")
        else:
            logger.info(f"Fake volume suspected → skip {mint} (not blacklisted)")
        await store.log_event(mint, "fake_volume", pair)
        desk.block(pair, "fake_volume", "Suspected fake volume")
        return

    report = await rc.get_report(mint)
    if not report:
        logger.debug(f"No RugCheck data for {mint}")
        desk.block(pair, "no_rugcheck", "No RugCheck data")
        return

    creator = report_creator(report)
    if creator and creator.lower() in dev_bl:
        logger.info(f"Dev blacklist → skip {mint} ({creator})")
        desk.block(pair, "dev_blacklist", f"Creator {creator} is on the dev blacklist.")
        return

    if cfg.get("rugcheck", {}).get("only_good", True) and not rc.is_good(report):
        logger.info(f"RugCheck not Good → skip {mint} ({report.get('riskLevel') or report.get('score')})")
        desk.block(pair, "rugcheck_not_good", f"RugCheck level {report.get('riskLevel') or report.get('score')}")
        return

    rug_cfg = cfg.get("rugcheck") or {}
    if rug_cfg.get("reject_on_bundle", True):
        if hasattr(rc, "explicit_bundle"):
            bundle = rc.explicit_bundle(report)
        elif rc.has_bundle_or_high_concentration(report):
            bundle = "Bundle or insider risk"
        else:
            bundle = None
        if bundle:
            bl = cfg.get("blacklists") or {}
            if bl.get("auto_add_bundles"):
                logger.warning(f"Bundle → blacklist {mint}")
                _blacklist_coin(cfg, coin_bl, key)
            else:
                logger.warning(f"Bundle → skip {mint} (not blacklisted)")
            await store.log_event(mint, "bundle", {"report": report.get("risks")})
            desk.block(pair, "bundle", bundle)
            return
        concentration = holder_concentration_block(
            report, float(rug_cfg.get("max_real_top10_pct", 60))
        )
        if concentration:
            logger.info(f"Holder concentration → skip {mint}")
            desk.block(pair, "holder_concentration", concentration, outcome="skip")
            return

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
        if (cfg.get("blacklists") or {}).get("auto_add_rugs"):
            _blacklist_coin(cfg, coin_bl, key)
        return

    if classification["is_pump"]:
        logger.info(f"PUMP: {pair.get('symbol')} {mint} — still eligible")
        await tg.notify_pump(pair, classification["reasons"])

    score = score_pair(pair, top10_pct(report))
    kind = "PUMP candidate" if classification["is_pump"] else "CLEAN candidate"
    signal = pair.get("older_scan_signal")
    if signal:
        kind = f"{kind} [{signal}]"
    age_s = pair.get("_scanner_age_s")
    age_note = f" | age {age_s:.0f}s" if age_s is not None else ""
    logger.success(
        f"{kind}: {pair.get('symbol')} | liq ${pair.get('liquidity_usd'):,.0f} | score {score:.2f}{age_note}"
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


async def position_loop(desk: Desk, ds: DexScreenerClient, stop: asyncio.Event, interval: float) -> None:
    """Mark open positions and resolve counterfactuals every interval seconds."""
    while not stop.is_set():
        try:
            await desk.mark_open(ds)
            await desk.resolve_counterfactuals(ds)
        except Exception as e:
            logger.exception(f"position loop error: {e}")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass


def _build_scanner(cfg: dict, ds: DexScreenerClient) -> NewPairScanner:
    sniper_cfg = cfg.get("sniper") or {}
    scanner_cfg = ScannerConfig(
        poll_interval_seconds=float(sniper_cfg.get("poll_interval_seconds", 4.0)),
        rate_limit_delay=float(sniper_cfg.get("rate_limit_delay", 0.12)),
        max_age_seconds=int(sniper_cfg.get("max_age_seconds", 180)),
        max_candidates_per_cycle=int(sniper_cfg.get("max_candidates_per_cycle", 12)),
        seen_ttl_seconds=int(sniper_cfg.get("seen_ttl_seconds", 600)),
        min_liquidity_usd=float(sniper_cfg.get("min_liquidity_usd", 5000)),
        chain=cfg.get("dexscreener", {}).get("chain", "solana"),
        prefer_dexes=tuple(sniper_cfg.get("prefer_dexes") or ("raydium", "pumpswap", "pumpfun", "meteora")),
    )
    ds.delay = scanner_cfg.rate_limit_delay
    return NewPairScanner(
        ds=ds,
        cfg=scanner_cfg,
        seen=SeenCache(ttl_seconds=scanner_cfg.seen_ttl_seconds),
    )


async def run_sniper_mode(
    cfg: dict,
    ds: DexScreenerClient,
    rc: RugCheckClient,
    store: Storage,
    tg: TelegramTrader,
    coin_bl: set[str],
    dev_bl: set[str],
    desk: Desk,
    stop: asyncio.Event,
) -> None:
    """Aggressive new-pair loop. Runs exits on a short timer in parallel."""
    scanner = _build_scanner(cfg, ds)

    async def on_pair(pair: dict) -> None:
        await process_pair(pair, cfg, coin_bl, dev_bl, ds, rc, store, tg, desk, older_scan=False)

    mark_iv = float((cfg.get("runtime") or {}).get("mark_interval_seconds", 10))
    pos_task = asyncio.create_task(position_loop(desk, ds, stop, mark_iv))
    try:
        await scanner.run(on_pair=on_pair, stop_event=stop)
    finally:
        pos_task.cancel()
        try:
            await pos_task
        except asyncio.CancelledError:
            pass


def _print_report(cfg: dict, desk: Desk) -> None:
    """Print paper-trading summary on shutdown."""
    try:
        lcfg = cfg.get("ledger") or {}
        rcfg = RiskConfig.from_dict(cfg.get("risk"))
        report = paper_report(
            desk.ledger,
            Path(lcfg.get("book_file", "data/book.json")),
            rcfg,
            since=0.0,
        )
        print("\n" + report)
        logger.info("Paper report printed")
    except Exception as e:
        logger.warning(f"Could not print paper report: {e}")


async def main() -> None:
    cfg = load_config(ROOT / "config.yaml")
    log_level = cfg.get("runtime", {}).get("log_level", "INFO")
    logger.remove()
    logger.add(sys.stderr, level=log_level)
    logger.add(ROOT / "logs" / "bot.log", rotation="10 MB", level=log_level)

    coin_bl = load_blacklist(cfg["blacklists"]["coins_file"])
    dev_bl = load_blacklist(cfg["blacklists"]["devs_file"])
    logger.info(f"Loaded blacklists: {len(coin_bl)} coins, {len(dev_bl)} devs")

    mode = (cfg.get("runtime") or {}).get("mode", "normal").lower()
    ds_delay = cfg["dexscreener"].get("rate_limit_delay", 0.25)
    if mode == "sniper":
        ds_delay = (cfg.get("sniper") or {}).get("rate_limit_delay", 0.12)

    ds = DexScreenerClient(
        base_url=cfg["dexscreener"]["base_url"],
        delay=ds_delay,
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

    dry = cfg.get("runtime", {}).get("dry_run", True)
    logger.info(f"Bot started | mode={mode} | dry_run={dry}")

    try:
        if mode == "sniper":
            await run_sniper_mode(cfg, ds, rc, store, tg, coin_bl, dev_bl, desk, stop)
        else:
            interval = cfg["dexscreener"].get("poll_interval_seconds", 20)
            mark_iv = float((cfg.get("runtime") or {}).get("mark_interval_seconds", 10))
            logger.info(f"Normal mode — discovery every {interval}s, marks every {mark_iv:.0f}s")
            pos_task = asyncio.create_task(position_loop(desk, ds, stop, mark_iv))
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
                pos_task.cancel()
                try:
                    await pos_task
                except asyncio.CancelledError:
                    pass
    finally:
        await ds.close()
        await rc.close()
        _print_report(cfg, desk)
        desk.close()
        logger.info("Bot stopped cleanly")


if __name__ == "__main__":
    asyncio.run(main())
