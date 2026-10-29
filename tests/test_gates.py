"""Pipeline gates that were blocking live entries."""
import tempfile
import time
import unittest
from pathlib import Path

from bot.analysis import holder_concentration_block
from bot.desk import Desk
from bot.main import process_pair
from bot.rugcheck import RugCheckClient
from bot.storage import Storage

MINT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"
DEV = "9AhKqLR67hwapvG8SA2JFXaCshXc9nALJjpKaHZrsbkw"
SOL = "So11111111111111111111111111111111111111112"


class FakeDS:
    def __init__(self):
        self.prices = {SOL: (150.0, 5_000_000.0), MINT: (1.0, 100_000.0)}

    async def get_token_pairs(self, mint):
        if mint not in self.prices:
            return []
        price, liq = self.prices[mint]
        return [{"chainId": "solana", "priceUsd": str(price), "liquidity": {"usd": liq},
                 "baseToken": {"address": mint}}]

    @staticmethod
    def normalize_pair(p):
        return {"price_usd": float(p["priceUsd"]), "liquidity_usd": float(p["liquidity"]["usd"])}


class FakeTG:
    def __init__(self):
        self.dry_run = True
        self.calls = []

    async def buy(self, mint, sol_amount=None):
        self.calls.append(("buy", mint))

    async def sell(self, mint, label, reason):
        self.calls.append(("sell", mint))

    async def notify(self, title, body):
        self.calls.append(("notify", title))

    async def notify_blacklist(self, mint, reason):
        self.calls.append(("blacklist", mint))

    async def notify_rug(self, pair, reasons):
        self.calls.append(("rug", pair.get("mint")))

    async def notify_pump(self, pair, reasons):
        self.calls.append(("pump", pair.get("mint")))


class RC:
    def __init__(self, report):
        self.report = report
        self.asked = []

    async def get_report(self, mint):
        self.asked.append(mint)
        return self.report

    is_good = staticmethod(RugCheckClient.is_good)
    explicit_bundle = staticmethod(RugCheckClient.explicit_bundle)
    has_bundle_or_high_concentration = staticmethod(RugCheckClient.has_bundle_or_high_concentration)


def base_pair(**updates):
    pair = {
        "mint": MINT,
        "symbol": "MOON",
        "price_usd": 1.0,
        "liquidity_usd": 100_000.0,
        "volume_24h": 90_000.0,
        "volume_1h": 30_000.0,
        "txns_h1_buys": 120,
        "txns_h1_sells": 80,
        "market_cap": 500_000,
        "price_change_1h": 5,
        "pair_created_at": None,
    }
    pair.update(updates)
    return pair


def cfg(tmp, **blacklists):
    return {
        "filters": {"min_liquidity_usd": 8000, "min_volume_24h_usd": 15000, "max_market_cap_usd": 5_000_000},
        "fake_volume": {"enabled": True, "min_volume_usd_for_check": 50000, "extreme_buy_sell_ratio": 0.95},
        "rugcheck": {"only_good": True, "reject_on_bundle": True, "max_real_top10_pct": 60},
        "analysis": {"pump_price_rise_1h_pct": 80, "rug_price_drop_1h_pct": -40},
        "older_tokens": {"enabled": True, "min_age_minutes": 180, "max_market_cap_usd": 0,
                         "min_volume_1h_usd": 25000, "breakout_price_change_1h_pct": 20},
        "blacklists": {
            "coins_file": str(Path(tmp) / "coins.json"),
            "auto_add_fake_volume": False,
            "auto_add_bundles": False,
            "auto_add_rugs": True,
            **blacklists,
        },
    }


