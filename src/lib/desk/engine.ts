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
  Venue,
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

const NAMES: readonly (readonly [string, string])[] = [
  ["SOOT", "Soot"],
  ["BRAMBLE", "Bramble"],
  ["PEBBLE", "Pebble"],
  ["LANTERN", "Lantern"],
  ["THISTLE", "Thistle"],
  ["MARSH", "Marsh"],
  ["CINDER", "Cinder"],
  ["PIPPIN", "Pippin"],
  ["OCHRE", "Ochre"],
  ["FIDDLE", "Fiddle"],
  ["WICK", "Wick"],
  ["GULL", "Gull"],
  ["NETTLE", "Nettle"],
  ["QUILL", "Quill"],
  ["DRIFT", "Driftwood"],
  ["HUSK", "Husk"],
  ["MOTH", "Moth"],
  ["SALT", "Saltpan"],
  ["YARROW", "Yarrow"],
  ["KELP", "Kelp"],
  ["FLINT", "Flint"],
  ["BORAGE", "Borage"],
  ["RIND", "Rind"],
  ["CLOVE", "Clove"],
  ["TAWNY", "Tawny"],
  ["PLOVER", "Plover"],
  ["BRACK", "Brack"],
  ["COPSE", "Copse"],
  ["SEDGE", "Sedge"],
  ["LOAM", "Loam"],
  ["BRINE", "Brine"],
  ["KINDLING", "Kindling"],
  ["VETCH", "Vetch"],
  ["ROWAN", "Rowan"],
  ["GRIT", "Grit"],
  ["ALDER", "Alder"],
  ["FENNEL", "Fennel"],
  ["COBB", "Cobb"],
  ["LARK", "Lark"],
  ["SORREL", "Sorrel"],
  ["WOLD", "Wold"],
  ["CHERT", "Chert"],
  ["BRIAR", "Briar"],
  ["DULSE", "Dulse"],
  ["HAW", "Hawthorn"],
  ["SLATE", "Slate"],
  ["REED", "Reed"],
  ["TOR", "Tor"],
];

const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const AGENT_META: readonly { id: AgentId; name: string; duty: string }[] = [
  { id: "scout", name: "Scout", duty: "Pump.fun and Raydium, as they print" },
  { id: "filter", name: "Filter", duty: "Five gates. One miss ends it" },
  { id: "analyst", name: "Analyst", duty: "Score 0–1. Under 0.60 is no" },
  { id: "executor", name: "Executor", duty: "Cleared names only. Max 8%" },
  { id: "risk", name: "Risk", duty: "−6% hard. Trail only after +12%" },
  { id: "logger", name: "Logger", duty: "Every fill and every rejection" },
];

function emptyKillBy(): Record<KillCode, number> {
  return { venue: 0, unverified: 0, mint: 0, lp: 0, holders: 0, volume: 0, dev: 0 };
}

function emptyStats(): DeskStats {
  return {
    scanned: 0,
    killed: 0,
    scored: 0,
    scoreRejected: 0,
    buys: 0,
    skips: 0,
    stops: 0,
    trails: 0,
    revengeBlocks: 0,
    addBlocks: 0,
    killBy: emptyKillBy(),
  };
}

function idleAgents(): Record<AgentId, AgentSnap> {
  return {
    scout: { last: "Watching Pump.fun and Raydium.", tone: "idle" },
    filter: { last: "Nothing to kill yet.", tone: "idle" },
    analyst: { last: "Waiting on a survivor.", tone: "idle" },
    executor: { last: "Flat. No order without a full pass.", tone: "idle" },
    risk: {
      last: "Hard stop −6%. Trail stays off until +12%. Averaging down is not wired.",
      tone: "idle",
    },
    logger: { last: "The book is open. Reasons will land here.", tone: "idle" },
  };
}

function mulberry(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t >>> 0 };
}

function wallet(rand: () => number): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) out += ALPH[Math.floor(rand() * ALPH.length)] ?? "K";
  return out;
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function createDesk(seed = 0x4b45454c): DeskState {
  return {
    warmed: false,
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
    seenMints: [],
    rugDevs: [],
    reissue: [],
    revengeUntil: {},
    agents: idleAgents(),
    stats: emptyStats(),
    breaches: [],
    publicTape: "idle",
    tapeNote: "Public tape has not reported yet. Indexed launches still run.",
  };
}

