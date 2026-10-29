"""Moonshine risk engine.

Pure functions over an immutable ``Book``: nothing here touches the network, the
clock or Telegram. Callers pass in prices and timestamps and get back a new book
plus ``Decision`` rows for the ledger. Positions are keyed by token mint
(base58 is case-sensitive: never lowercase a mint).

Rules (same as the TypeScript desk, now in one place for the Python bot):
  * hard stop; trail arms only after a gain, then gives back a fixed amount
  * never add to an open position (no averaging down)
  * revenge lock: no re-entry on a mint for a while after a losing exit
  * max open positions, per-position cap as a share of equity
  * daily loss halt: blocks new entries, exits keep running
  * write-off: a position whose price disappears is closed at zero, not forgotten
  * fail closed: bad prices and sub-minimum tickets are skipped, never forced

``paper_fill`` models slippage from pool depth, so paper results are not rosier
than a constant-product pool would allow.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import asdict, dataclass, field, fields, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

from bot.ledger import Decision

EPS = 1e-9
ExitFill = Callable[[str, float], float]  # (mint, mark_price) -> price actually received


@dataclass(frozen=True)
class RiskConfig:
    start_cash: float = 1000.0  # USD bankroll the book models; set it to what you really risk
    max_positions: int = 4
    max_position_pct: float = 0.08  # share of equity per name at full conviction
    min_notional: float = 25.0  # below this a ticket is not worth the fees
    fee_rate: float = 0.003  # per side, covers DEX + bot fee estimate; tune to your real costs
    hard_stop: float = -0.06
    trail_arm: float = 0.12
    trail_give: float = 0.06
    revenge_lock_s: int = 12 * 3600
    daily_loss_pct: float = 0.05  # of equity at the start of the UTC day
    min_score: float = 0.45  # same line the TS live desk uses today
    high_conviction: float = 0.84  # full cap at/above this score
    mid_conviction: float = 0.74  # 75% of cap at/above this score, else 50%

    def __post_init__(self) -> None:
        numeric = (
            "start_cash", "max_position_pct", "min_notional", "fee_rate", "hard_stop",
            "trail_arm", "trail_give", "daily_loss_pct", "min_score",
            "high_conviction", "mid_conviction",
        )
        for name in numeric:
            value = getattr(self, name)
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"risk.{name} must be a finite number")
        if self.start_cash <= 0:
            raise ValueError("risk.start_cash must be greater than zero")
        if not isinstance(self.max_positions, int) or isinstance(self.max_positions, bool) or self.max_positions < 1:
            raise ValueError("risk.max_positions must be a positive integer")
        if not 0 < self.max_position_pct <= 1:
            raise ValueError("risk.max_position_pct must be in (0, 1]")
        if self.min_notional <= 0:
            raise ValueError("risk.min_notional must be greater than zero")
        if self.fee_rate < 0:
            raise ValueError("risk.fee_rate cannot be negative")
        if not -1 < self.hard_stop < 0:
            raise ValueError("risk.hard_stop must be between -1 and 0")
        if self.trail_arm <= 0 or not 0 <= self.trail_give < self.trail_arm:
            raise ValueError("risk.trail_give must be non-negative and below risk.trail_arm")
        if not isinstance(self.revenge_lock_s, int) or isinstance(self.revenge_lock_s, bool) or self.revenge_lock_s < 0:
            raise ValueError("risk.revenge_lock_s must be a non-negative integer")
        if not 0 < self.daily_loss_pct <= 1:
            raise ValueError("risk.daily_loss_pct must be in (0, 1]")
        if not 0 <= self.min_score <= 1:
            raise ValueError("risk.min_score must be in [0, 1]")
        if not 0 <= self.mid_conviction <= self.high_conviction <= 1:
            raise ValueError("risk conviction thresholds must satisfy 0 <= mid <= high <= 1")

    @classmethod
    def from_dict(cls, d: Mapping[str, Any] | None) -> "RiskConfig":
        names = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in (d or {}).items() if k in names})


@dataclass(frozen=True)
class Position:
    symbol: str  # the mint
    entry_price: float
    price: float
    qty: float
    cost: float  # cash paid including entry fee
    entry_pct: float  # ticket / equity at entry
    opened_at: float
    score: float
    label: str = ""  # ticker for humans
    peak_pnl: float = 0.0
    trail_armed: bool = False
    trail_stop: float | None = None

    @property
    def pnl_pct(self) -> float:
        return self.price / self.entry_price - 1.0


@dataclass(frozen=True)
class ClosedTrade:
    symbol: str
    opened_at: float
    closed_at: float
    entry_price: float
    exit_price: float
    qty: float
    cost: float
    proceeds: float
    pnl_usd: float
    pnl_pct: float  # net of fees, on cost
    peak_pnl: float  # best mark-to-entry gain seen while open
    exit_kind: str  # stop | trail | flatten | writeoff
    entry_pct: float
    score: float


@dataclass(frozen=True)
class Book:
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)
    closed: tuple[ClosedTrade, ...] = ()
    revenge_until: dict[str, float] = field(default_factory=dict)
    day_key: str = ""
    day_start_equity: float = 0.0
    day_pnl: float = 0.0
    halted: str | None = None


def new_book(cfg: RiskConfig) -> Book:
    return Book(cash=cfg.start_cash, day_start_equity=cfg.start_cash)


def equity(book: Book) -> float:
    """Cash plus open positions marked at last price (before exit fee)."""
    return book.cash + sum(p.qty * p.price for p in book.positions.values())


def _day(now: float) -> str:
    return datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%d")


def roll_day(book: Book, now: float) -> Book:
    key = _day(now)
    if key == book.day_key:
        return book
    return replace(book, day_key=key, day_start_equity=equity(book), day_pnl=0.0, halted=None)


def paper_fill(price: float, side: str, notional: float, liquidity_usd: float,
               slippage_bps: float = 100.0, impact_factor: float = 1.0) -> float:
    """Price you would realistically get. Base slippage plus pool impact.

    For a constant-product pool with total liquidity L (both sides, USD), swapping
    ``notional`` moves your average price by about 2*notional/L. Unknown or zero
    liquidity is treated as a 10% hit. Total slippage is capped at 50%.
    """
    if not (price > 0 and math.isfinite(price)):
        return price
    if liquidity_usd and liquidity_usd > 0:
        impact = 2.0 * max(notional, 0.0) / liquidity_usd * impact_factor
    else:
        impact = 0.10
    slip = min(slippage_bps / 1e4 + impact, 0.50)
    return price * (1.0 + slip) if side == "buy" else price * (1.0 - slip)


def size_ticket(cfg: RiskConfig, book: Book, score: float) -> float:
    """Dollar ticket for a new entry, floored to cents. Never above the cap,
    never above what cash can pay for including the fee."""
    cap = equity(book) * cfg.max_position_pct
    mult = 1.0 if score >= cfg.high_conviction else 0.75 if score >= cfg.mid_conviction else 0.5
    size = min(cap * mult, book.cash / (1.0 + cfg.fee_rate))
    return math.floor(max(size, 0.0) * 100) / 100


def check_entry(cfg: RiskConfig, book: Book, symbol: str, score: float, now: float,
                name: str | None = None) -> tuple[str, str, str] | None:
    """None if the entry may proceed, else (outcome, code, reason)."""
    name = name or symbol
    if book.halted:
        return ("skip", "halted", f"No entry on {name}. {book.halted}")
    if not isinstance(score, (int, float)) or not math.isfinite(score):
        return ("reject", "bad_score", f"No trade on {name}. Score must be a finite number.")
    if score < cfg.min_score:
        return ("reject", "min_score", f"No trade on {name}. Score {score:.2f} is under {cfg.min_score:.2f}.")
    if symbol in book.positions:
        return ("skip", "no_add", f"No trade on {name}. Already on the book; adding would average.")
    lock = book.revenge_until.get(symbol)
    if lock is not None and now < lock:
        mins = (lock - now) / 60
        return ("skip", "revenge_lock", f"No trade on {name}. Revenge lock for another {mins:.0f} min after a losing exit.")
    if len(book.positions) >= cfg.max_positions:
        return ("skip", "max_positions", f"No trade on {name}. Book limit is {cfg.max_positions} names.")
    return None


def enter(cfg: RiskConfig, book: Book, symbol: str, fill_price: float, score: float, now: float,
          label: str | None = None) -> tuple[Book, list[Decision]]:
    """Open a position at ``fill_price`` (the price you pay after slippage, so stops
    are measured from what you actually paid, not from the quote you scored on)."""
    name = label or symbol
    book = roll_day(book, now)
    if not (isinstance(fill_price, (int, float)) and math.isfinite(fill_price) and fill_price > 0):
        return book, [Decision(now, symbol, "skip", "bad_price", f"No trade on {name}. No usable price.", score, None)]
    block = check_entry(cfg, book, symbol, score, now, name)
    if block:
        outcome, code, reason = block
        return book, [Decision(now, symbol, outcome, code, reason, score, fill_price)]
    size = size_ticket(cfg, book, score)
    if size < cfg.min_notional:
        reason = f"No trade on {name}. Ticket ${size:.2f} is under the ${cfg.min_notional:.2f} minimum."
        return book, [Decision(now, symbol, "skip", "min_notional", reason, score, fill_price)]
    eq = equity(book)
    cost = size * (1.0 + cfg.fee_rate)
    pos = Position(
        symbol=symbol, entry_price=fill_price, price=fill_price, qty=size / fill_price, cost=cost,
        entry_pct=size / eq, opened_at=now, score=score, label=label or "",
    )
    new = replace(book, cash=book.cash - cost, positions={**book.positions, symbol: pos})
    reason = (
        f"Bought ${size:.2f} of {name}, {size / eq:.1%} of ${eq:.2f}. Score {score:.2f}. "
        f"Stop {cfg.hard_stop:.0%}, trail arms at {cfg.trail_arm:+.0%}."
    )
    meta = {"size": size, "cost": cost, "entry_pct": size / eq, "label": label or ""}
    return new, [Decision(now, symbol, "buy", "entry", reason, score, fill_price, meta)]


def close(cfg: RiskConfig, book: Book, symbol: str, exit_price: float, now: float, kind: str,
          reason: str) -> tuple[Book, list[Decision]]:
    """Close a position at ``exit_price`` (the price you actually receive)."""
    pos = book.positions[symbol]
    proceeds = pos.qty * exit_price * (1.0 - cfg.fee_rate) if exit_price > 0 else 0.0
    pnl = proceeds - pos.cost
    trade = ClosedTrade(
        symbol=symbol, opened_at=pos.opened_at, closed_at=now, entry_price=pos.entry_price,
        exit_price=exit_price, qty=pos.qty, cost=pos.cost, proceeds=proceeds, pnl_usd=pnl,
        pnl_pct=pnl / pos.cost, peak_pnl=pos.peak_pnl, exit_kind=kind, entry_pct=pos.entry_pct,
        score=pos.score,
    )
    revenge = dict(book.revenge_until)
    if pnl < 0:
        revenge[symbol] = now + cfg.revenge_lock_s
    day_pnl = book.day_pnl + pnl
    halted = book.halted
    decisions = [
        Decision(now, symbol, kind, kind, reason, pos.score, exit_price,
                 {"pnl_usd": pnl, "pnl_pct": trade.pnl_pct, "peak_pnl": pos.peak_pnl, "label": pos.label}),
    ]
    limit = cfg.daily_loss_pct * book.day_start_equity
    if halted is None and day_pnl <= -limit:
        halted = f"Halted. Day loss {day_pnl:.2f} USD hit the {limit:.2f} USD limit. Exits still run."
        decisions.append(Decision(now, symbol, "halt", "daily_loss", halted, None, exit_price))
    new = replace(
        book,
        cash=book.cash + proceeds,
        positions={k: v for k, v in book.positions.items() if k != symbol},
        closed=book.closed + (trade,),
        revenge_until=revenge,
        day_pnl=day_pnl,
        halted=halted,
    )
    return new, decisions


def mark(cfg: RiskConfig, book: Book, prices: Mapping[str, float], now: float,
         exit_price: ExitFill | None = None) -> tuple[Book, list[Decision]]:
    """Update marks, arm/ratchet trails, and close anything through its stop.

    Stops are judged on the mark. ``exit_price(mint, mark)`` says what you would
    really receive (slippage, impact); without it exits fill at the mark.
    Symbols with a missing or invalid price are left untouched this pass.
    """
    book = roll_day(book, now)
    decisions: list[Decision] = []
    for symbol in list(book.positions):
        price = prices.get(symbol)
        if price is None or not math.isfinite(price) or price <= 0:
            continue
        pos = book.positions[symbol]
        name = pos.label or symbol
        pnl = price / pos.entry_price - 1.0
        peak = max(pos.peak_pnl, pnl)
        armed, stop = pos.trail_armed, pos.trail_stop
        if not armed and peak >= cfg.trail_arm - EPS:
            armed, stop = True, peak - cfg.trail_give
            decisions.append(Decision(
                now, symbol, "arm", "trail_arm",
                f"Trail armed on {name}. Peak {peak:+.1%} cleared {cfg.trail_arm:+.0%}. Stop at {stop:+.1%}.",
                pos.score, price, {"label": pos.label},
            ))
        elif armed and stop is not None:
            stop = max(stop, peak - cfg.trail_give)
        pos = replace(pos, price=price, peak_pnl=peak, trail_armed=armed, trail_stop=stop)
        book = replace(book, positions={**book.positions, symbol: pos})
        fill = exit_price(symbol, price) if exit_price else price
        if pnl <= cfg.hard_stop + EPS:
            reason = f"Hard stop. {name} marked {pnl:+.1%}, through {cfg.hard_stop:.0%}. No add on the way down."
            book, ds = close(cfg, book, symbol, fill, now, "stop", reason)
            decisions += ds
        elif armed and stop is not None and pnl <= stop + EPS:
            reason = f"Trail stop. {name} peaked {peak:+.1%}, stop was {stop:+.1%}, marked {pnl:+.1%}."
            book, ds = close(cfg, book, symbol, fill, now, "trail", reason)
            decisions += ds
    return book, decisions


def write_off(cfg: RiskConfig, book: Book, symbol: str, now: float, reason: str) -> tuple[Book, list[Decision]]:
    """Close a position at zero: its price has vanished, so it is treated as a total loss."""
    return close(cfg, book, symbol, 0.0, now, "writeoff", reason)


def flatten(cfg: RiskConfig, book: Book, prices: Mapping[str, float], now: float,
            exit_price: ExitFill | None = None) -> tuple[Book, list[Decision]]:
    """Kill switch: close everything, falling back to the last mark for missing prices."""
    decisions: list[Decision] = []
    for symbol in list(book.positions):
        pos = book.positions[symbol]
        price = prices.get(symbol)
        if price is None or not math.isfinite(price) or price <= 0:
            price = pos.price
        fill = exit_price(symbol, price) if exit_price else price
        book, ds = close(cfg, book, symbol, fill, now, "flatten", f"Flat {pos.label or symbol}. Closed by operator.")
        decisions += ds
    return book, decisions


def audit(cfg: RiskConfig, book: Book) -> list[str]:
    """Invariant check. An empty list means the book obeys its own rules."""
    problems: list[str] = []
    if len(book.positions) > cfg.max_positions:
        problems.append(f"{len(book.positions)} positions open, limit is {cfg.max_positions}.")
    for pos in book.positions.values():
        name = pos.label or pos.symbol
        if pos.entry_pct > cfg.max_position_pct + 1e-6:
            problems.append(f"{name} sized {pos.entry_pct:.1%}, cap is {cfg.max_position_pct:.1%}.")
        if pos.score < cfg.min_score:
            problems.append(f"{name} entered at score {pos.score:.2f}.")
        if pos.trail_armed and pos.peak_pnl < cfg.trail_arm - 1e-9:
            problems.append(f"{name} trail armed before {cfg.trail_arm:+.0%}.")
        if pos.pnl_pct <= cfg.hard_stop - 1e-9:
            problems.append(f"{name} still open through the hard stop ({pos.pnl_pct:+.1%}).")
    for t in book.closed:
        if t.exit_kind == "trail" and t.peak_pnl < cfg.trail_arm - 1e-9:
            problems.append(f"{t.symbol[:6]} trail exit before {cfg.trail_arm:+.0%}.")
        if t.entry_pct > cfg.max_position_pct + 1e-6:
            problems.append(f"{t.symbol[:6]} was sized {t.entry_pct:.1%}, cap is {cfg.max_position_pct:.1%}.")
    if book.cash < -1e-6:
        problems.append("Cash went negative.")
    # cash + open cost - realized pnl must equal what we started with
    drift = (book.cash + sum(p.cost for p in book.positions.values())
             - sum(t.pnl_usd for t in book.closed) - cfg.start_cash)
    if abs(drift) > 0.01:
        problems.append(f"Cash does not reconcile with trades (off by {drift:+.4f} USD).")
    return problems


# ---- persistence ----------------------------------------------------------

def book_to_dict(book: Book) -> dict[str, Any]:
    return {
        "cash": book.cash,
        "positions": {k: asdict(v) for k, v in book.positions.items()},
        "closed": [asdict(t) for t in book.closed],
        "revenge_until": dict(book.revenge_until),
        "day_key": book.day_key,
        "day_start_equity": book.day_start_equity,
        "day_pnl": book.day_pnl,
        "halted": book.halted,
    }


def book_from_dict(d: Mapping[str, Any]) -> Book:
    return Book(
        cash=float(d["cash"]),
        positions={k: Position(**v) for k, v in d.get("positions", {}).items()},
        closed=tuple(ClosedTrade(**t) for t in d.get("closed", [])),
        revenge_until={k: float(v) for k, v in d.get("revenge_until", {}).items()},
        day_key=d.get("day_key", ""),
        day_start_equity=float(d.get("day_start_equity", 0.0)),
        day_pnl=float(d.get("day_pnl", 0.0)),
        halted=d.get("halted"),
    )


def save_book(book: Book, path: str | Path) -> None:
    """Atomic write: a crash mid-save never leaves a half-written book."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(book_to_dict(book), indent=1), encoding="utf-8")
    os.replace(tmp, path)


def load_book(cfg: RiskConfig, path: str | Path) -> Book:
    """Load the saved book, or start fresh if there is none. A file that exists but
    cannot be read raises: silently resetting would forget open positions."""
    path = Path(path)
    if not path.exists():
        return new_book(cfg)
    try:
        return book_from_dict(json.loads(path.read_text(encoding="utf-8")))
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"Cannot read book file {path}: {e}. Fix or move it; refusing to start from empty.") from e
