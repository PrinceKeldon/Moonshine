import random
import unittest
from dataclasses import replace

from bot.risk import RiskConfig, audit, enter, equity, flatten, mark, new_book

CFG = RiskConfig(start_cash=10.0, max_positions=2, max_position_pct=0.40, min_notional=1.0, fee_rate=0.0025,
                 revenge_lock_s=86400, daily_loss_pct=0.10, min_score=0.60)

T0 = 1_700_000_000.0
DAY = 86_400.0


def outcomes(ds):
    return [(d.outcome, d.code) for d in ds]


class EntryRules(unittest.TestCase):
    def setUp(self):
        self.cfg = CFG
        self.book = new_book(self.cfg)

    def test_sizing_and_cash(self):
        book, ds = enter(self.cfg, self.book, "BTC/USD", 100.0, 0.90, T0)
        self.assertEqual(outcomes(ds), [("buy", "entry")])
        pos = book.positions["BTC/USD"]
        self.assertAlmostEqual(pos.qty * 100.0, 4.00)  # 40% of $10 at full conviction
        self.assertAlmostEqual(book.cash, 10.0 - 4.0 * 1.0025)
        self.assertEqual(audit(self.cfg, book), [])

    def test_conviction_tiers(self):
        for score, expected in ((0.90, 4.00), (0.78, 3.00), (0.65, 2.00)):
            book, _ = enter(self.cfg, self.book, "ETH/USD", 50.0, score, T0)
            self.assertAlmostEqual(book.positions["ETH/USD"].qty * 50.0, expected)

    def test_reject_low_score(self):
        book, ds = enter(self.cfg, self.book, "ETH/USD", 50.0, 0.59, T0)
        self.assertEqual(outcomes(ds), [("reject", "min_score")])
        self.assertEqual(book.positions, {})

    def test_no_add(self):
        book, _ = enter(self.cfg, self.book, "ETH/USD", 50.0, 0.9, T0)
        book2, ds = enter(self.cfg, book, "ETH/USD", 49.0, 0.9, T0 + 60)
        self.assertEqual(outcomes(ds), [("skip", "no_add")])
        self.assertEqual(book2.positions, book.positions)

    def test_max_positions(self):
        book = self.book
        for sym in ("A", "B"):
            book, _ = enter(self.cfg, book, sym, 10.0, 0.9, T0)
        _, ds = enter(self.cfg, book, "C", 10.0, 0.9, T0)
        self.assertEqual(outcomes(ds), [("skip", "max_positions")])

    def test_min_notional_fails_closed(self):
        cfg = replace(self.cfg, min_notional=5.0)
        _, ds = enter(cfg, new_book(cfg), "BTC/USD", 100.0, 0.9, T0)
        self.assertEqual(outcomes(ds), [("skip", "min_notional")])

    def test_bad_price(self):
        for bad in (0.0, -1.0, float("nan"), float("inf")):
            _, ds = enter(self.cfg, self.book, "BTC/USD", bad, 0.9, T0)
            self.assertEqual(outcomes(ds), [("skip", "bad_price")])

    def test_bad_score_fails_closed(self):
        for bad in (float("nan"), float("inf"), float("-inf")):
            book, ds = enter(self.cfg, self.book, "BTC/USD", 100.0, bad, T0)
            self.assertEqual(outcomes(ds), [("reject", "bad_score")])
            self.assertEqual(book.positions, {})

    def test_invalid_risk_settings_are_rejected(self):
        for options in (
            {"fee_rate": -0.01},
            {"max_position_pct": 1.01},
            {"hard_stop": 0.01},
            {"mid_conviction": 0.9, "high_conviction": 0.8},
        ):
            with self.subTest(options=options), self.assertRaises(ValueError):
                replace(self.cfg, **options)


