import tempfile
import time
import unittest
from pathlib import Path

from bot.analysis import filter_block, older_token_signal
from bot.main import get_older_token_profiles
from bot.storage import Storage


def old_pair(**updates):
    pair = {
        "pair_created_at": (time.time() - 10 * 24 * 60 * 60) * 1000,
        "liquidity_usd": 12_000.0,
        "volume_1h": 30_000.0,
        "price_change_1h": 5.0,
    }
    return {**pair, **updates}


class OlderSignalTests(unittest.TestCase):
    def test_old_pair_needs_liquidity_spike_or_breakout(self):
        cfg = {
            "min_age_days": 7,
            "min_volume_1h_usd": 25_000,
            "min_baseline_liquidity_usd": 5_000,
            "liquidity_spike_pct": 30,
            "breakout_price_change_1h_pct": 20,
        }
        self.assertIsNone(older_token_signal(old_pair(), None, cfg))
        self.assertEqual(
            older_token_signal(
                old_pair(), {"previous_liquidity_usd": 8_000, "liquidity_change_pct": 50}, cfg
            )[0],
            "older_liquidity_spike",
        )
        self.assertEqual(
            older_token_signal(old_pair(price_change_1h=25), None, cfg)[0],
            "older_breakout",
        )

    def test_old_signal_bypasses_only_pair_age_filter(self):
        filters = {"min_liquidity_usd": 8_000, "max_age_minutes": 180}
        pair = old_pair()
        self.assertEqual(filter_block(pair, filters)[0], "max_age")
        self.assertIsNone(filter_block(pair, filters, skip_age=True))
        self.assertEqual(
            filter_block(old_pair(liquidity_usd=1_000), filters, skip_age=True)[0],
            "min_liquidity",
        )

    def test_young_pair_cannot_use_older_token_signal(self):
        cfg = {"min_age_days": 7, "min_volume_1h_usd": 25_000}
        young = old_pair(pair_created_at=(time.time() - 60 * 60) * 1000, price_change_1h=50)
        self.assertIsNone(older_token_signal(young, None, cfg))


class MarketSnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def test_liquidity_change_uses_persisted_lookback(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Storage(Path(tmp) / "tokens.db", Path(tmp) / "analysis.jsonl")
            await store.init()
            start = 1_700_000_000.0
            self.assertIsNone(
                await store.record_market_snapshot("Mint", start, 10_000, 1.0, 3600)
            )
            change = await store.record_market_snapshot("Mint", start + 3600, 14_000, 1.2, 3600)
            self.assertAlmostEqual(change["liquidity_change_pct"], 40.0)
            self.assertAlmostEqual(change["price_change_pct"], 20.0)


class OlderCandidateTests(unittest.IsolatedAsyncioTestCase):
    async def test_boost_feeds_and_watchlist_are_combined(self):
        class FakeDex:
            async def get_latest_token_boosts(self):
                return [{"chainId": "solana", "tokenAddress": "boost-latest"}]

            async def get_top_token_boosts(self):
                return [{"chainId": "solana", "tokenAddress": "boost-top"}]

        profiles = await get_older_token_profiles(
            {"older_tokens": {"mints": ["watch-mint", " "]}, "dexscreener": {"chain": "solana"}},
            FakeDex(),
        )
        self.assertEqual(
            [profile["tokenAddress"] for profile in profiles],
            ["boost-latest", "boost-top", "watch-mint"],
        )

    async def test_disabled_older_scan_does_not_fetch_feeds(self):
        class FakeDex:
            async def get_latest_token_boosts(self):
                raise AssertionError("disabled scan should not query boosts")

            async def get_top_token_boosts(self):
                raise AssertionError("disabled scan should not query boosts")

        profiles = await get_older_token_profiles({"older_tokens": {"enabled": False}}, FakeDex())
        self.assertEqual(profiles, [])
