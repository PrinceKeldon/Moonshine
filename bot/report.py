"""Paper-trading summary report for Moonshine.

Usage:
    python -m bot.report
    python -m bot.report --days 7
    python -m bot.report --all
"""
from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bot.config import load_config
from bot.ledger import Ledger
from bot.risk import equity, load_book, RiskConfig

ROOT = Path(__file__).resolve().parent.parent


def _pct(n: float) -> str:
    return f"{n:+.1%}" if n else "0.0%"


def _usd(n: float) -> str:
    return f"${n:+,.2f}" if n else "$0.00"


def paper_report(
    ledger: Ledger,
    book_path: Path | str,
    risk_cfg: RiskConfig,
    since: float = 0.0,
    until: float | None = None,
) -> str:
    """Build a human-readable paper-trading summary."""
    until = until if until is not None else time.time()
    book = load_book(risk_cfg, book_path)
    eq = equity(book)

    with ledger._lock:
        trades = ledger._db.execute(
            "SELECT * FROM trades WHERE closed_at > ? AND closed_at <= ? ORDER BY closed_at",
            (since, until),
        ).fetchall()

    rows = [dict(t) for t in trades]
    pnls = [r["pnl_usd"] for r in rows]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    # Exit kind breakdown
    by_kind: dict[str, list[float]] = {}
    for r in rows:
        by_kind.setdefault(r["exit_kind"], []).append(r["pnl_usd"])

    # Scale-out stats
    scale1 = by_kind.get("scale1", [])
    scale2 = by_kind.get("scale2", [])
    full_exits = [r for r in rows if r["exit_kind"] not in ("scale1", "scale2")]

    win_rate = (len(wins) / len(pnls)) if pnls else 0.0
    avg_win = (sum(wins) / len(wins)) if wins else 0.0
    avg_loss = (sum(losses) / len(losses)) if losses else 0.0
    expectancy = (sum(pnls) / len(pnls)) if pnls else 0.0
    total_pnl = sum(pnls)

    # Profit factor
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf") if gross_profit > 0 else 0.0

    stamp = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []
    lines.append("=" * 52)
    lines.append("  MOONSHINE PAPER TRADING REPORT")
    lines.append("=" * 52)
    lines.append(f"  Period     : {stamp(since)} → {stamp(until)}")
    lines.append(f"  Equity     : ${eq:,.2f}  (start ${risk_cfg.start_cash:,.2f})")
    lines.append(f"  Open pos   : {len(book.positions)}")
    if book.halted:
        lines.append(f"  Status     : HALTED — {book.halted}")
    lines.append("-" * 52)

    lines.append("  CLOSED TRADES")
    lines.append(f"  Total      : {len(pnls)}")
    lines.append(f"  Wins       : {len(wins)}  ({win_rate:.0%})")
    lines.append(f"  Losses     : {len(losses)}")
    lines.append(f"  Realized   : {_usd(total_pnl)}")
    lines.append(f"  Best       : {_usd(max(pnls) if pnls else 0)}")
    lines.append(f"  Worst      : {_usd(min(pnls) if pnls else 0)}")
    lines.append(f"  Avg win    : {_usd(avg_win)}")
    lines.append(f"  Avg loss   : {_usd(avg_loss)}")
    lines.append(f"  Expectancy : {_usd(expectancy)} / trade")
    pf_str = f"{profit_factor:.2f}" if profit_factor != float("inf") else "∞"
    lines.append(f"  Profit fac : {pf_str}")
    lines.append("-" * 52)

    lines.append("  EXIT BREAKDOWN")
    for kind in ("scale1", "scale2", "trail", "stop", "time", "writeoff", "flatten"):
        vals = by_kind.get(kind, [])
        if not vals:
            continue
        lines.append(
            f"  {kind:<10} : {len(vals):>3} trades  {_usd(sum(vals))}  "
            f"(avg {_usd(sum(vals)/len(vals))})"
        )
    lines.append("-" * 52)

    if scale1 or scale2:
        lines.append("  SCALE-OUTS")
        if scale1:
            lines.append(f"  TP1 (+6%)  : {len(scale1)} × {_usd(sum(scale1))}")
        if scale2:
            lines.append(f"  TP2 (+10%) : {len(scale2)} × {_usd(sum(scale2))}")
        lines.append("-" * 52)

    # Open positions snapshot
    if book.positions:
        lines.append("  OPEN POSITIONS")
        for mint, pos in book.positions.items():
            label = pos.label or mint[:8]
            lines.append(
                f"  {label:<12}  {_pct(pos.pnl_pct)}  "
                f"peak {_pct(pos.peak_pnl)}  "
                f"{'trail' if pos.trail_armed else '—'}  "
                f"scaled={'1' if pos.scaled_1 else '0'}/{'2' if pos.scaled_2 else '0'}"
            )
        lines.append("-" * 52)

    # Recent full exits (last 8)
    recent_full = [r for r in reversed(rows) if r["exit_kind"] not in ("scale1", "scale2")][:8]
    if recent_full:
        lines.append("  RECENT FULL EXITS")
        for r in recent_full:
            when = datetime.fromtimestamp(r["closed_at"], timezone.utc).strftime("%m-%d %H:%M")
            lines.append(
                f"  {when}  {r['exit_kind']:<8}  {_usd(r['pnl_usd'])}  "
                f"({_pct(r['pnl_pct'])})  peak {_pct(r['peak_pnl'])}"
            )
        lines.append("-" * 52)

    lines.append("  (paper book — fills are modelled, not exchange-confirmed)")
    lines.append("=" * 52)
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Moonshine paper-trading report")
    parser.add_argument("--days", type=float, default=1.0, help="Look-back window in days (default 1)")
    parser.add_argument("--all", action="store_true", help="Report all history")
    parser.add_argument("--config", default=str(ROOT / "config.yaml"))
    args = parser.parse_args()

    cfg = load_config(args.config)
    lcfg = cfg.get("ledger") or {}
    rcfg = RiskConfig.from_dict(cfg.get("risk"))

    ledger = Ledger(str(lcfg.get("db_file", "data/ledger.db")))
    book_path = Path(lcfg.get("book_file", "data/book.json"))

    until = time.time()
    since = 0.0 if args.all else until - args.days * 86400

    print(paper_report(ledger, book_path, rcfg, since=since, until=until))
    ledger.close()


if __name__ == "__main__":
    main()
