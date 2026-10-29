"""Persist analysis results and blacklists."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import aiosqlite
from loguru import logger


class Storage:
    def __init__(self, db_path: str | Path, jsonl_path: str | Path):
        self.db_path = Path(db_path)
        self.jsonl_path = Path(jsonl_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.jsonl_path.parent.mkdir(parents=True, exist_ok=True)

    async def init(self) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS tokens (
                    mint TEXT PRIMARY KEY,
                    symbol TEXT,
                    name TEXT,
                    pair_address TEXT,
                    first_seen TEXT,
                    last_seen TEXT,
                    is_rug INTEGER DEFAULT 0,
                    is_pump INTEGER DEFAULT 0,
                    is_blacklisted INTEGER DEFAULT 0,
                    rugcheck_good INTEGER,
                    notes TEXT,
                    data_json TEXT
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mint TEXT,
                    event_type TEXT,
                    details TEXT,
                    created_at TEXT
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS market_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mint TEXT NOT NULL,
                    ts REAL NOT NULL,
                    liquidity_usd REAL NOT NULL,
                    price_usd REAL NOT NULL
                )
                """
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_market_snapshots_mint_ts "
                "ON market_snapshots(mint, ts)"
            )
            await db.commit()
        logger.info(f"Storage ready → {self.db_path}")

    async def record_market_snapshot(
        self, mint: str, ts: float, liquidity_usd: float, price_usd: float, lookback_s: float
    ) -> dict[str, float] | None:
        """Store an observation and return a sufficiently recent lookback baseline, if available."""
        lower_bound = ts - lookback_s - max(lookback_s * 0.25, 300.0)
        target_ts = ts - lookback_s
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT ts, liquidity_usd, price_usd FROM market_snapshots "
                "WHERE mint = ? AND ts <= ? AND ts >= ? ORDER BY ts DESC LIMIT 1",
                (mint, target_ts, lower_bound),
            )
            baseline = await cursor.fetchone()
            await db.execute(
                "INSERT INTO market_snapshots (mint, ts, liquidity_usd, price_usd) VALUES (?, ?, ?, ?)",
                (mint, ts, liquidity_usd, price_usd),
            )
            await db.execute("DELETE FROM market_snapshots WHERE ts < ?", (ts - max(lookback_s * 2, 3600),))
            await db.commit()

        if baseline is None or baseline[1] <= 0:
            return None
        return {
            "previous_ts": float(baseline[0]),
            "previous_liquidity_usd": float(baseline[1]),
            "previous_price_usd": float(baseline[2]),
            "liquidity_change_pct": liquidity_usd / baseline[1] * 100.0 - 100.0,
            "price_change_pct": price_usd / baseline[2] * 100.0 - 100.0 if baseline[2] > 0 else 0.0,
        }

    async def upsert_token(self, mint: str, data: dict[str, Any]) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO tokens (mint, symbol, name, pair_address, first_seen, last_seen,
                                   is_rug, is_pump, rugcheck_good, notes, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(mint) DO UPDATE SET
                    last_seen=excluded.last_seen,
                    is_rug=excluded.is_rug,
                    is_pump=excluded.is_pump,
                    rugcheck_good=excluded.rugcheck_good,
                    notes=excluded.notes,
                    data_json=excluded.data_json
                """,
                (
                    mint,
                    data.get("symbol"),
                    data.get("name"),
                    data.get("pair_address"),
                    data.get("timestamp"),
                    data.get("timestamp"),
                    1 if data.get("is_rug") else 0,
                    1 if data.get("is_pump") else 0,
                    1 if data.get("rugcheck_good") else 0,
                    json.dumps(data.get("reasons") or []),
                    json.dumps(data, default=str),
                ),
            )
            await db.commit()

    async def log_event(self, mint: str, event_type: str, details: dict) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO events (mint, event_type, details, created_at) VALUES (?, ?, ?, datetime('now'))",
                (mint, event_type, json.dumps(details, default=str)),
            )
            await db.commit()

    def append_jsonl(self, record: dict) -> None:
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
