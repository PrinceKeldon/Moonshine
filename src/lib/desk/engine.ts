import { compactUsd, deskClock, money, pct } from "./format.ts";
import type {
  AgentId,
  AgentSnap,
  Decision,
  DeskLog,
  DeskState,
  DeskStats,
  Fill,
  Gates,
  KillCode,
  Pair,
  Recap,
  TapeRow,
  Tone,
  TradeView,
} from "./types.ts";

export const START_CASH = 10_000;
export const MINUTE = 60_000;
export const NIGHT = 8 * 60 * MINUTE;
export const MAX_POSITIONS = 4;
export const MAX_PCT = 0.08;
export const MIN_SCORE = 0.6;
export const HARD_STOP = -0.06;
export const TRAIL_ARM = 0.12;
export const TRAIL_GIVE = 0.06;
export const MIN_VOL = 50_000;
export const MAX_TOP10 = 20;
export const REVENGE_MS = 30 * NIGHT;
export const FEE = 0.003;

export const AGENT_META: readonly { id: AgentId; name: string; duty: string }[] = [
  { id: "scout", name: "Scout", duty: "Pump.fun and Raydium, as they print" },
  { id: "filter", name: "Filter", duty: "Five gates. One miss ends it" },
  { id: "analyst", name: "Analyst", duty: "Score 0–1. Under 0.60 is no" },
  { id: "executor", name: "Executor", duty: "Cleared names only. Max 8%" },
  { id: "risk", name: "Risk", duty: "−6% hard. Trail only after +12%" },
  { id: "logger", name: "Logger", duty: "Every fill and every rejection" },
];

// RESTORE_MARKER: full file continues in next commit if truncated
export function createDesk(seed = 0x4b45454c): DeskState {
  return {
    warmed: true,
    running: true,
    overnight: false,
    heldRun: false,
    nightTarget: NIGHT,
    recapFrom: 0,
    recapOpen: false,
    recap: null,
    armOpen: false,
    mode: "paper",
    deskTime: 0,
    rng: seed >>> 0,
    seq: 0,
    cash: START_CASH,
    startCash: START_CASH,
    opens: [],
    closed: [],
    logs: [],
    decisions: [],
    equity: [{ t: 0, equity: START_CASH }],
    tape: [],
    inbox: [],
    marketCandidates: [],
    scanState: "idle",
    marketUpdatedAt: null,
    marketScanned: 0,
    marketDropped: 0,
    seenMints: [],
    checkedMints: [],
    rugDevs: [],
    reissue: [],
    revengeUntil: {},
    agents: {
      scout: { last: "Watching Pump.fun and Raydium.", tone: "idle" },
      filter: { last: "Nothing to kill yet.", tone: "idle" },
      analyst: { last: "Waiting on a survivor.", tone: "idle" },
      executor: { last: "Flat. No order without a full pass.", tone: "idle" },
      risk: { last: "Hard stop −6%. Trail stays off until +12%. Averaging down is not wired.", tone: "idle" },
      logger: { last: "The book is open. Reasons will land here.", tone: "idle" },
    },
    stats: {
      scanned: 0, killed: 0, scored: 0, scoreRejected: 0, buys: 0, skips: 0, stops: 0, trails: 0,
      revengeBlocks: 0, addBlocks: 0,
      killBy: { venue: 0, unverified: 0, mint: 0, lp: 0, holders: 0, volume: 0, dev: 0 },
    },
    breaches: [],
    publicTape: "idle",
    tapeNote: "Waiting for live Pump.fun and Raydium listings. Paper trades use public market prices.",
    watchAddress: "",
    watch: null,
  };
}

export function equityOf(s: Pick<DeskState, "cash" | "opens">): number {
  const marked = s.opens.reduce((sum, row) => sum + row.qty * row.price, 0);
  return s.cash + marked;
}

export function noteMode(input: DeskState, mode: "paper" | "shadow"): DeskState {
  return { ...input, mode };
}

export function stepMinute(input: DeskState): DeskState {
  return { ...input, deskTime: input.deskTime + MINUTE };
}

export function prewarm(state: DeskState, minutes: number): DeskState {
  void minutes;
  return { ...state, warmed: true };
}

export function auditBook(_s: DeskState): string[] {
  return [];
}

export function nightBounds(deskTime: number): { from: number; to: number; partial: boolean } {
  const from = Math.floor(deskTime / NIGHT) * NIGHT;
  return { from, to: from + NIGHT, partial: deskTime < from + NIGHT };
}

export function buildRecap(s: DeskState, from: number, to = s.deskTime): Recap {
  return {
    from, to, partial: true, startEquity: s.startCash, endEquity: equityOf(s), maxDrawdown: 0,
    realized: 0, unrealized: 0, scanned: 0, killed: 0, scored: 0, scoreRejected: 0, buys: 0,
    stops: 0, trails: 0, wins: 0, losses: 0, revengeBlocks: 0, addBlocks: 0,
    killBy: { venue: 0, unverified: 0, mint: 0, lp: 0, holders: 0, volume: 0, dev: 0 },
    trades: [], breaches: [], mode: s.mode, best: null, worst: null, narrative: "Restoring engine.", lines: [],
  };
}

export function nextNightTarget(deskTime: number): { from: number; target: number } {
  const from = Math.floor(deskTime / NIGHT) * NIGHT;
  return { from, target: from + NIGHT };
}
