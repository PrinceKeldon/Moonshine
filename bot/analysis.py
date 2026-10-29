"""Token analysis: filters, fake-volume heuristic, rug/pump detection."""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any


def filter_block(pair: dict, filters: dict, *, skip_age: bool = False) -> tuple[str, str] | None:
    """None if the pair passes the basic filters, else (code, reason) for the first one it fails."""
    liq = pair.get("liquidity_usd", 0)
    if liq < filters.get("min_liquidity_usd", 0):
        return ("min_liquidity", f"Liquidity ${liq:,.0f} is under ${filters.get('min_liquidity_usd', 0):,.0f}.")
    vol = pair.get("volume_24h", 0)
    if vol < filters.get("min_volume_24h_usd", 0):
        return ("min_volume", f"24h volume ${vol:,.0f} is under ${filters.get('min_volume_24h_usd', 0):,.0f}.")
    mc = pair.get("market_cap") or pair.get("fdv") or 0
    if mc < filters.get("min_market_cap_usd", 0):
        return ("min_mcap", f"Market cap ${mc:,.0f} is under ${filters.get('min_market_cap_usd', 0):,.0f}.")
    max_mc = filters.get("max_market_cap_usd")
    if max_mc and mc > max_mc:
        return ("max_mcap", f"Market cap ${mc:,.0f} is over ${max_mc:,.0f}.")

    # Age check
    created = pair.get("pair_created_at")
    if not skip_age and created and filters.get("max_age_minutes"):
        try:
            # DexScreener uses ms timestamps
            ts = created / 1000 if created > 1e12 else created
            age_min = (datetime.now(timezone.utc).timestamp() - ts) / 60
            if age_min > filters["max_age_minutes"]:
                return ("max_age", f"Pair is {age_min:.0f} min old (limit {filters['max_age_minutes']}).")
        except Exception:
            pass
    return None


def apply_filters(pair: dict, filters: dict) -> bool:
    """Return True if the pair passes basic filters."""
    return filter_block(pair, filters) is None


def _clamp01(n: float) -> float:
    return 0.0 if n < 0 else 1.0 if n > 1 else n


def older_min_age_minutes(cfg: dict, filters: dict | None = None) -> float:
    """Age, in minutes, where the spike/breakout path starts.

    ``min_age_minutes`` wins. Otherwise ``min_age_days``. If neither is set,
    start at the new-pair max age so a token cannot be too old for the latest
    feed and too young for the older scan.
    """
    if cfg.get("min_age_minutes") is not None:
        return float(cfg["min_age_minutes"])
    if cfg.get("min_age_days") is not None:
        return float(cfg["min_age_days"]) * 24 * 60
    if filters and filters.get("max_age_minutes"):
        return float(filters["max_age_minutes"])
    return 180.0


def scan_filters(filters: dict, older_cfg: dict, skip_age: bool) -> dict:
    """Filters for this candidate. Older-scan names that already qualified do not
    inherit the new-pair market-cap ceiling (0 means no cap)."""
    if not skip_age:
        return filters
    return {**filters, "max_market_cap_usd": older_cfg.get("max_market_cap_usd", 0)}


def pair_age_min(pair: dict) -> float | None:
    created = pair.get("pair_created_at")
    if not created:
        return None
    ts = created / 1000 if created > 1e12 else created
    return max(0.0, (datetime.now(timezone.utc).timestamp() - ts) / 60)


def older_token_signal(
    pair: dict, market_change: dict[str, float] | None, cfg: dict
) -> tuple[str, str] | None:
    """Return a qualifying liquidity-spike or price-breakout signal for an older pair."""
    age = pair_age_min(pair)
    if age is None or age < older_min_age_minutes(cfg):
        return None

    volume_1h = pair.get("volume_1h") or 0
    min_volume = cfg.get("min_volume_1h_usd", 25000)
    if volume_1h < min_volume:
        return None

    liquidity_change = (market_change or {}).get("liquidity_change_pct")
    previous_liquidity = (market_change or {}).get("previous_liquidity_usd", 0)
    min_baseline = cfg.get("min_baseline_liquidity_usd", 5000)
    spike_pct = cfg.get("liquidity_spike_pct", 30)
    if (
        liquidity_change is not None
        and previous_liquidity >= min_baseline
        and liquidity_change >= spike_pct
    ):
        return (
            "older_liquidity_spike",
            f"Liquidity rose {liquidity_change:+.0f}% over the tracking window "
            f"(${previous_liquidity:,.0f} to ${pair.get('liquidity_usd') or 0:,.0f}).",
        )

    breakout_pct = cfg.get("breakout_price_change_1h_pct", 20)
    price_change_1h = pair.get("price_change_1h") or 0
    if price_change_1h >= breakout_pct:
        return (
            "older_breakout",
            f"1h price breakout +{price_change_1h:.1f}% "
            f"with ${volume_1h:,.0f} 1h volume.",
        )
    return None


