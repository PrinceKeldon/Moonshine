"""Decision ledger for Moonshine.

Every decision (buy, skip, reject, stop, trail, ...) is written with a machine
readable ``code`` and a human readable ``reason``. Decisions where the bot said
"no" (reject / skip / kill) also get *counterfactual* checks scheduled: the
price is re-read after each horizon so you can measure whether a gate is
killing winners or saving you from losers.

Pure stdlib (sqlite3). Safe to share across threads (single lock).
"""
from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

DEFAULT_HORIZONS: tuple[int, ...] = (3600, 24 * 3600)
WATCH_OUTCOMES = frozenset({"reject", "skip", "kill"})


@dataclass(frozen=True)
class Decision:
    ts: float
    symbol: str
    outcome: str  # buy | sell kinds: stop | trail | flatten | arm | halt | reject | skip | kill
    code: str  # stable id of the rule that fired, e.g. "min_score", "revenge_lock"
    reason: str  # sentence for humans
    score: float | None = None
    price: float | None = None
    meta: dict[str, Any] = field(default_factory=dict)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    symbol TEXT NOT NULL,
    outcome TEXT NOT NULL,
    code TEXT NOT NULL,
    reason TEXT NOT NULL,
    score REAL,
    price REAL,
    meta TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_decisions_ts ON decisions(ts);
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    opened_at REAL NOT NULL,
    closed_at REAL NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    qty REAL NOT NULL,
    cost REAL NOT NULL,
    proceeds REAL NOT NULL,
    pnl_usd REAL NOT NULL,
    pnl_pct REAL NOT NULL,
    peak_pnl REAL NOT NULL,
    exit_kind TEXT NOT NULL,
    entry_pct REAL NOT NULL,
    score REAL
);
CREATE INDEX IF NOT EXISTS idx_trades_closed ON trades(closed_at);
CREATE TABLE IF NOT EXISTS counterfactuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id INTEGER NOT NULL REFERENCES decisions(id),
    symbol TEXT NOT NULL,
    horizon_s INTEGER NOT NULL,
    base_price REAL NOT NULL,
    due_ts REAL NOT NULL,
    price_at REAL,
    pct_change REAL,
    resolved_ts REAL
);
CREATE INDEX IF NOT EXISTS idx_cf_due ON counterfactuals(resolved_ts, due_ts);
"""

_TRADE_COLS = (
    "symbol", "opened_at", "closed_at", "entry_price", "exit_price", "qty", "cost",
    "proceeds", "pnl_usd", "pnl_pct", "peak_pnl", "exit_kind", "entry_pct", "score",
)


class Ledger:
    def __init__(self, path: str = ":memory:"):
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            if path != ":memory:":
                self._db.execute("PRAGMA journal_mode=WAL")
            self._db.executescript(_SCHEMA)
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # ---- writes -----------------------------------------------------------

    def record(self, d: Decision, horizons: Sequence[int] | None = DEFAULT_HORIZONS) -> int:
        """Store a decision. Returns its id. Schedules counterfactual checks for
        "no" decisions that carry a price."""
        with self._lock:
            cur = self._db.execute(
                "INSERT INTO decisions (ts, symbol, outcome, code, reason, score, price, meta) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (d.ts, d.symbol, d.outcome, d.code, d.reason, d.score, d.price,
                 json.dumps(d.meta, default=str)),
            )
            did = int(cur.lastrowid)
            if horizons and d.outcome in WATCH_OUTCOMES and d.price and d.price > 0:
                self._db.executemany(
                    "INSERT INTO counterfactuals (decision_id, symbol, horizon_s, base_price, due_ts) "
                    "VALUES (?,?,?,?,?)",
                    [(did, d.symbol, int(h), d.price, d.ts + h) for h in horizons],
                )
            self._db.commit()
            return did

    def record_many(self, ds: Iterable[Decision], horizons: Sequence[int] | None = DEFAULT_HORIZONS) -> list[int]:
        return [self.record(d, horizons) for d in ds]

    def record_trade(self, trade: Any) -> int:
        """Store a closed trade (any dataclass with the ClosedTrade fields)."""
        row = asdict(trade)
        with self._lock:
            cur = self._db.execute(
                f"INSERT INTO trades ({','.join(_TRADE_COLS)}) VALUES ({','.join('?' * len(_TRADE_COLS))})",
                tuple(row[c] for c in _TRADE_COLS),
            )
            self._db.commit()
            return int(cur.lastrowid)

    # ---- counterfactuals --------------------------------------------------

    def due_counterfactuals(self, now: float, limit: int = 200) -> list[dict[str, Any]]:
        """Checks whose horizon has passed. Caller fetches the current price for
        each symbol and calls resolve_counterfactual()."""
        with self._lock:
            rows = self._db.execute(
                "SELECT id, decision_id, symbol, horizon_s, base_price, due_ts FROM counterfactuals "
                "WHERE resolved_ts IS NULL AND due_ts <= ? ORDER BY due_ts LIMIT ?",
                (now, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def last_ts(self, symbol: str, code: str) -> float | None:
        """Timestamp of the most recent decision for this (symbol, code), if any.
        Used to stop a token that stays in the feed from flooding the ledger."""
        with self._lock:
            row = self._db.execute(
                "SELECT MAX(ts) AS t FROM decisions WHERE symbol = ? AND code = ?", (symbol, code)
            ).fetchone()
        return row["t"] if row and row["t"] is not None else None

    def resolve_counterfactual(self, cf_id: int, price: float, now: float, dead: bool = False) -> None:
        """Store the price at the horizon. ``dead=True`` means the token no longer
        trades anywhere: record it as -100% instead of dropping it, otherwise the
        gate report only sees survivors and the gates look worse than they are."""
        if dead:
            price = 0.0
        elif not price or price <= 0:
            return
        with self._lock:
            row = self._db.execute("SELECT base_price FROM counterfactuals WHERE id=?", (cf_id,)).fetchone()
            if row is None:
                return
            pct = price / row["base_price"] - 1.0
            self._db.execute(
                "UPDATE counterfactuals SET price_at=?, pct_change=?, resolved_ts=? WHERE id=?",
                (price, pct, now, cf_id),
            )
            self._db.commit()

    def gate_report(self, min_n: int = 1, max_lateness_s: float | None = None) -> list[dict[str, Any]]:
        """Per (outcome, code, horizon): how did the names we turned away do?

        avg_pct > 0 and high share_up  -> the gate is killing winners.
        avg_pct < 0 and low share_up   -> the gate is earning its keep.
        Pass max_lateness_s to ignore checks resolved long after their horizon.
        """
        sql = (
            "SELECT d.outcome AS outcome, d.code AS code, c.horizon_s AS horizon_s, "
            "COUNT(*) AS n, AVG(c.pct_change) AS avg_pct, "
            "AVG(CASE WHEN c.pct_change > 0 THEN 1.0 ELSE 0.0 END) AS share_up, "
            "MIN(c.pct_change) AS worst_pct, MAX(c.pct_change) AS best_pct "
            "FROM counterfactuals c JOIN decisions d ON d.id = c.decision_id "
            "WHERE c.pct_change IS NOT NULL"
        )
        args: list[Any] = []
        if max_lateness_s is not None:
            sql += " AND (c.resolved_ts - c.due_ts) <= ?"
            args.append(max_lateness_s)
        sql += " GROUP BY d.outcome, d.code, c.horizon_s HAVING COUNT(*) >= ? ORDER BY d.code, c.horizon_s"
        args.append(min_n)
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [dict(r) for r in rows]

    # ---- reads ------------------------------------------------------------

    def recent_decisions(self, limit: int = 50, symbol: str | None = None) -> list[dict[str, Any]]:
        sql = "SELECT * FROM decisions"
        args: list[Any] = []
        if symbol:
            sql += " WHERE symbol = ?"
            args.append(symbol)
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        out = []
        for r in rows:
            row = dict(r)
            row["meta"] = json.loads(row["meta"] or "{}")
            out.append(row)
        return out

    def trade_summary(self, since: float = 0.0, until: float = float("inf")) -> dict[str, Any]:
        with self._lock:
            rows = self._db.execute(
                "SELECT pnl_usd FROM trades WHERE closed_at > ? AND closed_at <= ?", (since, until)
            ).fetchall()
        pnls = [r["pnl_usd"] for r in rows]
        wins = [p for p in pnls if p > 0]
        return {
            "trades": len(pnls),
            "wins": len(wins),
            "losses": len(pnls) - len(wins),
            "pnl_usd": sum(pnls),
            "best_usd": max(pnls) if pnls else 0.0,
            "worst_usd": min(pnls) if pnls else 0.0,
        }

    def recap(self, since: float, until: float, start_equity: float | None = None,
              end_equity: float | None = None) -> str:
        """Plain-text recap, sized for a Telegram message."""
        with self._lock:
            rows = self._db.execute(
                "SELECT outcome, code, COUNT(*) AS n FROM decisions WHERE ts > ? AND ts <= ? "
                "GROUP BY outcome, code ORDER BY n DESC",
                (since, until),
            ).fetchall()
        by_outcome: dict[str, int] = {}
        for r in rows:
            by_outcome[r["outcome"]] = by_outcome.get(r["outcome"], 0) + r["n"]
        top_blocks = [f"{r['code']} x{r['n']}" for r in rows if r["outcome"] in ("reject", "skip", "kill")][:3]
        s = self.trade_summary(since, until)
        stamp = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")  # noqa: E731
        lines = [f"Moonlighter recap {stamp(since)} -> {stamp(until)}"]
        if start_equity is not None and end_equity is not None and start_equity > 0:
            lines.append(f"Equity ${start_equity:.2f} -> ${end_equity:.2f} ({end_equity / start_equity - 1:+.1%})")
        lines.append(
            f"Buys {by_outcome.get('buy', 0)} | stops {by_outcome.get('stop', 0)} | "
            f"trails {by_outcome.get('trail', 0)} | rejected {by_outcome.get('reject', 0)} | "
            f"skipped {by_outcome.get('skip', 0)}"
        )
        lines.append(
            f"Closed {s['trades']} ({s['wins']}W/{s['losses']}L), realized {s['pnl_usd']:+.2f} USD"
        )
        if top_blocks:
            lines.append("Most common blocks: " + ", ".join(top_blocks))
        return "\n".join(lines)