function copyState(input: DeskState): DeskState {
  return {
    ...input,
    opens: input.opens.map((row) => ({ ...row, gates: { ...row.gates }, template: { ...row.template } })),
    closed: input.closed.slice(),
    logs: input.logs.slice(),
    decisions: input.decisions.slice(),
    equity: input.equity.slice(),
    tape: input.tape.slice(),
    inbox: input.inbox.slice(),
    seenMints: input.seenMints,
    rugDevs: input.rugDevs.slice(),
    reissue: input.reissue.slice(),
    revengeUntil: { ...input.revengeUntil },
    agents: {
      scout: { ...input.agents.scout },
      filter: { ...input.agents.filter },
      analyst: { ...input.agents.analyst },
      executor: { ...input.agents.executor },
      risk: { ...input.agents.risk },
      logger: { ...input.agents.logger },
    },
    stats: { ...input.stats, killBy: { ...input.stats.killBy } },
    breaches: input.breaches.slice(),
    recap: input.recap,
  };
}

function say(s: DeskState, agent: AgentId, kind: DeskLog["kind"], symbol: string | null, reason: string, tone: Tone) {
  s.seq += 1;
  const row: DeskLog = { id: `L${s.seq}`, t: s.deskTime, agent, symbol, kind, reason };
  s.logs.push(row);
  if (s.logs.length > 180) s.logs.splice(0, s.logs.length - 180);
  s.agents[agent] = { last: reason, tone };
}

function decide(s: DeskState, symbol: string, mint: string, outcome: Decision["outcome"], reason: string) {
  s.decisions.push({ t: s.deskTime, symbol, mint, outcome, reason });
  if (s.decisions.length > 3000) s.decisions.splice(0, s.decisions.length - 3000);
}

function rememberTape(s: DeskState, pair: Pair, outcome: TapeRow["outcome"], reason: string, score: number | null) {
  const row: TapeRow = {
    id: pair.uid,
    t: s.deskTime,
    symbol: pair.symbol,
    venue: pair.venue,
    source: pair.source,
    volume1hUsd: pair.volume1hUsd,
    outcome,
    reason,
    score,
  };
  s.tape.unshift(row);
  if (s.tape.length > 24) s.tape.pop();
}

export function equityOf(s: Pick<DeskState, "cash" | "opens">): number {
  const marked = s.opens.reduce((sum, row) => sum + row.qty * row.price, 0);
  return s.cash + marked;
}

