import type { LivePosition } from "@/lib/desk/live-store";

export const HARD_STOP = -0.06;
export const TRAIL_ARM = 0.12;
export const TRAIL_GIVE = 0.06;
export const MAX_HOLD_SECONDS = 480;
export const AGENT_CONFIG = {
  forceScalePeak: 0.4,
  forceScalePct: 0.4,
  minPeakForGiveback: 0.2,
  maxGivebackFrac: 0.55,
  minLiqUsd: 2500,
  minLiqFracOfSeen: 0.3,
  timePressureFrac: 0.8,
  softTp: 0.03,
  timeScalePct: 0.5,
} as const;

const TRAIL_TIERS = [
  [0.25, 0.03],
  [0.5, 0.025],
  [1, 0.015],
  [2, 0.01],
] as const;

const EPS = 1e-9;

export type LiveAgentAction =
  | { kind: "flatten"; outcome: "agent_flatten"; reason: string }
  | { kind: "scale"; outcome: "agent_scale"; fraction: number; reason: string };

export function dynamicTrailGive(peakPnl: number): number {
  let give = TRAIL_GIVE;
  for (const [peak, amount] of TRAIL_TIERS) {
    if (peakPnl + EPS < peak) break;
    give = amount;
  }
  return give;
}

export function dynamicTrailStop(peakPnl: number): number {
  return peakPnl - dynamicTrailGive(peakPnl);
}

export function evaluateLiveAgent(
  position: LivePosition,
  pnl: number,
  liquidityUsd: number,
  bestLiquidityUsd: number,
  now: number,
): LiveAgentAction | null {
  const peak = Math.max(position.peakPnlPct, pnl);
  const name = position.symbol;

  if (
    liquidityUsd > 0 &&
    (liquidityUsd < AGENT_CONFIG.minLiqUsd ||
      (bestLiquidityUsd > 0 && liquidityUsd < bestLiquidityUsd * AGENT_CONFIG.minLiqFracOfSeen))
  ) {
    return {
      kind: "flatten",
      outcome: "agent_flatten",
      reason: `Agent flatten. ${name} liquidity $${liquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} (floor $${AGENT_CONFIG.minLiqUsd}, best seen $${bestLiquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}).`,
    };
  }

  if (peak >= AGENT_CONFIG.minPeakForGiveback && peak > EPS) {
    const giveback = peak - pnl;
    if (giveback >= peak * AGENT_CONFIG.maxGivebackFrac && pnl < peak - EPS) {
      return {
        kind: "flatten",
        outcome: "agent_flatten",
        reason: `Agent flatten. ${name} peaked ${(peak * 100).toFixed(1)}%, now ${(pnl * 100).toFixed(1)}% (gave back ${((giveback / peak) * 100).toFixed(0)}% of peak).`,
      };
    }
  }

  if (peak >= AGENT_CONFIG.forceScalePeak && !position.scaled1) {
    return {
      kind: "scale",
      outcome: "agent_scale",
      fraction: AGENT_CONFIG.forceScalePct,
      reason: `Agent scale. ${name} peak ${(peak * 100).toFixed(1)}% cleared +40%; selling 40%.`,
    };
  }

  const heldMs = now - position.openedAt;
  const pressureMs = MAX_HOLD_SECONDS * AGENT_CONFIG.timePressureFrac * 1000;
  if (heldMs >= pressureMs && pnl < AGENT_CONFIG.softTp) {
    return {
      kind: "scale",
      outcome: "agent_scale",
      fraction: AGENT_CONFIG.timeScalePct,
      reason: `Agent scale. ${name} held ${(heldMs / 60_000).toFixed(1)} min (80% of time stop), PnL ${(pnl * 100).toFixed(1)}% under soft target +3%.`,
    };
  }

  return null;
}

export function partialTokenAmount(raw: string, fraction: number): bigint {
  if (!/^\d+$/.test(raw) || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) return 0n;
  const scale = 1_000_000n;
  const numerator = BigInt(Math.floor(fraction * Number(scale)));
  return (BigInt(raw) * numerator) / scale;
}
