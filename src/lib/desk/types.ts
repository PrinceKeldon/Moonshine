export type Venue = "pump.fun" | "raydium";

export type AgentId = "scout" | "filter" | "analyst" | "executor" | "risk" | "logger";

export type Tone = "idle" | "pass" | "kill" | "work";

export type KillCode = "venue" | "unverified" | "mint" | "lp" | "holders" | "volume" | "dev";

export type Pair = {
  uid: string;
  mint: string;
  symbol: string;
  name: string;
  venue: Venue;
  priceUsd: number;
  volume1hUsd: number;
  liquidityUsd: number;
  mcapUsd: number;
  ageMin: number;
  buys1h: number;
  sells1h: number;
  mintRevoked: boolean | null;
  freezeRevoked: boolean | null;
  lpLocked: boolean | null;
  top10Pct: number | null;
  devWallet: string | null;
  devPriorRugs: number | null;
  devHistoryTokens?: number | null;
  safetyReason?: string | null;
  source: "index" | "public";
};

export type Gates = {
  mintRevoked: boolean;
  freezeRevoked: boolean;
  lpLocked: boolean;
  top10Pct: number;
  volume1hUsd: number;
  devPriorRugs: number;
  devWallet: string;
};

export type Fill = {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  venue: Venue;
  source: "index" | "public";
  entryPrice: number;
  price: number;
  sizeUsd: number;
  sizePct: number;
  qty: number;
  openedAt: number;
  score: number;
  entryEquity: number;
  peakPnlPct: number;
  trailArmed: boolean;
  trailStopPct: number | null;
  gates: Gates;
  entryReason: string;
  exitReason: string | null;
  exitKind: "stop" | "trail" | null;
  status: "open" | "closed";
  exitPrice: number | null;
  closedAt: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  template: Pair;
};

export type DeskLog = {
  id: string;
  t: number;
  agent: AgentId;
  symbol: string | null;
  kind: "scan" | "kill" | "pass" | "score" | "reject" | "buy" | "skip" | "arm" | "stop" | "trail" | "note";
  reason: string;
};

export type Decision = {
  t: number;
  symbol: string;
  mint: string;
  outcome: "kill" | "reject" | "skip" | "buy" | "stop" | "trail" | "time" | "agent_scale" | "agent_flatten";
  reason: string;
};

export type TapeRow = {
  id: string;
  t: number;
  symbol: string;
  venue: Venue;
  source: "index" | "public";
  volume1hUsd: number;
  outcome: "kill" | "reject" | "skip" | "buy";
  reason: string;
  score: number | null;
};

export type EquityPoint = { t: number; equity: number };

export type DeskStats = {
  scanned: number;
  killed: number;
  scored: number;
  scoreRejected: number;
  buys: number;
  skips: number;
  stops: number;
  trails: number;
  revengeBlocks: number;
  addBlocks: number;
  killBy: Record<KillCode, number>;
};

export type AgentSnap = { last: string; tone: Tone };

export type TradeView = {
  symbol: string;
  venue: Venue;
  score: number;
  sizeUsd: number;
  sizePct: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  status: "open" | "closed";
  entryReason: string;
  exitReason: string | null;
  openedAt: number;
  closedAt: number | null;
};

export type Recap = {
  from: number;
  to: number;
  partial: boolean;
  startEquity: number;
  endEquity: number;
  maxDrawdown: number;
  realized: number;
  unrealized: number;
  scanned: number;
  killed: number;
  scored: number;
  scoreRejected: number;
  buys: number;
  stops: number;
  trails: number;
  wins: number;
  losses: number;
  revengeBlocks: number;
  addBlocks: number;
  killBy: Record<KillCode, number>;
  trades: TradeView[];
  breaches: string[];
  mode: "paper" | "shadow";
  best: TradeView | null;
  worst: TradeView | null;
  narrative: string;
  lines: string[];
};

export type DeskState = {
  warmed: boolean;
  running: boolean;
  overnight: boolean;
  heldRun: boolean;
  nightTarget: number;
  recapFrom: number;
  recapOpen: boolean;
  recap: Recap | null;
  armOpen: boolean;
  mode: "paper" | "shadow";
  deskTime: number;
  rng: number;
  seq: number;
  cash: number;
  startCash: number;
  opens: Fill[];
  closed: Fill[];
  logs: DeskLog[];
  decisions: Decision[];
  equity: EquityPoint[];
  tape: TapeRow[];
  inbox: Pair[];
  marketCandidates: PublicPairDTO[];
  scanState: "idle" | "fetching" | "screening" | "live" | "offline";
  marketUpdatedAt: number | null;
  marketScanned: number;
  marketDropped: number;
  seenMints: string[];
  checkedMints: string[];
  rugDevs: string[];
  reissue: Pair[];
  revengeUntil: Record<string, number>;
  agents: Record<AgentId, AgentSnap>;
  stats: DeskStats;
  breaches: string[];
  publicTape: "idle" | "live" | "offline";
  tapeNote: string;
  watchAddress: string;
  watch: WatchSnapshot | null;
};

export type PublicPairDTO = {
  mint: string;
  symbol: string;
  name: string;
  venue: Venue;
  priceUsd: number;
  volume1hUsd: number;
  liquidityUsd: number;
  mcapUsd: number;
  ageMin: number;
  buys1h: number;
  sells1h: number;
  safetyState?: "checking" | "checked" | "unavailable";
  safetyChecked?: boolean;
  mintRevoked?: boolean | null;
  freezeRevoked?: boolean | null;
  lpLocked?: boolean | null;
  top10Pct?: number | null;
  creator?: string | null;
  devPriorRugs?: number | null;
  creatorHistoryAvailable?: boolean;
  creatorTokenCount?: number | null;
  safetyReason?: string | null;
};

export type PublicTapeResult = {
  ok: boolean;
  pairs: PublicPairDTO[];
  scanned: number;
  dropped: number;
};

export type WatchToken = {
  mint: string;
  symbol: string;
  amount: number;
  usd: number | null;
};

export type WatchSnapshot = {
  address: string;
  sol: number;
  solUsd: number | null;
  tokens: WatchToken[];
  fetchedAt: number;
};

export type WatchResult = {
  ok: boolean;
  snapshot: WatchSnapshot | null;
  error: string | null;
};
