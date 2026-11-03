"""Desk: glue between the pipeline, the risk engine and the ledger.

The pipeline (filters, fake-volume, RugCheck) decides whether a token is a
candidate. The desk decides whether it becomes a position, keeps the book,
marks it every cycle, fires exit signals, and records every decision so the
counterfactual report can show which gates earn their keep.

Everything here is a paper book. In live mode the buy/sell messages still go to
the trading bot, but fills are not confirmed back, so treat the book as a model
of your bankroll, not as proof of what the exchange did.
"""
from __future__ import annotations

import html
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Awaitable, Callable

from loguru import logger

from bot.agent import AGENT_EXIT_OUTCOMES, AgentConfig, apply_agent
from bot.ledger import WATCH_OUTCOMES, Decision, Ledger
from bot.risk import (
    Book,
    RiskConfig,
    audit,
    enter,
    equity,
    load_book,
    mark,
    paper_fill,
    save_book,
    size_ticket,
    write_off,
)

SOL_MINT = "So11111111111111111111111111111111111111112"

# Outcomes that should trigger a sell / scale notification
EXIT_OUTCOMES = {"stop", "trail", "writeoff", "scale1", "scale2", "time", "flatten"} | set(AGENT_EXIT_OUTCOMES)


async def best_pair_price(ds: Any, mint: str) -> tuple[float, float] | None:
    """(price_usd, liquidity_usd) of the deepest Solana pool for a mint, or None."""
    pairs = await ds.get_token_pairs(mint)
    sol = [p for p in pairs if p.get("chainId") == "solana"]
    if not sol:
        return None
    best = max(sol, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)
    norm = ds.normalize_pair(best)
    if not norm["price_usd"] > 0:
        return None
    return norm["price_usd"], norm["liquidity_usd"]


