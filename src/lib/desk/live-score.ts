import type { PublicPairDTO } from "@/lib/desk/types";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const MIN_LIVE_VOL = 50_000;
export const MIN_LIVE_LIQ = 8_000;
export const MAX_LIVE_AGE = 180;

/** Breakout track: older names only if volume and liquidity clear higher bars. */
export const MAX_BREAKOUT_AGE = 7 * 24 * 60; // 7 days
export const MIN_BREAKOUT_VOL = 150_000;
export const MIN_BREAKOUT_LIQ = 25_000;

export const MIN_LIVE_SCORE = 0.6;
export const LIVE_RESERVE_SOL = 0.02;
export const MIN_TICKET_SOL = 0.01;
export const MAX_PCT = 0.08;

const CASH_MINTS = new Set([
  SOL_MINT,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function isCashMint(mint: string): boolean {
  return CASH_MINTS.has(mint);
}

export function washReason(pair: PublicPairDTO): string | null {
  const tx = pair.buys1h + pair.sells1h;
  if (tx <= 0) return null;
  if (Math.max(pair.buys1h, pair.sells1h) / tx >= 0.95) return "Buy/sell flow is one-sided. Treated as wash.";
  if (tx < 20 && pair.volume1hUsd > 200_000) return "Volume is large against a tiny print count. Treated as wash.";
  return null;
}

/** True when the name is past the new-pair window but clears breakout floors. */
export function isBreakoutCandidate(pair: PublicPairDTO): boolean {
  return (
    pair.ageMin > MAX_LIVE_AGE &&
    pair.ageMin <= MAX_BREAKOUT_AGE &&
    pair.volume1hUsd >= MIN_BREAKOUT_VOL &&
    pair.liquidityUsd >= MIN_BREAKOUT_LIQ
  );
}

/**
 * Soft blocks (volume / liquidity / age-without-breakout) may be retried later.
 * Hard blocks (cash, venue, wash) should stick for the session.
 */
export function isSoftTapeBlock(reason: string): boolean {
  return (
    reason.includes("volume is under") ||
    reason.includes("Liquidity is under") ||
    reason.includes("Older than") ||
    reason.includes("not enough volume") ||
    reason.includes("not enough liquidity")
  );
}

export function tapeBlock(pair: PublicPairDTO): string | null {
  if (isCashMint(pair.mint)) return "Cash mint. Not a candidate.";
  if (pair.venue !== "pump.fun" && pair.venue !== "raydium") return "Venue is outside Pump.fun and Raydium.";

  const wash = washReason(pair);
  if (wash) return wash;

  // Track A — new / young pairs
  if (pair.ageMin <= MAX_LIVE_AGE) {
    if (pair.volume1hUsd < MIN_LIVE_VOL) return `1h volume is under $50,000.`;
    if (pair.liquidityUsd < MIN_LIVE_LIQ) return "Liquidity is under $8,000.";
    return null;
  }

  // Track B — breakout on existing names (stricter vol/liq, age ≤ 7d)
  if (pair.ageMin > MAX_BREAKOUT_AGE) {
    return `Older than ${MAX_BREAKOUT_AGE / (24 * 60)} days and outside the new-pair window.`;
  }
  if (pair.volume1hUsd < MIN_BREAKOUT_VOL) {
    return `Breakout track needs 1h volume ≥ $${(MIN_BREAKOUT_VOL / 1000).toFixed(0)}k (have $${(pair.volume1hUsd / 1000).toFixed(0)}k).`;
  }
  if (pair.liquidityUsd < MIN_BREAKOUT_LIQ) {
    return `Breakout track needs liquidity ≥ $${(MIN_BREAKOUT_LIQ / 1000).toFixed(0)}k.`;
  }
  return null;
}

export function liveScore(pair: PublicPairDTO, top10: number | null): number {
  const volScore = clamp01((Math.log10(Math.max(pair.volume1hUsd, 1)) - 4.9) / 0.95);
  const liqScore = clamp01((Math.log10(Math.max(pair.liquidityUsd, 1)) - 4.45) / 0.95);
  const holderScore = top10 == null ? 0.45 : clamp01((16 - top10) / 12);
  // Breakouts are older by definition; still score age usefully instead of zeroing them.
  const ageScore =
    pair.ageMin < 6 ? 0.2 : pair.ageMin < 15 ? 0.5 : pair.ageMin < 180 ? 0.9 : pair.ageMin < 1440 ? 0.7 : 0.55;
  const flow = (pair.buys1h - pair.sells1h) / Math.max(1, pair.buys1h + pair.sells1h);
  const flowScore = clamp01(0.5 + flow * 0.9);
  const breakoutBoost = isBreakoutCandidate(pair) ? 0.04 : 0;
  const raw = 0.2 * volScore + 0.24 * liqScore + 0.18 * holderScore + 0.18 * ageScore + 0.2 * flowScore + breakoutBoost;
  return Math.round(clamp01(raw) * 100) / 100;
}

export function ticketSol(balance: number, requested: number): number {
  const cap = balance * MAX_PCT;
  const room = balance - LIVE_RESERVE_SOL;
  const size = Math.min(requested, cap, room);
  return Math.floor(size * 1000) / 1000;
}