function gauss(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function forgePair(s: DeskState, rand: () => number): Pair {
  if (s.opens.length > 0 && rand() < 0.035) {
    const open = s.opens[Math.floor(rand() * s.opens.length)]!;
    return { ...open.template, uid: `add${s.deskTime}-${open.mint}`, priceUsd: open.price };
  }
  if (s.reissue.length > 0 && rand() < 0.5) {
    const prior = s.reissue.shift();
    if (prior) return { ...prior, uid: `re${s.deskTime}-${prior.mint}` };
  }

  const tierRoll = rand();
  const tier = tierRoll < 0.82 ? "junk" : tierRoll < 0.975 ? "mid" : "clean";
  const venue: Venue = rand() < 0.62 ? "pump.fun" : "raydium";
  const named = NAMES[Math.floor(rand() * NAMES.length)] ?? NAMES[0]!;
  const base = named[0];
  const name = named[1];
  const used = new Set<string>([...s.opens.map((row) => row.symbol), ...s.closed.map((row) => row.symbol)]);
  let symbol = base;
  let suffix = 2;
  while (used.has(symbol)) {
    symbol = `${base}${suffix}`;
    suffix += 1;
  }
  const mint = `idx${Math.floor(rand() * 1e9).toString(36)}${symbol}`;

  let mintRevoked = true;
  let lpLocked = true;
  let top10 = 8;
  let volume = 120_000;
  let liquidity = 80_000;
  let ageMin = 40;
  let buys = 400;
  let sells = 280;
  let prior = 0;

  if (tier === "junk") {
    mintRevoked = rand() < 0.45;
    lpLocked = rand() < 0.4;
    top10 = rand() < 0.58 ? 22 + rand() * 48 : 6 + rand() * 13;
    volume = rand() < 0.74 ? 1200 + rand() * 40_000 : 50_000 + rand() * 90_000;
    liquidity = 1800 + rand() * 28_000;
    ageMin = rand() * 30;
    buys = Math.floor(rand() * 90);
    sells = Math.floor(20 + rand() * 140);
    prior = rand() < 0.38 ? 1 + Math.floor(rand() * 4) : 0;
  } else if (tier === "mid") {
    mintRevoked = rand() < 0.78;
    lpLocked = rand() < 0.72;
    top10 = 9 + rand() * 16;
    volume = 28_000 + rand() * 180_000;
    liquidity = 18_000 + rand() * 80_000;
    ageMin = 10 + rand() * 120;
    buys = 90 + Math.floor(rand() * 320);
    sells = 80 + Math.floor(rand() * 340);
    prior = rand() < 0.2 ? 1 : 0;
  } else {
    mintRevoked = rand() < 0.94;
    lpLocked = rand() < 0.92;
    top10 = 3 + rand() * 11;
    volume = 90_000 + rand() * 820_000;
    liquidity = 60_000 + rand() * 280_000;
    ageMin = 20 + rand() * 150;
    buys = 240 + Math.floor(rand() * 900);
    sells = 90 + Math.floor(rand() * 360);
    prior = rand() < 0.06 ? 1 : 0;
  }

  let devWallet: string;
  if (prior > 0 && s.rugDevs.length > 0 && rand() < 0.55) {
    devWallet = s.rugDevs[Math.floor(rand() * s.rugDevs.length)]!;
    prior = Math.max(prior, 1);
  } else {
    devWallet = wallet(rand);
    if (prior > 0) s.rugDevs.push(devWallet);
  }
  if (prior === 0 && s.rugDevs.length > 0 && rand() < 0.07) {
    devWallet = s.rugDevs[Math.floor(rand() * s.rugDevs.length)]!;
    prior = 1 + Math.floor(rand() * 3);
  }
  if (s.rugDevs.length > 40) s.rugDevs.splice(0, s.rugDevs.length - 40);

  return {
    uid: `p${s.deskTime}-${mint}`,
    mint,
    symbol,
    name,
    venue,
    priceUsd: 0.00002 + rand() * 0.04,
    volume1hUsd: volume,
    liquidityUsd: liquidity,
    mcapUsd: liquidity * (3 + rand() * 9),
    ageMin,
    buys1h: buys,
    sells1h: sells,
    mintRevoked,
    lpLocked,
    top10Pct: top10,
    devWallet,
    devPriorRugs: prior,
    source: "index",
  };
}

function filterPair(pair: Pair): { ok: true; reason: string } | { ok: false; code: KillCode; reason: string } {
  if (pair.venue !== "pump.fun" && pair.venue !== "raydium") {
    return { ok: false, code: "venue", reason: "Venue is outside Pump.fun and Raydium. Rejected." };
  }
  if (
    pair.mintRevoked === null ||
    pair.lpLocked === null ||
    pair.top10Pct === null ||
    pair.devWallet === null ||
    pair.devPriorRugs === null
  ) {
    return {
      ok: false,
      code: "unverified",
      reason:
        "No gate attestation on this public print. Mint authority, LP lock, holder concentration, and dev history are unproven. Rejected.",
    };
  }
  if (!pair.mintRevoked) return { ok: false, code: "mint", reason: "Mint authority is still live. Rejected." };
  if (!pair.lpLocked) return { ok: false, code: "lp", reason: "LP is not locked. Rejected." };
  if (pair.top10Pct > MAX_TOP10) {
    return {
      ok: false,
      code: "holders",
      reason: `Top 10 holders control ${pair.top10Pct.toFixed(1)}% (limit 20%). Rejected.`,
    };
  }
  if (pair.volume1hUsd < MIN_VOL) {
    return {
      ok: false,
      code: "volume",
      reason: `1h volume is ${compactUsd(pair.volume1hUsd)} (under $50,000). Rejected.`,
    };
  }
  if (pair.devPriorRugs > 0) {
    const noun = pair.devPriorRugs === 1 ? "rug" : "rugs";
    return {
      ok: false,
      code: "dev",
      reason: `Dev ${pair.devWallet} is connected to ${pair.devPriorRugs} prior ${noun}. Rejected.`,
    };
  }
  return {
    ok: true,
    reason: `All gates clear. Mint revoked, LP locked, top 10 at ${pair.top10Pct.toFixed(1)}%, 1h volume ${compactUsd(pair.volume1hUsd)}, dev ${pair.devWallet} clean.`,
  };
}

function analyze(pair: Pair): { score: number; reason: string } {
  const volScore = clamp01((Math.log10(Math.max(pair.volume1hUsd, 1)) - 4.9) / 0.95);
  const liqScore = clamp01((Math.log10(Math.max(pair.liquidityUsd, 1)) - 4.45) / 0.95);
  const holderScore = clamp01((16 - (pair.top10Pct ?? MAX_TOP10)) / 12);
  const ageScore = pair.ageMin < 6 ? 0.2 : pair.ageMin < 15 ? 0.5 : pair.ageMin < 180 ? 0.9 : 0.62;
  const flow = (pair.buys1h - pair.sells1h) / Math.max(1, pair.buys1h + pair.sells1h);
  const flowScore = clamp01(0.5 + flow * 0.9);
  const raw =
    0.2 * volScore + 0.24 * liqScore + 0.18 * holderScore + 0.18 * ageScore + 0.2 * flowScore;
  const score = Math.round(clamp01(raw) * 100) / 100;
  const reason = `Score ${score.toFixed(2)}. Liquidity ${liqScore.toFixed(2)}, volume ${volScore.toFixed(2)}, holders ${holderScore.toFixed(2)}, age ${ageScore.toFixed(2)}, flow ${flowScore.toFixed(2)}. Line is 0.60.`;
  return { score, reason };
}

function runPipeline(s: DeskState, pair: Pair) {
  s.stats.scanned += 1;
  const where = pair.source === "public" ? "public tape" : "gate index";
  say(
    s,
    "scout",
    "scan",
    pair.symbol,
    `Saw ${pair.symbol} on ${pair.venue} via ${where}. 1h volume ${compactUsd(pair.volume1hUsd)}, liq ${compactUsd(pair.liquidityUsd)}. Handing to Filter.`,
    "work",
  );

  const gated = filterPair(pair);
  if (!gated.ok) {
    s.stats.killed += 1;
    s.stats.killBy[gated.code] += 1;
    say(s, "filter", "kill", pair.symbol, gated.reason, "kill");
    const recorded = `${pair.symbol} rejected. ${gated.reason}`;
    say(s, "logger", "note", pair.symbol, `Logged rejection. ${recorded}`, "work");
    decide(s, pair.symbol, pair.mint, "kill", gated.reason);
    rememberTape(s, pair, "kill", gated.reason, null);
    return;
  }

  say(s, "filter", "pass", pair.symbol, `${gated.reason} Handing to Analyst.`, "pass");

  const view = analyze(pair);
  s.stats.scored += 1;
  if (view.score < MIN_SCORE) {
    s.stats.scoreRejected += 1;
    const reason = `No trade. ${view.reason} Under 0.60.`;
    say(s, "analyst", "reject", pair.symbol, reason, "kill");
    say(s, "logger", "note", pair.symbol, `Logged rejection. ${pair.symbol} scored ${view.score.toFixed(2)}. No trade.`, "work");
    decide(s, pair.symbol, pair.mint, "reject", reason);
    rememberTape(s, pair, "reject", reason, view.score);
    return;
  }

  say(s, "analyst", "score", pair.symbol, `${view.reason} Cleared. Handing to Executor.`, "pass");

  const openSame = s.opens.find((row) => row.mint === pair.mint);
  if (openSame) {
    s.stats.skips += 1;
    s.stats.addBlocks += 1;
    const reason = `No trade. ${pair.symbol} is already on the book. Adding would average. Refused.`;
    say(s, "executor", "skip", pair.symbol, reason, "kill");
    say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
    decide(s, pair.symbol, pair.mint, "skip", reason);
    rememberTape(s, pair, "skip", reason, view.score);
    return;
  }

  const lock = s.revengeUntil[pair.mint];
  if (lock !== undefined && s.deskTime < lock) {
    s.stats.skips += 1;
    s.stats.revengeBlocks += 1;
    const reason = `No trade. Revenge lock on ${pair.symbol} for the rest of this book. The last exit lost money.`;
    say(s, "executor", "skip", pair.symbol, reason, "kill");
    say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
    decide(s, pair.symbol, pair.mint, "skip", reason);
    rememberTape(s, pair, "skip", reason, view.score);
    return;
  }

  if (s.opens.length >= MAX_POSITIONS) {
    s.stats.skips += 1;
    const reason = `No trade. ${MAX_POSITIONS} names is the book limit. Unused capital stays unused.`;
    say(s, "executor", "skip", pair.symbol, reason, "kill");
    say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
    decide(s, pair.symbol, pair.mint, "skip", reason);
    rememberTape(s, pair, "skip", reason, view.score);
    return;
  }

  const entryEquity = equityOf(s);
  const hardCap = entryEquity * MAX_PCT;
  const conviction = view.score >= 0.84 ? MAX_PCT : view.score >= 0.74 ? 0.06 : 0.04;
  const target = entryEquity * conviction;
  const affordable = s.cash / (1 + FEE);
  let size = Math.min(hardCap, target, affordable);
  size = Math.floor(size * 100) / 100;
  if (size > hardCap) size = Math.floor(hardCap * 100) / 100;

  if (!(size >= 25) || size > s.cash) {
    s.stats.skips += 1;
    const reason = `No trade. Cash cannot fund a ticket inside the 8% cap (cap ${money(hardCap)}, cash ${money(s.cash)}).`;
    say(s, "executor", "skip", pair.symbol, reason, "kill");
    say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
    decide(s, pair.symbol, pair.mint, "skip", reason);
    rememberTape(s, pair, "skip", reason, view.score);
    return;
  }

  const sizePct = size / entryEquity;
  if (sizePct > MAX_PCT + 0.0000001) {
    s.breaches.push(`${pair.symbol} sizing breached 8% (${(sizePct * 100).toFixed(3)}%).`);
    return;
  }

  const cost = cents(size * (1 + FEE));
  s.cash = cents(s.cash - cost);
  const gates: Gates = {
    mintRevoked: pair.mintRevoked === true,
    lpLocked: pair.lpLocked === true,
    top10Pct: pair.top10Pct ?? 100,
    volume1hUsd: pair.volume1hUsd,
    devPriorRugs: pair.devPriorRugs ?? 99,
    devWallet: pair.devWallet ?? "unknown",
  };
  const entryReason = `Bought ${money(size)} — ${(sizePct * 100).toFixed(2)}% of ${money(entryEquity)}. Hard cap is 8% (${money(hardCap)}) and was not crossed. ${gated.reason} ${view.reason}`;
  s.seq += 1;
  const fill: Fill = {
    id: `F${s.seq}`,
    mint: pair.mint,
    symbol: pair.symbol,
    name: pair.name,
    venue: pair.venue,
    source: pair.source,
    entryPrice: pair.priceUsd,
    price: pair.priceUsd,
    sizeUsd: size,
    sizePct,
    qty: size / pair.priceUsd,
    openedAt: s.deskTime,
    score: view.score,
    entryEquity,
    peakPnlPct: 0,
    trailArmed: false,
    trailStopPct: null,
    gates,
    entryReason,
    exitReason: null,
    exitKind: null,
    status: "open",
    exitPrice: null,
    closedAt: null,
    pnlUsd: null,
    pnlPct: null,
    template: { ...pair },
  };
  s.opens.push(fill);
  s.stats.buys += 1;
  say(s, "executor", "buy", pair.symbol, entryReason, "pass");
  const riskNote = `Risk armed on ${pair.symbol}. Hard stop −6% from entry. Trail stays off until +12%, then gives back 6 points from the peak. No adds.`;
  say(s, "risk", "note", pair.symbol, riskNote, "work");
  say(s, "logger", "note", pair.symbol, `Logged entry. ${entryReason}`, "pass");
  decide(s, pair.symbol, pair.mint, "buy", entryReason);
  rememberTape(s, pair, "buy", entryReason, view.score);
}

function closePosition(s: DeskState, pos: Fill, kind: "stop" | "trail", pnl: number, reason: string) {
  const proceeds = cents(pos.qty * pos.price * (1 - FEE));
  const pnlUsd = cents(proceeds - pos.sizeUsd);
  s.cash = cents(s.cash + proceeds);
  const closed: Fill = {
    ...pos,
    status: "closed",
    exitKind: kind,
    exitReason: reason,
    exitPrice: pos.price,
    closedAt: s.deskTime,
    pnlUsd,
    pnlPct: pnl,
  };
  s.closed.push(closed);
  if (kind === "stop") s.stats.stops += 1;
  else s.stats.trails += 1;
  if (pnlUsd < 0) {
    s.revengeUntil[pos.mint] = s.deskTime + REVENGE_MS;
    s.reissue.push({ ...pos.template, priceUsd: pos.price });
    if (s.reissue.length > 16) s.reissue.shift();
  }
  say(s, "risk", kind, pos.symbol, reason, kind === "stop" ? "kill" : "pass");
  say(s, "logger", "note", pos.symbol, `Logged exit. ${pos.symbol}: ${reason}`, "work");
  decide(s, pos.symbol, pos.mint, kind, reason);
}

function drawReturn(pos: Fill, rand: () => number): number {
  const drift = (pos.score - 0.8) * 0.0022;
  let ret = drift + 0.0105 * gauss(rand);
  if (rand() < 0.01 && pos.score >= 0.74) ret += 0.04 + rand() * 0.05;
  if (rand() < 0.005) ret -= 0.045 + rand() * 0.07;
  if (ret > 0.2) return 0.2;
  if (ret < -0.12) return -0.12;
  return ret;
}

function markBook(s: DeskState, rand: () => number) {
  const still: Fill[] = [];
  for (const pos of s.opens) {
    const price = Math.max(1e-8, pos.price * (1 + drawReturn(pos, rand)));
    const pnl = price / pos.entryPrice - 1;
    const peak = Math.max(pos.peakPnlPct, pnl);
    let trailArmed = pos.trailArmed;
    let trailStop = pos.trailStopPct;
    if (!trailArmed && peak >= TRAIL_ARM) {
      trailArmed = true;
      trailStop = peak - TRAIL_GIVE;
      say(
        s,
        "risk",
        "arm",
        pos.symbol,
        `Trail armed on ${pos.symbol}. Peak ${pct(peak)} cleared +12%. Stop ratchets to ${pct(trailStop)} (peak minus 6 points).`,
        "work",
      );
    } else if (trailArmed && trailStop !== null) {
      const ratcheted = peak - TRAIL_GIVE;
      if (ratcheted > trailStop + 0.01) trailStop = ratcheted;
    }
    const next: Fill = { ...pos, price, peakPnlPct: peak, trailArmed, trailStopPct: trailStop };
    if (pnl <= HARD_STOP) {
      closePosition(
        s,
        next,
        "stop",
        pnl,
        `Hard stop. ${pos.symbol} marked ${pct(pnl)}, through −6%. Sold at the print. No add on the way down.`,
      );
    } else if (trailArmed && trailStop !== null && pnl <= trailStop) {
      closePosition(
        s,
        next,
        "trail",
        pnl,
        `Trail stop. ${pos.symbol} peaked ${pct(peak)}, stop was ${pct(trailStop)}, mark ${pct(pnl)}. Banked. No revenge unless this fill lost money.`,
      );
    } else {
      still.push(next);
    }
  }
  s.opens = still;
}

export function noteMode(input: DeskState, mode: "paper" | "shadow"): DeskState {
  const s = copyState(input);
  s.mode = mode;
  if (mode === "shadow") {
    say(
      s,
      "logger",
      "note",
      null,
      "Live arm requested. No key is on file. Session marked shadow — orders will be written and withheld. Nothing will be signed or broadcast.",
      "work",
    );
  } else {
    say(s, "logger", "note", null, "Session returned to the paper book. Shadow arm is off.", "work");
  }
  return s;
}

export function stepMinute(input: DeskState): DeskState {
  const s = copyState(input);
  let rng = s.rng >>> 0;
  const rand = () => {
    const next = mulberry(rng);
    rng = next.seed;
    return next.value;
  };
  s.deskTime += MINUTE;

  const batch: Pair[] = [];
  if (s.inbox.length > 0) {
    const pub = s.inbox[0];
    if (pub) batch.push(pub);
    s.inbox = s.inbox.slice(1);
  }
  if (rand() < 0.92) batch.push(forgePair(s, rand));

  for (const pair of batch) runPipeline(s, pair);
  markBook(s, rand);

  const equity = cents(equityOf(s));
  s.equity.push({ t: s.deskTime, equity });
  if (s.equity.length > 1200) s.equity.splice(0, s.equity.length - 1200);

  const found = auditBook(s);
  for (const item of found) {
    if (!s.breaches.includes(item)) s.breaches.push(item);
  }
  s.rng = rng;
  return s;
}

export function prewarm(state: DeskState, minutes: number): DeskState {
  let s = copyState(state);
  s.warmed = true;
  const steps = Math.max(0, Math.floor(minutes));
  for (let i = 0; i < steps; i += 1) s = stepMinute(s);
  return s;
}

export function auditBook(s: DeskState): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const fill of s.opens) {
    if (seen.has(fill.mint)) problems.push(`${fill.symbol} opened twice — average down.`);
    seen.add(fill.mint);
  }
  const all = [...s.opens, ...s.closed];
  for (const fill of all) {
    if (fill.sizePct > MAX_PCT + 0.0001) {
      problems.push(`${fill.symbol} sized ${(fill.sizePct * 100).toFixed(2)}% of equity.`);
    }
    if (fill.score < MIN_SCORE) problems.push(`${fill.symbol} entered at ${fill.score.toFixed(2)}.`);
    if (!fill.gates.mintRevoked) problems.push(`${fill.symbol} entered with a live mint.`);
    if (!fill.gates.lpLocked) problems.push(`${fill.symbol} entered with LP unlocked.`);
    if (fill.gates.top10Pct > MAX_TOP10) problems.push(`${fill.symbol} entered with top 10 at ${fill.gates.top10Pct}.`);
    if (fill.gates.volume1hUsd < MIN_VOL) problems.push(`${fill.symbol} entered under the volume floor.`);
    if (fill.gates.devPriorRugs > 0) problems.push(`${fill.symbol} entered on a rug-linked dev.`);
    if (fill.source === "public") problems.push(`${fill.symbol} was a public print with unproven gates.`);
    if (fill.trailArmed && fill.peakPnlPct + 1e-9 < TRAIL_ARM) {
      problems.push(`${fill.symbol} trailed before +12%.`);
    }
    if (fill.exitKind === "trail" && fill.peakPnlPct < TRAIL_ARM) {
      problems.push(`${fill.symbol} trail exit before +12%.`);
    }
    if (fill.status === "open") {
      const pnl = fill.price / fill.entryPrice - 1;
      if (pnl <= HARD_STOP) problems.push(`${fill.symbol} still open through the hard stop (${pct(pnl)}).`);
    }
  }
  if (s.cash < -0.05) problems.push("Cash went negative.");
  return problems;
}