class Desk:
    def __init__(self, cfg: dict, tg: Any, clock: Callable[[], float] = time.time):
        self.tg = tg
        self.clock = clock
        rcfg = cfg.get("risk", {}) or {}
        lcfg = cfg.get("ledger", {}) or {}
        self.rc = RiskConfig.from_dict(rcfg)
        self.slippage_bps = float(rcfg.get("slippage_bps", 100))
        self.impact_factor = float(rcfg.get("impact_factor", 1.0))
        self.stale_exit_s = float(rcfg.get("stale_exit_s", 1800))
        self.block_cooldown_s = float(lcfg.get("block_cooldown_s", 6 * 3600))
        self.dead_after_s = float(lcfg.get("dead_after_s", 3 * 24 * 3600))
        self.horizons = tuple(int(h) for h in lcfg.get("horizons_s", [3600, 86400]))
        self.book_path = Path(lcfg.get("book_file", "data/book.json"))
        Path(lcfg.get("db_file", "data/ledger.db")).parent.mkdir(parents=True, exist_ok=True)
        self.ledger = Ledger(str(lcfg.get("db_file", "data/ledger.db")))
        self.book: Book = load_book(self.rc, self.book_path)
        now = self.clock()
        # Grace period after a restart: do not write off positions just because we were down.
        self.last_seen: dict[str, float] = {m: now for m in self.book.positions}
        self.liq: dict[str, float] = {}
        self.best_liq: dict[str, float] = {}
        self.ac = AgentConfig.from_dict(cfg.get("agent") or {})
        self._recorded_closed = len(self.book.closed)
        self._reported_problems: set[str] = set()
        self._sol_cache: tuple[float, float] | None = None  # (price, fetched_at)
        logger.info(
            f"Desk ready: equity ${equity(self.book):,.2f}, {len(self.book.positions)} open, "
            f"{len(self.book.closed)} closed"
        )

    # ---- recording --------------------------------------------------------

    def _record(self, d: Decision, cooldown: bool = True) -> bool:
        """Write a decision. Repeated "no" decisions for the same token and rule are
        throttled, so a token that stays in the feed does not flood the ledger."""
        if cooldown and d.outcome in WATCH_OUTCOMES:
            last = self.ledger.last_ts(d.symbol, d.code)
            if last is not None and d.ts - last < self.block_cooldown_s:
                return False
        self.ledger.record(d, self.horizons)
        return True

    def block(self, pair: dict, code: str, reason: str, outcome: str = "kill") -> None:
        """Log a pipeline gate that turned a token away."""
        mint = pair.get("mint") or ""
        if not mint:
            return
        label = pair.get("symbol") or mint[:6]
        price = pair.get("price_usd") or None
        self._record(Decision(self.clock(), mint, outcome, code, f"{label}: {reason}", None, price,
                              {"label": label, "liquidity_usd": pair.get("liquidity_usd")}))

    def _flush_closed(self) -> None:
        for trade in self.book.closed[self._recorded_closed:]:
            self.ledger.record_trade(trade)
        self._recorded_closed = len(self.book.closed)

    def _save(self) -> None:
        save_book(self.book, self.book_path)

    # ---- prices -----------------------------------------------------------

    async def _sol_usd(self, ds: Any) -> float | None:
        now = self.clock()
        if self._sol_cache and now - self._sol_cache[1] < 60:
            return self._sol_cache[0]
        got = await best_pair_price(ds, SOL_MINT)
        if got:
            self._sol_cache = (got[0], now)
            return got[0]
        return None

    def _exit_fill(self, mint: str, mark_price: float) -> float:
        pos = self.book.positions.get(mint)
        notional = pos.qty * mark_price if pos else 0.0
        return paper_fill(mark_price, "sell", notional, self.liq.get(mint, 0.0),
                          self.slippage_bps, self.impact_factor)

    # ---- entries ----------------------------------------------------------

    async def consider(self, pair: dict, score: float, ds: Any) -> None:
        """A token passed every gate. Let the risk engine decide whether to buy."""
        now = self.clock()
        mint = pair["mint"]
        label = pair.get("symbol") or mint[:6]
        price = pair.get("price_usd") or 0.0
        liq = pair.get("liquidity_usd") or 0.0
        if mint in self.book.positions:
            return  # already held: nothing to decide, nothing worth logging every cycle

        sol_usd = await self._sol_usd(ds)
        if not self.tg.dry_run and not sol_usd:
            self._record(Decision(now, mint, "skip", "no_sol_price",
                                  f"{label}: no SOL price, cannot size the buy command.", score, price or None))
            return

        size = size_ticket(self.rc, self.book, score)
        fill = paper_fill(price, "buy", size, liq, self.slippage_bps, self.impact_factor)
        book, decisions = enter(self.rc, self.book, mint, fill, score, now, label)
        extra = {"label": label, "quote_price": price, "liquidity_usd": liq}
        bought = False
        for d in decisions:
            # "no" decisions are judged against the quote so counterfactuals compare like with like
            d = replace(d, price=price or None, meta={**d.meta, **extra}) if d.outcome != "buy" \
                else replace(d, meta={**d.meta, **extra})
            self._record(d)
            bought = bought or d.outcome == "buy"
        if not bought:
            return
        self.book = book
        self.liq[mint] = liq
        self.last_seen[mint] = now
        self._save()
        amount_sol = (size / sol_usd) if sol_usd else None
        logger.success(f"BUY {label}: ${size:,.2f} at {fill:g} (quote {price:g}, liq ${liq:,.0f})")
        await self.tg.buy(mint, amount_sol)

    # ---- every cycle ------------------------------------------------------

    async def mark_open(self, ds: Any) -> None:
        """Re-mark open positions, run stops / scale-outs / trails / time-stops."""
        if not self.book.positions:
            return
        now = self.clock()
        prices: dict[str, float] = {}
        for mint in list(self.book.positions):
            got = await best_pair_price(ds, mint)
            if got:
                prices[mint], self.liq[mint] = got
                prev = self.best_liq.get(mint, 0.0)
                if got[1] > prev:
                    self.best_liq[mint] = got[1]
                self.last_seen[mint] = now
        book, decisions = mark(self.rc, self.book, prices, now, exit_price=self._exit_fill)
        for mint, pos in list(book.positions.items()):
            if now - self.last_seen.get(mint, now) > self.stale_exit_s:
                reason = (f"Write-off. No price for {pos.label or mint[:6]} in "
                          f"{(now - self.last_seen[mint]) / 60:.0f} min. Treated as a total loss.")
                book, ds2 = write_off(self.rc, book, mint, now, reason)
                decisions += ds2
        book, agent_ds = apply_agent(
            self.ac, self.rc, book, prices, self.liq, self.best_liq, now,
            exit_price=self._exit_fill,
        )
        decisions += agent_ds
        self.best_liq = {m: v for m, v in self.best_liq.items() if m in book.positions}
        self.book = book
        self._save()
        for d in decisions:
            self._record(d, cooldown=False)
        self._flush_closed()
        for d in decisions:
            label = d.meta.get("label") or d.symbol[:6]
            if d.outcome in EXIT_OUTCOMES:
                await self.tg.sell(d.symbol, label, d.reason)
            elif d.outcome == "halt":
                await self.tg.notify("TRADING HALTED", html.escape(d.reason))
        await self._report_problems()

    async def _report_problems(self) -> None:
        for p in audit(self.rc, self.book):
            if p not in self._reported_problems:
                self._reported_problems.add(p)
                logger.error(f"AUDIT: {p}")
                await self.tg.notify("BOOK AUDIT FAILED", html.escape(p))

    async def resolve_counterfactuals(self, ds: Any, limit: int = 20) -> None:
        """Price the names we turned away once their horizon has passed."""
        now = self.clock()
        cache: dict[str, tuple[float, float] | None] = {}
        for row in self.ledger.due_counterfactuals(now, limit):
            mint = row["symbol"]
            if mint not in cache:
                cache[mint] = await best_pair_price(ds, mint)
            got = cache[mint]
            if got:
                self.ledger.resolve_counterfactual(row["id"], got[0], now)
            elif now - row["due_ts"] > self.dead_after_s:
                self.ledger.resolve_counterfactual(row["id"], 0.0, now, dead=True)

    def close(self) -> None:
        self.ledger.close()
