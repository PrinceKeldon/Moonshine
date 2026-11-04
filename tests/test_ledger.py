import unittest

from bot.ledger import Decision, Ledger
from bot.risk import RiskConfig, enter, mark, new_book

T0 = 1_700_000_000.0


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()

    def test_record_and_read_back(self):
        did = self.ledger.record(Decision(T0, "BTC/USD", "buy", "entry", "Bought.", 0.9, 100.0, {"size": 4.0}))
        self.assertEqual(did, 1)
        row = self.ledger.recent_decisions()[0]
        self.assertEqual((row["symbol"], row["outcome"], row["meta"]), ("BTC/USD", "buy", {"size": 4.0}))
        self.assertEqual(self.ledger.due_counterfactuals(T0 + 10**7), [])  # buys are not watched

    def test_counterfactual_cycle_and_gate_report(self):
        self.ledger.record(Decision(T0, "ETH/USD", "reject", "min_score", "Score 0.5.", 0.5, 100.0))
        self.ledger.record(Decision(T0, "SOL/USD", "reject", "min_score", "Score 0.4.", 0.4, 50.0))
        self.assertEqual(self.ledger.due_counterfactuals(T0 + 3599), [])
        due = self.ledger.due_counterfactuals(T0 + 3600)
        self.assertEqual(len(due), 2)
        prices = {"ETH/USD": 110.0, "SOL/USD": 45.0}
        for row in due:
            self.ledger.resolve_counterfactual(row["id"], prices[row["symbol"]], T0 + 3600)
        report = self.ledger.gate_report()
        self.assertEqual(len(report), 1)
        r = report[0]
        self.assertEqual((r["code"], r["horizon_s"], r["n"]), ("min_score", 3600, 2))
        self.assertAlmostEqual(r["avg_pct"], (0.10 + -0.10) / 2)
        self.assertAlmostEqual(r["share_up"], 0.5)
        self.assertEqual(self.ledger.due_counterfactuals(T0 + 3600), [])  # resolved ones drop out
        self.assertEqual(len(self.ledger.due_counterfactuals(T0 + 86_400)), 2)  # 24h checks remain

    def test_late_checks_can_be_excluded(self):
        self.ledger.record(Decision(T0, "ETH/USD", "skip", "revenge_lock", "Locked.", 0.9, 100.0), horizons=(3600,))
        row = self.ledger.due_counterfactuals(T0 + 3600)[0]
        self.ledger.resolve_counterfactual(row["id"], 120.0, T0 + 3600 + 7200)  # two hours late
        self.assertEqual(len(self.ledger.gate_report()), 1)
        self.assertEqual(self.ledger.gate_report(max_lateness_s=600), [])

    def test_engine_to_ledger_flow_and_recap(self):
        cfg = RiskConfig(start_cash=10.0, max_position_pct=0.40, min_notional=1.0, fee_rate=0.0025, min_score=0.60)
        book = new_book(cfg)
        book, ds = enter(cfg, book, "SOL/USD", 100.0, 0.9, T0)
        self.ledger.record_many(ds)
        _, ds2 = enter(cfg, book, "SOL/USD", 99.0, 0.9, T0 + 60)  # no_add skip
        self.ledger.record_many(ds2)
        book, ds3 = mark(cfg, book, {"SOL/USD": 93.0}, T0 + 120)
        self.ledger.record_many(ds3)
        for t in book.closed:
            self.ledger.record_trade(t)
        summary = self.ledger.trade_summary()
        self.assertEqual((summary["trades"], summary["wins"], summary["losses"]), (1, 0, 1))
        self.assertLess(summary["pnl_usd"], 0)
        text = self.ledger.recap(T0 - 1, T0 + 600, 10.0, 9.7)
        self.assertIn("Buys 1", text)
        self.assertIn("stops 1", text)
        self.assertIn("no_add x1", text)
        self.assertIn("-3.0%", text)


if __name__ == "__main__":
    unittest.main()
