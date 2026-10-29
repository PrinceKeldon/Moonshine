import tempfile
import unittest
from pathlib import Path

from bot.analysis import filter_block, score_pair, top10_pct
from bot.desk import Desk
from bot.main import process_pair
from bot.risk import RiskConfig, book_from_dict, book_to_dict, enter, mark, new_book, paper_fill

MINT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"  # mixed case on purpose
SOL = "So11111111111111111111111111111111111111112"


class FakeDS:
    """DexScreener stand-in: prices are set per mint, an unknown mint has no pairs."""

    def __init__(self):
        self.prices: dict[str, tuple[float, float]] = {SOL: (150.0, 5_000_000.0)}

    async def get_token_pairs(self, mint):
        if mint not in self.prices:
            return []
        price, liq = self.prices[mint]
        return [{"chainId": "solana", "priceUsd": str(price), "liquidity": {"usd": liq}, "baseToken": {"address": mint}}]

    @staticmethod
    def normalize_pair(p):
        return {"price_usd": float(p["priceUsd"]), "liquidity_usd": float(p["liquidity"]["usd"])}


class FakeTG:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.calls: list[tuple] = []

    async def buy(self, mint, sol_amount=None):
        self.calls.append(("buy", mint, sol_amount))

    async def sell(self, mint, label, reason):
        self.calls.append(("sell", mint, label))

    async def notify(self, title, body):
        self.calls.append(("notify", title))

    async def notify_blacklist(self, mint, reason):
        self.calls.append(("blacklist", mint))

    async def notify_rug(self, pair, reasons):
        self.calls.append(("rug", pair.get("mint")))

    async def notify_pump(self, pair, reasons):
        self.calls.append(("pump", pair.get("mint")))


def pair(price=1.0, liq=100_000.0, mint=MINT):
    return {"mint": mint, "symbol": "MOON", "price_usd": price, "liquidity_usd": liq, "volume_24h": 90_000,
            "volume_1h": 30_000, "txns_h1_buys": 120, "txns_h1_sells": 80, "market_cap": 500_000,
            "pair_created_at": None}


def make_desk(tmp, clock, dry_run=True, **risk):
    cfg = {
        "risk": {"start_cash": 1000, "slippage_bps": 0, "stale_exit_s": 600, **risk},
        "ledger": {"db_file": str(Path(tmp) / "ledger.db"), "book_file": str(Path(tmp) / "book.json"),
                   "block_cooldown_s": 3600, "horizons_s": [3600]},
    }
    tg = FakeTG(dry_run)
    return Desk(cfg, tg, clock=clock), tg


class Clock:
    def __init__(self, t=1_700_000_000.0):
        self.t = t

    def __call__(self):
        return self.t


