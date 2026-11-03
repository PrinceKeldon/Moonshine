"""
Aggressive new-pair scanner using DexScreener.

Designed for sniping: low latency, short age windows, in-memory deduplication,
and prioritisation of the freshest pairs.

DexScreener has no true "new pairs" firehose, so we aggressively poll the
latest token-profiles feed and enrich the most promising mints. This is still
slower than on-chain (Helius/Yellowstone) but dramatically better than the
60-second discovery cycle.
"""
from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from loguru import logger

from bot.dexscreener import DexScreenerClient


@dataclass
class ScannerConfig:
    poll_interval_seconds: float = 4.0
    rate_limit_delay: float = 0.12
    max_age_seconds: int = 180          # only keep pairs younger than this
    max_candidates_per_cycle: int = 12
    seen_ttl_seconds: int = 600         # remember a mint for 10 min so we don't re-process
    min_liquidity_usd: float = 5000     # soft pre-filter before full pipeline
    chain: str = "solana"
    prefer_dexes: tuple[str, ...] = ("raydium", "pumpswap", "pumpfun", "meteora")


class SeenCache:
    """Simple TTL ordered set so we never re-process the same mint too soon."""

    def __init__(self, ttl_seconds: int = 600, max_size: int = 5000):
        self.ttl = ttl_seconds
        self.max_size = max_size
        self._data: OrderedDict[str, float] = OrderedDict()

    def add(self, mint: str) -> None:
        key = mint.lower()
        now = time.monotonic()
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = now
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)

    def contains(self, mint: str) -> bool:
        key = mint.lower()
        ts = self._data.get(key)
        if ts is None:
            return False
        if time.monotonic() - ts > self.ttl:
            del self._data[key]
            return False
        return True

    def __len__(self) -> int:
        return len(self._data)


@dataclass
class NewPairScanner:
    """Fast discovery loop focused on brand-new Solana pairs."""

    ds: DexScreenerClient
    cfg: ScannerConfig = field(default_factory=ScannerConfig)
    seen: SeenCache = field(default_factory=lambda: SeenCache())

    async def fetch_raw_profiles(self) -> list[dict]:
        """Pull the latest token profiles (best public proxy for new listings)."""
        profiles = await self.ds.get_latest_token_profiles()
        return profiles if isinstance(profiles, list) else []

    def _age_seconds(self, pair: dict) -> float | None:
        created = pair.get("pair_created_at") or pair.get("pairCreatedAt")
        if not created:
            return None
        try:
            ts = created / 1000 if created > 1e12 else created
            return max(0.0, time.time() - ts)
        except Exception:
            return None

    def _is_preferred_dex(self, pair: dict) -> bool:
        dex = (pair.get("dex_id") or pair.get("dexId") or "").lower()
        return any(d in dex for d in self.cfg.prefer_dexes)

    async def enrich_and_filter(self, mint: str) -> dict | None:
        """Fetch pairs for a mint and return the best normalised candidate, or None."""
        if self.seen.contains(mint):
            return None

        pairs = await self.ds.get_token_pairs(mint)
        if not pairs:
            return None

        sol_pairs = [p for p in pairs if (p.get("chainId") or "").lower() == self.cfg.chain]
        if not sol_pairs:
            return None

        # Prefer higher liquidity, then preferred DEXes
        def sort_key(p: dict) -> tuple:
            liq = (p.get("liquidity") or {}).get("usd") or 0
            preferred = 1 if self._is_preferred_dex(p) else 0
            return (preferred, liq)

        best_raw = max(sol_pairs, key=sort_key)
        normalised = self.ds.normalize_pair(best_raw)

        age = self._age_seconds(normalised)
        if age is not None and age > self.cfg.max_age_seconds:
            # Too old for sniping — mark seen so we don't keep checking it
            self.seen.add(mint)
            return None

        liq = normalised.get("liquidity_usd") or 0
        if liq < self.cfg.min_liquidity_usd:
            # Still very early or dead — do not mark seen yet so we can retry
            return None

        self.seen.add(mint)
        normalised["_scanner_age_s"] = age
        normalised["_scanner_source"] = "aggressive_profiles"
        return normalised

    async def scan_once(self) -> list[dict]:
        """Run one aggressive discovery cycle. Returns list of fresh normalised pairs."""
        profiles = await self.fetch_raw_profiles()
        logger.debug(f"[sniper] fetched {len(profiles)} latest profiles")

        candidates: list[dict] = []
        checked = 0

        for profile in profiles:
            if len(candidates) >= self.cfg.max_candidates_per_cycle:
                break

            chain = (profile.get("chainId") or "").lower()
            if chain and chain != self.cfg.chain:
                continue

            mint = profile.get("tokenAddress")
            if not mint or not isinstance(mint, str):
                continue

            checked += 1
            pair = await self.enrich_and_filter(mint)
            if pair:
                candidates.append(pair)

        # Sort by age (newest first) so the pipeline sees the freshest first
        candidates.sort(key=lambda p: p.get("_scanner_age_s") or 9999)

        if candidates:
            ages = [f"{p.get('symbol', '?')}:{p.get('_scanner_age_s', 0):.0f}s" for p in candidates[:5]]
            logger.info(
                f"[sniper] {len(candidates)} fresh pairs (checked {checked}, seen cache {len(self.seen)}) → {ages}"
            )
        else:
            logger.debug(f"[sniper] no fresh pairs this cycle (checked {checked})")

        return candidates

    async def run(
        self,
        on_pair: Callable[[dict], Awaitable[None]],
        stop_event: asyncio.Event | None = None,
    ) -> None:
        """Continuous aggressive loop. Calls `on_pair(normalised_pair)` for every new candidate."""
        stop = stop_event or asyncio.Event()
        logger.info(
            f"[sniper] starting aggressive scanner | interval={self.cfg.poll_interval_seconds}s "
            f"max_age={self.cfg.max_age_seconds}s min_liq=${self.cfg.min_liquidity_usd:,.0f}"
        )

        while not stop.is_set():
            cycle_start = time.monotonic()
            try:
                pairs = await self.scan_once()
                for pair in pairs:
                    try:
                        await on_pair(pair)
                    except Exception as e:
                        logger.exception(f"[sniper] on_pair error for {pair.get('mint')}: {e}")
            except Exception as e:
                logger.exception(f"[sniper] scan cycle error: {e}")

            elapsed = time.monotonic() - cycle_start
            sleep_for = max(0.5, self.cfg.poll_interval_seconds - elapsed)
            try:
                await asyncio.wait_for(stop.wait(), timeout=sleep_for)
            except asyncio.TimeoutError:
                pass

        logger.info("[sniper] scanner stopped")