export function nightBounds(deskTime: number): { from: number; to: number; partial: boolean } {
  if (deskTime <= 0) return { from: 0, to: 0, partial: true };
  if (deskTime % NIGHT === 0) return { from: deskTime - NIGHT, to: deskTime, partial: false };
  const from = Math.floor(deskTime / NIGHT) * NIGHT;
  return { from, to: deskTime, partial: true };
}

function tradeView(fill: Fill): TradeView {
  const livePnl = fill.status === "open" ? fill.price / fill.entryPrice - 1 : fill.pnlPct;
  const liveUsd =
    fill.status === "open" ? cents(fill.qty * fill.price * (1 - FEE) - fill.sizeUsd) : fill.pnlUsd;
  return {
    symbol: fill.symbol,
    venue: fill.venue,
    score: fill.score,
    sizeUsd: fill.sizeUsd,
    sizePct: fill.sizePct,
    pnlUsd: liveUsd,
    pnlPct: livePnl,
    status: fill.status,
    entryReason: fill.entryReason,
    exitReason: fill.exitReason,
    openedAt: fill.openedAt,
    closedAt: fill.closedAt,
  };
}

export function buildRecap(s: DeskState, from: number, to = s.deskTime): Recap {
  const partial = to - from < NIGHT - MINUTE;
  const points = s.equity.filter((point) => point.t >= from && point.t <= to);
  const startEquity = points[0]?.equity ?? s.startCash;
  const endEquity = points[points.length - 1]?.equity ?? equityOf(s);
  let peak = startEquity;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity > peak) peak = point.equity;
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
  }

  const inWindow = (t: number | null) => t !== null && t > from && t <= to;
  const opened = [...s.closed, ...s.opens].filter((fill) => fill.openedAt > from && fill.openedAt <= to);
  const closedNow = s.closed.filter((fill) => inWindow(fill.closedAt));
  const trades = [...s.opens.map(tradeView), ...closedNow.map(tradeView)].sort((a, b) => a.openedAt - b.openedAt);
  const wins = closedNow.filter((fill) => (fill.pnlUsd ?? 0) > 0).length;
  const losses = closedNow.filter((fill) => (fill.pnlUsd ?? 0) <= 0).length;
  const realized = cents(closedNow.reduce((sum, fill) => sum + (fill.pnlUsd ?? 0), 0));
  const unrealized = cents(
    s.opens.reduce((sum, fill) => sum + (fill.qty * fill.price * (1 - FEE) - fill.sizeUsd), 0),
  );

  const decisions = s.decisions.filter((row) => row.t > from && row.t <= to);
  const count = (outcome: Decision["outcome"]) => decisions.filter((row) => row.outcome === outcome).length;
  const killBy = emptyKillBy();
  for (const row of decisions) {
    if (row.outcome !== "kill") continue;
    const code = inferKill(row.reason);
    if (code) killBy[code] += 1;
  }

  const closedViews = closedNow.map(tradeView);
  const best = closedViews.reduce<TradeView | null>(
    (pick, row) => (pick === null || (row.pnlUsd ?? 0) > (pick.pnlUsd ?? 0) ? row : pick),
    null,
  );
  const worst = closedViews.reduce<TradeView | null>(
    (pick, row) => (pick === null || (row.pnlUsd ?? 0) < (pick.pnlUsd ?? 0) ? row : pick),
    null,
  );

  const scanned = decisions.filter((row) => row.outcome === "kill" || row.outcome === "reject" || row.outcome === "skip" || row.outcome === "buy").length;
  const lines = decisions.map(
    (row) => `${deskClock(row.t)}  ${row.outcome.toUpperCase().padEnd(6, " ")}  ${row.symbol.padEnd(10, " ")}  ${row.reason}`,
  );

  const draft: Recap = {
    from,
    to,
    partial,
    startEquity,
    endEquity,
    maxDrawdown,
    realized,
    unrealized,
    scanned,
    killed: count("kill"),
    scored: opened.length + count("reject"),
    scoreRejected: count("reject"),
    buys: count("buy"),
    stops: count("stop"),
    trails: count("trail"),
    wins,
    losses,
    revengeBlocks: decisions.filter((row) => row.outcome === "skip" && row.reason.includes("Revenge lock")).length,
    addBlocks: decisions.filter((row) => row.outcome === "skip" && row.reason.includes("already on the book")).length,
    killBy,
    trades,
    breaches: s.breaches.slice(),
    mode: s.mode,
    best,
    worst,
    narrative: "",
    lines,
  };
  draft.narrative = narrate(draft);
  return draft;
}

