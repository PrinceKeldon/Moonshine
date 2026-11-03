"""Lightweight position agent on top of the risk engine.

Rules-based only (no LLM). Runs after ``mark()`` each cycle and may:

  * force an early scale-out on large peaks that the fixed TP schedule missed
  * flatten when most of a peak has been given back but the trail has not fired yet
  * flatten when liquidity collapses under a position
  * soft time-pressure scale when the clock is almost out and PnL is still soft

Everything here is pure over book + prices + liquidity snapshots. The desk
applies the returned actions via ``close`` / ``_partial_close`` so the ledger
and Telegram paths stay the same.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, fields
from typing import Any, Mapping

from bot.ledger import Decision
from bot.risk import (
    EPS,
    Book,
    Position,
    RiskConfig,
    _partial_close,
    close,
)

# Outcomes the desk should treat like exits for Telegram sell notifications
AGENT_EXIT_OUTCOMES = frozenset({"agent_scale", "agent_flatten"})


@dataclass(frozen=True)
class AgentConfig:
    enabled: bool = True

    # Force scale if peak is high and TP1 has not fired (or we want another slice)
    force_scale_peak: float = 0.40          # peak PnL threshold
    force_scale_pct: float = 0.40           # fraction of *current* qty to sell
    force_scale_only_if_unscaled: bool = True  # require not scaled_1

    # Give-back flatten: peak was real, but most of it is gone while still above trail
    min_peak_for_giveback: float = 0.20
    max_giveback_frac: float = 0.55         # gave back >= 55% of peak gains

    # Liquidity collapse
    min_liq_usd: float = 2500.0             # absolute floor
    min_liq_frac_of_seen: float = 0.30      # vs best liq seen while we held

    # Soft time pressure (fraction of risk.max_hold_seconds)
    time_pressure_frac: float = 0.80
    soft_tp: float = 0.03                   # if below this near time limit → scale
    time_scale_pct: float = 0.50

    def __post_init__(self) -> None:
        for name in (
            "force_scale_peak", "force_scale_pct", "min_peak_for_giveback",
            "max_giveback_frac", "min_liq_usd", "min_liq_frac_of_seen",
            "time_pressure_frac", "soft_tp", "time_scale_pct",
        ):
            v = getattr(self, name)
            if not isinstance(v, (int, float)) or not math.isfinite(v):
                raise ValueError(f"agent.{name} must be a finite number")
        if not 0 < self.force_scale_pct <= 1:
            raise ValueError("agent.force_scale_pct must be in (0, 1]")
        if not 0 < self.time_scale_pct <= 1:
            raise ValueError("agent.time_scale_pct must be in (0, 1]")
        if not 0 < self.max_giveback_frac <= 1:
            raise ValueError("agent.max_giveback_frac must be in (0, 1]")
        if not 0 < self.min_liq_frac_of_seen <= 1:
            raise ValueError("agent.min_liq_frac_of_seen must be in (0, 1]")
        if not 0 < self.time_pressure_frac <= 1:
            raise ValueError("agent.time_pressure_frac must be in (0, 1]")

    @classmethod
    def from_dict(cls, d: Mapping[str, Any] | None) -> "AgentConfig":
        names = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in (d or {}).items() if k in names})


def _pnl(pos: Position, price: float) -> float:
    if pos.entry_price <= 0:
        return 0.0
    return price / pos.entry_price - 1.0


def evaluate_position(
    acfg: AgentConfig,
    rcfg: RiskConfig,
    pos: Position,
    price: float,
    liq_usd: float,
    best_liq_usd: float,
    now: float,
) -> list[tuple[str, str, str, float]]:
    """Return ordered actions for one position.

    Each action is ``(kind, code, reason, fraction)`` where kind is
    ``scale`` or ``flatten``. fraction is ignored for flatten (always 1).
    """
    if not acfg.enabled:
        return []
    if not (math.isfinite(price) and price > 0):
        return []

    name = pos.label or pos.symbol
    pnl = _pnl(pos, price)
    peak = max(pos.peak_pnl, pnl)
    actions: list[tuple[str, str, str, float]] = []

    # 1. Liquidity collapse → flatten
    if liq_usd > 0 and (
        liq_usd < acfg.min_liq_usd
        or (best_liq_usd > 0 and liq_usd < best_liq_usd * acfg.min_liq_frac_of_seen)
    ):
        reason = (
            f"Agent flatten. {name} liquidity ${liq_usd:,.0f} "
            f"(floor ${acfg.min_liq_usd:,.0f}, best seen ${best_liq_usd:,.0f})."
        )
        return [("flatten", "agent_liq", reason, 1.0)]

    # 2. Give-back protection → flatten
    if peak >= acfg.min_peak_for_giveback and peak > EPS:
        giveback = peak - pnl
        if giveback >= peak * acfg.max_giveback_frac and pnl < peak - EPS:
            reason = (
                f"Agent flatten. {name} peaked {peak:+.1%}, now {pnl:+.1%} "
                f"(gave back {giveback / peak:.0%} of peak)."
            )
            return [("flatten", "agent_giveback", reason, 1.0)]

    # 3. Force scale on large peak
    if peak >= acfg.force_scale_peak:
        if not acfg.force_scale_only_if_unscaled or not pos.scaled_1:
            reason = (
                f"Agent scale. {name} peak {peak:+.1%} cleared "
                f"{acfg.force_scale_peak:+.0%}; selling {acfg.force_scale_pct:.0%}."
            )
            actions.append(("scale", "agent_force_scale", reason, acfg.force_scale_pct))

    # 4. Soft time pressure
    if rcfg.max_hold_seconds > 0:
        held = now - pos.opened_at
        limit = rcfg.max_hold_seconds * acfg.time_pressure_frac
        if held >= limit and pnl < acfg.soft_tp:
            reason = (
                f"Agent scale. {name} held {held / 60:.1f} min "
                f"({acfg.time_pressure_frac:.0%} of time stop), PnL {pnl:+.1%} "
                f"under soft target {acfg.soft_tp:+.0%}."
            )
            actions.append(("scale", "agent_time_pressure", reason, acfg.time_scale_pct))

    return actions


def apply_agent(
    acfg: AgentConfig,
    rcfg: RiskConfig,
    book: Book,
    prices: Mapping[str, float],
    liquidity: Mapping[str, float],
    best_liquidity: Mapping[str, float],
    now: float,
    exit_price=None,
) -> tuple[Book, list[Decision]]:
    """Run the agent over every open position. Returns updated book + decisions."""
    if not acfg.enabled or not book.positions:
        return book, []

    decisions: list[Decision] = []
    for symbol in list(book.positions):
        if symbol not in book.positions:
            continue
        price = prices.get(symbol)
        if price is None or not math.isfinite(price) or price <= 0:
            continue
        pos = book.positions[symbol]
        liq = float(liquidity.get(symbol) or 0.0)
        best = float(best_liquidity.get(symbol) or liq)
        actions = evaluate_position(acfg, rcfg, pos, price, liq, best, now)
        if not actions:
            continue

        fill = exit_price(symbol, price) if exit_price else price
        for kind, code, reason, fraction in actions:
            if symbol not in book.positions:
                break
            if kind == "flatten":
                book, ds = close(rcfg, book, symbol, fill, now, "flatten", reason)
                for d in ds:
                    if d.outcome == "flatten":
                        d = Decision(
                            d.ts, d.symbol, "agent_flatten", code, d.reason,
                            d.score, d.price, {**d.meta, "agent": True},
                        )
                    decisions.append(d)
                break
            if kind == "scale":
                book, ds = _partial_close(
                    rcfg, book, symbol, fill, now, "scale1", reason, fraction
                )
                for d in ds:
                    if d.outcome == "scale1":
                        d = Decision(
                            d.ts, d.symbol, "agent_scale", code, d.reason,
                            d.score, d.price, {**d.meta, "agent": True},
                        )
                    decisions.append(d)
                break

    return book, decisions
