import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from bot.agent import AgentConfig, apply_agent, evaluate_position
from bot.desk import Desk
from bot.risk import RiskConfig, enter, new_book

MINT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"
T0 = 1_700_000_000.0


class Clock:
    def __init__(self):
        self.now = T0

    def __call__(self):
        return self.now


class FakeDS:
    def __init__(self):
        self.prices = {
            "So11111111111111111111111111111111111111112": (150.0, 5_000_000.0),
        }

    async def get_token_pairs(self, mint):
        if mint not in self.prices:
            return []
        price, liq = self.prices[mint]
        return [{
            "chainId": "solana",
            "priceUsd": str(price),
            "liquidity": {"usd": liq},
            "baseToken": {"address": mint},
        }]

    @staticmethod
    def normalize_pair(pair):
        return {
            "price_usd": float(pair["priceUsd"]),
            "liquidity_usd": float(pair["liquidity"]["usd"]),
        }


class FakeTG:
    dry_run = True

    def __init__(self):
        self.sells = []

    async def buy(self, mint, sol_amount=None):
        pass

    async def sell(self, mint, label, reason):
        self.sells.append((mint, label, reason))

    async def notify(self, title, body):
        pass


class AgentRules(unittest.TestCase):
    def setUp(self):
        self.rc = RiskConfig(
            start_cash=1000,
            min_notional=1,
            max_position_pct=0.2,
            fee_rate=0,
            trail_arm=2,
            take_profit_1=0,
            take_profit_2=0,
            max_hold_seconds=0,
        )
        self.book, _ = enter(self.rc, new_book(self.rc), MINT, 100, 0.9, T0, "MOON")
        self.pos = self.book.positions[MINT]
        self.ac = AgentConfig()

    def test_liquidity_floor_flattens(self):
        actions = evaluate_position(self.ac, self.rc, self.pos, 100, 2499, 100_000, T0)
        self.assertEqual(actions[0][:2], ("flatten", "agent_liq"))

    def test_liquidity_collapse_relative_to_best_seen_flattens(self):
        actions = evaluate_position(self.ac, self.rc, self.pos, 100, 20_000, 100_000, T0)
        self.assertEqual(actions[0][:2], ("flatten", "agent_liq"))

    def test_giveback_flattens_after_threshold(self):
        pos = replace(self.pos, peak_pnl=0.30)
        actions = evaluate_position(self.ac, self.rc, pos, 112, 50_000, 50_000, T0)
        self.assertEqual(actions[0][:2], ("flatten", "agent_giveback"))

    def test_large_peak_forces_one_scale_out(self):
        pos = replace(self.pos, peak_pnl=0.50)
        actions = evaluate_position(self.ac, self.rc, pos, 150, 50_000, 50_000, T0)
        self.assertEqual(actions[0][:2], ("scale", "agent_force_scale"))
        self.assertEqual(actions[0][3], 0.40)

        already_scaled = replace(pos, scaled_1=True)
        self.assertEqual(
            evaluate_position(self.ac, self.rc, already_scaled, 150, 50_000, 50_000, T0),
            [],
        )

    def test_time_pressure_scales_below_soft_target(self):
        rc = replace(self.rc, max_hold_seconds=1000)
        actions = evaluate_position(self.ac, rc, self.pos, 102, 50_000, 50_000, T0 + 800)
        self.assertEqual(actions[0][:2], ("scale", "agent_time_pressure"))
        self.assertEqual(actions[0][3], 0.50)

    def test_disabled_agent_has_no_actions(self):
        ac = replace(self.ac, enabled=False)
        pos = replace(self.pos, peak_pnl=0.50)
        self.assertEqual(evaluate_position(ac, self.rc, pos, 150, 50_000, 50_000, T0), [])

    def test_apply_agent_records_scale_outcome_and_updates_book(self):
        pos = replace(self.pos, peak_pnl=0.50)
        book = replace(self.book, positions={MINT: pos})
        updated, decisions = apply_agent(
            self.ac, self.rc, book, {MINT: 150}, {MINT: 50_000}, {MINT: 50_000}, T0
        )
        self.assertEqual([d.outcome for d in decisions], ["agent_scale"])
        self.assertEqual(decisions[0].code, "agent_force_scale")
        self.assertTrue(updated.positions[MINT].scaled_1)
        self.assertAlmostEqual(updated.positions[MINT].qty, pos.qty * 0.60)

    def test_apply_agent_records_flatten_outcome(self):
        pos = replace(self.pos, peak_pnl=0.30)
        book = replace(self.book, positions={MINT: pos})
        updated, decisions = apply_agent(
            self.ac, self.rc, book, {MINT: 112}, {MINT: 50_000}, {MINT: 50_000}, T0
        )
        self.assertEqual([d.outcome for d in decisions], ["agent_flatten"])
        self.assertEqual(updated.positions, {})


class DeskAgentWiring(unittest.IsolatedAsyncioTestCase):
    async def _make_desk(self, tmp):
        self.clock = Clock()
        self.ds = FakeDS()
        self.ds.prices[MINT] = (1.0, 100_000.0)
        self.tg = FakeTG()
        cfg = {
            "risk": {
                "start_cash": 1000,
                "max_position_pct": 0.1,
                "min_notional": 1,
                "fee_rate": 0,
                "slippage_bps": 0,
                "impact_factor": 0,
                "trail_arm": 2,
                "take_profit_1": 0,
                "take_profit_2": 0,
                "max_hold_seconds": 0,
                "stale_exit_s": 600,
            },
            "agent": {"force_scale_peak": 0.40},
            "ledger": {
                "db_file": str(Path(tmp) / "ledger.db"),
                "book_file": str(Path(tmp) / "book.json"),
                "horizons_s": [3600],
            },
        }
        self.desk = Desk(cfg, self.tg, clock=self.clock)
        await self.desk.consider(
            {"mint": MINT, "symbol": "MOON", "price_usd": 1.0, "liquidity_usd": 100_000},
            0.9,
            self.ds,
        )

    async def test_agent_scale_runs_after_risk_and_notifies_sell(self):
        with tempfile.TemporaryDirectory() as tmp:
            await self._make_desk(tmp)
            await self.desk.mark_open(self.ds)
            self.assertEqual(self.desk.best_liq[MINT], 100_000)

            self.ds.prices[MINT] = (1.5, 100_000.0)
            await self.desk.mark_open(self.ds)
            self.assertTrue(self.desk.book.positions[MINT].scaled_1)
            self.assertEqual([sell[0] for sell in self.tg.sells], [MINT])
            self.assertIn("agent_scale", {row["outcome"] for row in self.desk.ledger.recent_decisions()})
            self.assertEqual(self.desk.best_liq[MINT], 100_000)
            self.desk.close()

    async def test_liquidity_collapse_uses_best_seen_and_cleans_closed_mint(self):
        with tempfile.TemporaryDirectory() as tmp:
            await self._make_desk(tmp)
            await self.desk.mark_open(self.ds)
            self.ds.prices[MINT] = (1.0, 20_000.0)
            await self.desk.mark_open(self.ds)

            self.assertEqual(self.desk.book.positions, {})
            self.assertEqual(self.desk.best_liq, {})
            self.assertEqual([sell[0] for sell in self.tg.sells], [MINT])
            self.assertIn(
                "agent_flatten",
                {row["outcome"] for row in self.desk.ledger.recent_decisions()},
            )
            self.desk.close()


if __name__ == "__main__":
    unittest.main()