function inferKill(reason: string): KillCode | null {
  if (reason.startsWith("No gate attestation")) return "unverified";
  if (reason.startsWith("Venue is outside")) return "venue";
  if (reason.startsWith("Mint authority")) return "mint";
  if (reason.startsWith("LP is not locked")) return "lp";
  if (reason.startsWith("Top 10")) return "holders";
  if (reason.startsWith("1h volume")) return "volume";
  if (reason.startsWith("Dev ")) return "dev";
  return null;
}

function narrate(r: Recap): string {
  const delta = r.endEquity - r.startEquity;
  const base = r.startEquity === 0 ? 0 : delta / r.startEquity;
  const direction = delta > 1 ? "higher" : delta < -1 ? "lower" : "flat";
  const window = r.partial ? "This is an interim read — the night is not closed." : "The night is closed.";
  const signing =
    r.mode === "shadow"
      ? "The session was armed as shadow: the same rules, orders written and then withheld. Nothing was signed."
      : "The session stayed on the paper book. Nothing was signed or broadcast.";
  const revenge =
    r.revengeBlocks > 0
      ? `Revenge re-entries refused: ${r.revengeBlocks}.`
      : "No revenge re-entry cleared the lock.";
  const adds =
    r.addBlocks > 0
      ? `Add attempts refused: ${r.addBlocks}.`
      : "No add was attempted.";
  const breach =
    r.breaches.length === 0
      ? "Rule breaches: 0."
      : `Rule breaches: ${r.breaches.length}. Do not trust the book until those are read.`;
  return [
    window,
    `Balance moved from ${money(r.startEquity)} to ${money(r.endEquity)} (${pct(base)}), ${direction}.`,
    `Max drawdown ${(r.maxDrawdown * 100).toFixed(1)}%.`,
    `Scout put ${r.scanned} names through the handoff. Filter killed ${r.killed}. Analyst refused ${r.scoreRejected} under 0.60. Executor filled ${r.buys}.`,
    `Risk stopped ${r.stops} on the −6% line and trailed ${r.trails} after they had cleared +12%.`,
    revenge,
    adds,
    breach,
    signing,
  ].join(" ");
}

export function nextNightTarget(deskTime: number): { from: number; target: number } {
  if (deskTime > 0 && deskTime % NIGHT === 0) {
    return { from: deskTime, target: deskTime + NIGHT };
  }
  const from = Math.floor(deskTime / NIGHT) * NIGHT;
  return { from, target: from + NIGHT };
}