class ExitRules(unittest.TestCase):
    def setUp(self):
        self.cfg = CFG
        self.book, _ = enter(self.cfg, new_book(self.cfg), "SOL/USD", 100.0, 0.9, T0)

    def test_hard_stop_and_revenge_lock(self):
        book, ds = mark(self.cfg, self.book, {"SOL/USD": 93.9}, T0 + 60)
        self.assertEqual(outcomes(ds), [("stop", "stop")])
        self.assertEqual(book.positions, {})
        self.assertLess(book.closed[0].pnl_usd, 0)
        _, ds = enter(self.cfg, book, "SOL/USD", 94.0, 0.9, T0 + 3600)
        self.assertEqual(outcomes(ds), [("skip", "revenge_lock")])
        book2, ds = enter(self.cfg, book, "SOL/USD", 94.0, 0.9, T0 + 60 + self.cfg.revenge_lock_s + 1)
        self.assertEqual(outcomes(ds), [("buy", "entry")])
        self.assertEqual(audit(self.cfg, book2), [])

    def test_exact_stop_line_triggers(self):
        book, ds = mark(self.cfg, self.book, {"SOL/USD": 94.0}, T0 + 60)  # exactly -6%
        self.assertEqual(outcomes(ds), [("stop", "stop")])

    def test_trail_not_before_arm(self):
        book, ds = mark(self.cfg, self.book, {"SOL/USD": 111.0}, T0 + 60)  # +11%
        self.assertEqual(ds, [])
        self.assertFalse(book.positions["SOL/USD"].trail_armed)
        book, ds = mark(self.cfg, book, {"SOL/USD": 104.0}, T0 + 120)  # falls back, no trail exit
        self.assertEqual(ds, [])
        self.assertIn("SOL/USD", book.positions)

    def test_trail_arms_ratchets_and_exits_in_profit(self):
        book, ds = mark(self.cfg, self.book, {"SOL/USD": 113.0}, T0 + 60)
        self.assertEqual(outcomes(ds), [("arm", "trail_arm")])
        self.assertAlmostEqual(book.positions["SOL/USD"].trail_stop, 0.07)
        book, ds = mark(self.cfg, book, {"SOL/USD": 120.0}, T0 + 120)  # ratchet to 0.14
        self.assertAlmostEqual(book.positions["SOL/USD"].trail_stop, 0.14)
        book, ds = mark(self.cfg, book, {"SOL/USD": 115.0}, T0 + 180)  # +15% > stop, holds
        self.assertEqual(ds, [])
        self.assertAlmostEqual(book.positions["SOL/USD"].trail_stop, 0.14)  # never loosens
        book, ds = mark(self.cfg, book, {"SOL/USD": 113.9}, T0 + 240)  # +13.9% <= 14%
        self.assertEqual(outcomes(ds), [("trail", "trail")])
        self.assertGreater(book.closed[0].pnl_usd, 0)
        self.assertEqual(book.revenge_until, {})  # winners do not lock
        self.assertEqual(audit(self.cfg, book), [])

    def test_missing_price_leaves_position_alone(self):
        book, ds = mark(self.cfg, self.book, {}, T0 + 60)
        self.assertEqual(ds, [])
        self.assertEqual(book.positions, self.book.positions)
        book, ds = mark(self.cfg, self.book, {"SOL/USD": float("nan")}, T0 + 60)
        self.assertEqual(ds, [])

    def test_flatten(self):
        book, _ = enter(self.cfg, self.book, "ETH/USD", 50.0, 0.9, T0)
        book, ds = flatten(self.cfg, book, {"SOL/USD": 101.0}, T0 + 60)  # ETH falls back to last mark
        self.assertEqual(book.positions, {})
        self.assertEqual({d.outcome for d in ds}, {"flatten"})
        self.assertEqual(audit(self.cfg, book), [])


class DailyLossHalt(unittest.TestCase):
    def test_halt_blocks_entries_but_exits_run_and_next_day_resets(self):
        cfg = replace(CFG, daily_loss_pct=0.02, max_positions=3)  # $0.20 limit on $10
        book = new_book(cfg)
        book, _ = enter(cfg, book, "A", 100.0, 0.9, T0)
        book, _ = enter(cfg, book, "B", 100.0, 0.9, T0)
        book, ds = mark(cfg, book, {"A": 90.0, "B": 100.0}, T0 + 60)  # A stops, B fine
        self.assertIn(("halt", "daily_loss"), outcomes(ds))
        self.assertIsNotNone(book.halted)
        _, ds = enter(cfg, book, "C", 10.0, 0.9, T0 + 120)
        self.assertEqual(outcomes(ds), [("skip", "halted")])
        book, ds = mark(cfg, book, {"B": 90.0}, T0 + 180)  # exits still run while halted
        self.assertEqual(outcomes(ds)[0], ("stop", "stop"))
        self.assertEqual(book.positions, {})
        book, ds = enter(cfg, book, "C", 10.0, 0.9, T0 + DAY + 120)  # new UTC day
        self.assertEqual(outcomes(ds), [("buy", "entry")])
        self.assertIsNone(book.halted)


class Audit(unittest.TestCase):
    def test_detects_tampering(self):
        cfg = CFG
        book, _ = enter(cfg, new_book(cfg), "BTC/USD", 100.0, 0.9, T0)
        self.assertEqual(audit(cfg, book), [])
        self.assertTrue(any("reconcile" in p for p in audit(cfg, replace(book, cash=book.cash + 5))))
        fat = replace(book.positions["BTC/USD"], entry_pct=0.9)
        self.assertTrue(any("sized" in p for p in audit(cfg, replace(book, positions={"BTC/USD": fat}))))

    def test_random_walk_never_breaks_invariants(self):
        rng = random.Random(7)
        cfg = replace(CFG, max_positions=3)
        book = new_book(cfg)
        symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD"]
        prices = {s: 100.0 for s in symbols}
        now = T0
        for _ in range(3000):
            now += 300
            for s in symbols:
                prices[s] = max(0.01, prices[s] * (1 + rng.gauss(0, 0.02)))
            book, _ = mark(cfg, book, prices, now)
            s = rng.choice(symbols)
            book, _ = enter(cfg, book, s, prices[s], rng.uniform(0.4, 1.0), now)
            self.assertEqual(audit(cfg, book), [], msg=f"step at {now}")
        self.assertGreater(len(book.closed), 20)  # the walk actually traded
        self.assertGreater(equity(book), 0)


if __name__ == "__main__":
    unittest.main()