class DeskFlow(unittest.IsolatedAsyncioTestCase):
    async def test_buy_once_then_stop_then_restart_keeps_book(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices[MINT] = (1.0, 100_000.0)
            desk, tg = make_desk(tmp, clock)
            await desk.consider(pair(), 0.8, ds)
            await desk.consider(pair(), 0.8, ds)  # same token again: the old bot bought every cycle
            self.assertEqual([c[0] for c in tg.calls], ["buy"])
            self.assertEqual(tg.calls[0][1], MINT)  # exact case preserved
            self.assertEqual(len(desk.book.positions), 1)
            # ticket $60 (8% x 0.75 tier at score 0.8), SOL at $150
            self.assertAlmostEqual(tg.calls[0][2], 60.0 / 150.0)

            # restart: the book is still there and nothing is written off after the downtime
            clock.t += 7200
            desk2, tg2 = make_desk(tmp, clock)
            self.assertEqual(list(desk2.book.positions), [MINT])
            ds.prices[MINT] = (0.93, 100_000.0)  # -7%: through the -6% stop
            await desk2.mark_open(ds)
            self.assertEqual(desk2.book.positions, {})
            self.assertEqual([c[0] for c in tg2.calls], ["sell"])
            self.assertLess(desk2.book.closed[0].pnl_usd, 0)
            rows = desk2.ledger.recent_decisions()
            self.assertEqual({r["outcome"] for r in rows}, {"buy", "stop"})
            self.assertEqual(desk2.ledger.trade_summary()["trades"], 1)

    async def test_exit_fill_includes_pool_impact(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices[MINT] = (1.0, 2_000.0)  # shallow pool: $60 ticket is 6% of liquidity
            desk, _ = make_desk(tmp, clock)
            await desk.consider(pair(liq=2_000.0), 0.8, ds)
            entry = desk.book.positions[MINT].entry_price
            self.assertGreater(entry, 1.0)  # paid up
            ds.prices[MINT] = (0.93, 2_000.0)
            await desk.mark_open(ds)
            trade = desk.book.closed[0]
            self.assertLess(trade.exit_price, 0.93)  # sold below the mark that triggered the stop
            self.assertLess(trade.pnl_pct, -0.06)

    async def test_vanished_token_is_written_off(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices[MINT] = (1.0, 100_000.0)
            desk, tg = make_desk(tmp, clock)
            await desk.consider(pair(), 0.8, ds)
            del ds.prices[MINT]
            clock.t += 300
            await desk.mark_open(ds)
            self.assertIn(MINT, desk.book.positions)  # inside the grace window
            clock.t += 600
            await desk.mark_open(ds)
            self.assertEqual(desk.book.positions, {})
            self.assertEqual(desk.book.closed[0].exit_kind, "writeoff")
            self.assertAlmostEqual(desk.book.closed[0].proceeds, 0.0)
            self.assertIn("sell", [c[0] for c in tg.calls])
            # a $60 total loss is over the 5% daily limit ($50): the desk halts new entries
            self.assertIn(("notify", "TRADING HALTED"), tg.calls)
            self.assertIsNotNone(desk.book.halted)

    async def test_live_mode_needs_sol_price(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices.pop(SOL)
            desk, tg = make_desk(tmp, clock, dry_run=False)
            await desk.consider(pair(), 0.8, ds)
            self.assertEqual(tg.calls, [])
            self.assertEqual(desk.book.positions, {})
            self.assertEqual(desk.ledger.recent_decisions()[0]["code"], "no_sol_price")

    async def test_block_is_throttled_and_counterfactual_resolves(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices[MINT] = (1.0, 100_000.0)
            desk, _ = make_desk(tmp, clock)
            for _ in range(5):
                desk.block(pair(), "min_liquidity", "Liquidity too low.")
            self.assertEqual(len(desk.ledger.recent_decisions()), 1)
            clock.t += 3601
            desk.block(pair(), "min_liquidity", "Liquidity too low.")
            self.assertEqual(len(desk.ledger.recent_decisions()), 2)  # cooldown over
            ds.prices[MINT] = (1.5, 100_000.0)
            await desk.resolve_counterfactuals(ds)
            report = desk.ledger.gate_report()
            self.assertEqual(report[0]["code"], "min_liquidity")
            self.assertAlmostEqual(report[0]["avg_pct"], 0.5)

    async def test_dead_token_counts_as_minus_100(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            desk, _ = make_desk(tmp, clock, )
            desk.dead_after_s = 1000
            desk.block(pair(), "bundle", "Bundle.")
            clock.t += 3600 + 500
            await desk.resolve_counterfactuals(ds)  # no price, not dead yet
            self.assertEqual(desk.ledger.gate_report(), [])
            clock.t += 1000
            await desk.resolve_counterfactuals(ds)
            self.assertAlmostEqual(desk.ledger.gate_report()[0]["avg_pct"], -1.0)


class MintCase(unittest.IsolatedAsyncioTestCase):
    async def test_pipeline_uses_original_case_mint(self):
        """Base58 is case-sensitive: the old bot lowercased the mint before calling RugCheck
        and before sending the buy command, so it queried and bought a different address."""
        from bot.rugcheck import RugCheckClient
        from bot.storage import Storage

        class RC:
            def __init__(self):
                self.asked: list[str] = []

            async def get_report(self, mint):
                self.asked.append(mint)
                return {"riskLevel": "Good", "score": 1, "risks": [], "topHolders": []}

            is_good = staticmethod(RugCheckClient.is_good)
            has_bundle_or_high_concentration = staticmethod(RugCheckClient.has_bundle_or_high_concentration)

        with tempfile.TemporaryDirectory() as tmp:
            clock, ds = Clock(), FakeDS()
            ds.prices[MINT] = (1.0, 100_000.0)
            desk, tg = make_desk(tmp, clock)
            store = Storage(Path(tmp) / "t.db", Path(tmp) / "a.jsonl")
            await store.init()
            rc = RC()
            cfg = {
                "filters": {"min_liquidity_usd": 8000, "min_volume_24h_usd": 15000},
                "fake_volume": {"enabled": True},
                "rugcheck": {"only_good": True, "reject_on_bundle": True},
                "analysis": {},
                "blacklists": {"coins_file": str(Path(tmp) / "coins.json"), "auto_add_rugs": True},
            }
            await process_pair(pair(), cfg, set(), set(), ds, rc, store, tg, desk)
            self.assertEqual(rc.asked, [MINT])
            buys = [c for c in tg.calls if c[0] == "buy"]
            self.assertEqual(len(buys), 1)
            self.assertEqual(buys[0][1], MINT)


class Pure(unittest.TestCase):
    def test_paper_fill(self):
        self.assertAlmostEqual(paper_fill(1.0, "buy", 100, 10_000, slippage_bps=0), 1.02)  # 2*100/10000
        self.assertAlmostEqual(paper_fill(1.0, "sell", 100, 10_000, slippage_bps=100), 1 - 0.01 - 0.02)
        self.assertAlmostEqual(paper_fill(1.0, "buy", 100, 0, slippage_bps=0), 1.10)  # unknown depth
        self.assertAlmostEqual(paper_fill(1.0, "buy", 1_000_000, 1_000, slippage_bps=0), 1.50)  # capped

    def test_book_round_trip(self):
        cfg = RiskConfig(start_cash=100, min_notional=1)
        book, _ = enter(cfg, new_book(cfg), MINT, 2.0, 0.9, 1_700_000_000.0, "MOON")
        book, _ = mark(cfg, book, {MINT: 1.0}, 1_700_000_060.0)  # stop out so closed + lock are populated
        self.assertEqual(book_from_dict(book_to_dict(book)), book)

    def test_corrupt_book_refuses_to_start(self):
        from bot.risk import load_book
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "book.json"
            path.write_text("{not json", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_book(RiskConfig(), path)

    def test_filter_block_matches_old_boolean(self):
        f = {"min_liquidity_usd": 8000, "min_volume_24h_usd": 15000, "max_market_cap_usd": 1_000_000}
        self.assertIsNone(filter_block(pair(), f))
        self.assertEqual(filter_block(pair(liq=100), f)[0], "min_liquidity")
        self.assertEqual(filter_block({**pair(), "market_cap": 5_000_000}, f)[0], "max_mcap")

    def test_score_matches_typescript_formula(self):
        # age unknown -> 0.55, top10 unknown -> 0.45; hand-computed from live-score.ts weights
        p = {"volume_1h": 31_622.776601683792, "liquidity_usd": 79_432.82347242822,
             "txns_h1_buys": 100, "txns_h1_sells": 100}
        vol = (4.5 - 4.2) / 1.1
        liq = min(1.0, (4.9 - 3.6) / 1.1)  # clamps to 1.0
        expected = round(0.2 * vol + 0.24 * liq + 0.18 * 0.45 + 0.18 * 0.55 + 0.2 * 0.5, 2)
        self.assertEqual(score_pair(p), expected)

    def test_top10_excludes_pools_and_dominant_holder(self):
        report = {
            "knownAccounts": {"POOL": {"type": "AMM"}},
            "topHolders": [{"owner": "POOL", "pct": 40}, {"owner": "a", "pct": 36}, {"owner": "b", "pct": 5},
                           {"owner": "c", "pct": 4}],
        }
        self.assertEqual(top10_pct(report), 9.0)  # pool skipped, 36% dominant holder dropped
        self.assertIsNone(top10_pct({}))


if __name__ == "__main__":
    unittest.main()