class GateTests(unittest.IsolatedAsyncioTestCase):
    async def _run(self, report, pair, devs=None, **blacklists):
        with tempfile.TemporaryDirectory() as tmp:
            desk = Desk(
                {
                    "risk": {"start_cash": 1000, "slippage_bps": 0, "min_score": 0.2},
                    "ledger": {
                        "db_file": str(Path(tmp) / "ledger.db"),
                        "book_file": str(Path(tmp) / "book.json"),
                        "horizons_s": [3600],
                    },
                },
                FakeTG(),
            )
            tg = desk.tg
            store = Storage(Path(tmp) / "t.db", Path(tmp) / "a.jsonl")
            await store.init()
            coins: set[str] = set()
            await process_pair(
                pair, cfg(tmp, **blacklists), coins, set(devs or []), FakeDS(), RC(report), store, tg, desk,
                older_scan=pair.get("older_scan") is True,
            )
            decisions = [d["code"] for d in desk.ledger.recent_decisions()]
            desk.close()
            return tg.calls, coins, decisions

    async def test_pump_breakout_reaches_the_desk(self):
        calls, coins, codes = await self._run(
            {"score": 1, "risks": [], "topHolders": []},
            base_pair(price_change_1h=92),
        )
        self.assertIn(("pump", MINT), calls)
        self.assertIn(("buy", MINT), calls)
        self.assertNotIn("pump_no_chase", codes)
        self.assertEqual(coins, set())

    async def test_pool_heavy_good_token_is_not_blacklisted(self):
        report = {
            "score": 1,
            "knownAccounts": {"POOL": {"type": "AMM"}},
            "topHolders": [
                {"owner": "POOL", "pct": 92},
                {"owner": "a", "pct": 3},
                {"owner": "b", "pct": 2},
            ],
        }
        self.assertIsNone(holder_concentration_block(report, 60))
        calls, coins, codes = await self._run(report, base_pair())
        self.assertIn(("buy", MINT), calls)
        self.assertEqual(coins, set())
        self.assertNotIn("bundle", codes)

    async def test_extreme_real_holders_skip_without_a_ban(self):
        report = {
            "score": 1,
            "topHolders": [{"owner": f"w{i}", "pct": 15} for i in range(5)],
        }
        calls, coins, codes = await self._run(report, base_pair())
        self.assertNotIn(("buy", MINT), calls)
        self.assertEqual(coins, set())
        self.assertIn("holder_concentration", codes)

    async def test_danger_bundle_respects_auto_add_flag(self):
        report = {"score": 1, "risks": [{"name": "Bundle detected", "level": "danger"}], "topHolders": []}
        calls, coins, _ = await self._run(report, base_pair())
        self.assertNotIn(("buy", MINT), calls)
        self.assertEqual(coins, set())
        self.assertNotIn(("blacklist", MINT), calls)

        calls, coins, _ = await self._run(report, base_pair(), auto_add_bundles=True)
        self.assertEqual(coins, {MINT.lower()})
        self.assertIn(("blacklist", MINT), calls)

    async def test_fake_volume_is_not_a_permanent_ban_by_default(self):
        calls, coins, codes = await self._run(
            {"score": 1, "topHolders": []},
            base_pair(txns_h1_buys=100, txns_h1_sells=1),
        )
        self.assertIn("fake_volume", codes)
        self.assertEqual(coins, set())
        self.assertNotIn(("blacklist", MINT), calls)

    async def test_dev_blacklist_blocks_the_creator(self):
        calls, _, codes = await self._run(
            {"score": 1, "creator": DEV, "topHolders": []},
            base_pair(),
            devs={DEV.lower()},
        )
        self.assertNotIn(("buy", MINT), calls)
        self.assertIn("dev_blacklist", codes)

    async def test_mid_age_large_breakout_can_be_bought(self):
        pair = base_pair(
            older_scan=True,
            market_cap=20_000_000,
            price_change_1h=30,
            pair_created_at=(time.time() - 2 * 24 * 60 * 60) * 1000,
        )
        calls, _, codes = await self._run({"score": 1, "topHolders": []}, pair)
        self.assertIn(("buy", MINT), calls)
        self.assertNotIn("max_mcap", codes)
        self.assertNotIn("max_age", codes)
        self.assertNotIn("older_no_signal", codes)


if __name__ == "__main__":
    unittest.main()