def score_pair(pair: dict, top10: float | None = None) -> float:
    """0-1 score. Same weights and log baselines as the TypeScript live desk
    (live-score.ts) so both halves of the project rank tokens the same way.
    Unknown age scores neutral (0.55); the TS side treats it as brand new."""
    vol = max(pair.get("volume_1h") or 0.0, 1.0)
    liq = max(pair.get("liquidity_usd") or 0.0, 1.0)
    vol_score = _clamp01((math.log10(vol) - 4.2) / 1.1)
    liq_score = _clamp01((math.log10(liq) - 3.6) / 1.1)
    holder_score = 0.45 if top10 is None else _clamp01((16 - top10) / 12)
    age = pair_age_min(pair)
    if age is None:
        age_score = 0.55
    else:
        age_score = 0.2 if age < 6 else 0.5 if age < 15 else 0.9 if age < 180 else 0.7 if age < 1440 else 0.55
    buys = pair.get("txns_h1_buys") or 0
    sells = pair.get("txns_h1_sells") or 0
    flow = (buys - sells) / max(1, buys + sells)
    flow_score = _clamp01(0.5 + flow * 0.9)
    raw = 0.2 * vol_score + 0.24 * liq_score + 0.18 * holder_score + 0.18 * age_score + 0.2 * flow_score
    return round(_clamp01(raw), 2)


def real_holder_pcts(report: dict) -> list[float]:
    """Descending holder percentages with AMM/LOCKER accounts removed.

    One dominant holder above 35% is dropped. On memecoins that wallet is almost
    always the pool or bonding curve, and counting it as a person blacklists
    tokens RugCheck would otherwise leave tradable.
    """
    holders = report.get("topHolders") or []
    known = report.get("knownAccounts") or {}
    if not isinstance(known, dict):
        known = {}
    pcts: list[float] = []
    for holder in holders:
        if not isinstance(holder, dict) or "pct" not in holder:
            continue
        acct = None
        for addr in (holder.get("owner"), holder.get("address")):
            if isinstance(addr, str) and isinstance(known.get(addr), dict):
                acct = known[addr]
                break
        if acct and str(acct.get("type", "")).upper() in ("AMM", "LOCKER"):
            continue
        try:
            pcts.append(float(holder["pct"]))
        except (TypeError, ValueError):
            continue
    if not pcts:
        return []
    pcts.sort(reverse=True)
    if pcts[0] > 35:
        pcts = pcts[1:]
    return pcts


def top10_pct(report: dict) -> float | None:
    """Share held by the top 10 real holders, from a RugCheck report. Pools and
    lockers are excluded and one dominant holder (>35%, almost always the pool or
    bonding curve) is dropped, mirroring the TypeScript screen. None if unknown."""
    pcts = real_holder_pcts(report)
    return sum(pcts[:10]) if pcts else None


def holder_concentration_block(report: dict, limit: float = 60.0) -> str | None:
    """Skip (do not blacklist) when real holders, after pools are removed, are extreme."""
    pcts = real_holder_pcts(report)
    if not pcts:
        return None
    top10 = sum(pcts[:10])
    if top10 > limit:
        return (
            f"Top holders control {top10:.0f}% after excluding pools and lockers "
            f"(limit {limit:.0f}%)."
        )
    return None


def report_creator(report: dict | None) -> str | None:
    """Creator wallet from a RugCheck report, if it named one."""
    if not isinstance(report, dict):
        return None
    token = report.get("token") if isinstance(report.get("token"), dict) else {}
    for value in (report.get("creator"), token.get("creator")):
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def detect_fake_volume(pair: dict, cfg: dict) -> bool:
    """
    Approximate Pocket-Universe-style fake volume detection.
    Real Pocket Universe is a wallet-security product; there is no public
    volume-authenticity API. We use common on-chain heuristics that
    correlate with wash trading / bot volume.
    """
    if not cfg.get("enabled", True):
        return False

    vol = pair.get("volume_24h") or pair.get("volume_1h") or 0
    if vol < cfg.get("min_volume_usd_for_check", 50000):
        return False

    buys = pair.get("txns_h1_buys") or pair.get("txns_m5_buys") or 0
    sells = pair.get("txns_h1_sells") or pair.get("txns_m5_sells") or 0
    total_tx = buys + sells
    if total_tx == 0:
        return False

    # Extreme imbalance
    ratio = max(buys, sells) / total_tx
    if ratio >= cfg.get("extreme_buy_sell_ratio", 0.95):
        return True

    # Very high volume relative to number of trades (large repeated sizes)
    # Simple proxy: if volume is huge but tx count is tiny
    if total_tx < 20 and vol > 200_000:
        return True

    return False


def classify_rug_or_pump(pair: dict, analysis_cfg: dict) -> dict[str, Any]:
    """Return classification flags + reasons."""
    change_1h = pair.get("price_change_1h") or 0
    liq = pair.get("liquidity_usd") or 0
    vol = pair.get("volume_24h") or 0

    is_rug = False
    is_pump = False
    reasons = []

    rug_thresh = analysis_cfg.get("rug_price_drop_1h_pct", -40)
    if change_1h <= rug_thresh and liq < 30_000:
        is_rug = True
        reasons.append(f"1h change {change_1h:.1f}% + low liquidity")

    pump_thresh = analysis_cfg.get("pump_price_rise_1h_pct", 80)
    if change_1h >= pump_thresh and vol > 20_000:
        is_pump = True
        reasons.append(f"1h change +{change_1h:.1f}% with volume")

    return {
        "is_rug": is_rug,
        "is_pump": is_pump,
        "reasons": reasons,
        "price_change_1h": change_1h,
        "liquidity_usd": liq,
        "volume_24h": vol,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
