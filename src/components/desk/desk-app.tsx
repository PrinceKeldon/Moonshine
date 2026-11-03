import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import {
  Check,
  Crosshair,
  Filter,
  LoaderCircle,
  Pause,
  Play,
  Radar,
  Scale,
  ScrollText,
  Search,
  Shield,
  Sunrise,
  X,
} from "lucide-react";
import { RecapScreen } from "@/components/desk/recap";
import { WalletButton } from "@/components/desk/wallet";
import { LiveButton } from "@/components/desk/live-panel";
import { runLiveCycle } from "@/lib/desk/autotrade";
import { bootLive, reconnectPhantom } from "@/lib/desk/solana-wallet";
import { AGENT_META, equityOf, PAPER_MIN_SCORE, PAPER_MIN_VOL, SESSION } from "@/lib/desk/engine";
import { compactUsd, deskClock, money, pct, pxPrice } from "@/lib/desk/format";
import { fetchMintPair, fetchPublicTape } from "@/lib/desk/public-tape";
import { markPrices, screenMint } from "@/lib/desk/live-chain";
import type { ScreenResult } from "@/lib/desk/live-chain";
import {
  MAX_PCT,
  MIN_BREAKOUT_LIQ,
  MIN_BREAKOUT_VOL,
  MIN_LIVE_LIQ,
  MIN_LIVE_SCORE,
  MIN_LIVE_VOL,
  MIN_TICKET_SOL,
  LIVE_RESERVE_SOL,
  liveScore,
  tapeBlock,
  ticketSol,
} from "@/lib/desk/live-score";
import { activeAddress, useLive } from "@/lib/desk/live-store";
import { bootDesk, useDesk } from "@/lib/desk/store";
import type { AgentId, DeskLog, Fill, PublicPairDTO, TapeRow } from "@/lib/desk/types";
import { cn } from "@/lib/utils";

const RULES = [
  "Public listings only",
  "Live new: $15k vol / $4k liq",
  "Live breakout: $50k / $10k",
  "Live score ≥ 0.45",
  "RugCheck gates required",
  "Indexed creator history required",
  "Paper fills only",
  "Prices refresh every 20s",
  "Size ≤ 8%",
  "Stop −6%",
  "Trail after +12%",
  "No average down",
  "No revenge",
];

const ICONS: Record<AgentId, typeof Radar> = {
  scout: Radar,
  filter: Filter,
  analyst: Scale,
  executor: Crosshair,
  risk: Shield,
  logger: ScrollText,
};

type Tab = "book" | "tape" | "log";
type LogFilter = "all" | "rej" | "orders" | "risk";

export function DeskApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const finish = () => {
      if (!alive) return;
      bootDesk();
      setReady(true);
    };
    const unsub = useDesk.persist.onFinishHydration(finish);
    if (useDesk.persist.hasHydrated()) finish();
    else void useDesk.persist.rehydrate();
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const running = useDesk((s) => s.running);

  useEffect(() => {
    if (!ready || !running) return;
    useDesk.getState().tick();
    const id = window.setInterval(() => useDesk.getState().tick(), 60_000);
    return () => window.clearInterval(id);
  }, [ready, running]);

  useEffect(() => {
    if (!ready) return;
    let stop = false;
    let pulling = false;
    const safetyCache = new Map<string, ScreenResult>();
    const safetyAttemptAt = new Map<string, number>();
    const pull = async () => {
      if (pulling) return;
      pulling = true;
      useDesk.getState().setScanState("fetching");
      try {
        const res = await fetchPublicTape();
        if (stop) return;
        if (!res.ok) {
          useDesk.getState().ingestPublic(res);
        } else {
          useDesk.getState().stagePublicCandidates(res);
          const pairs: PublicPairDTO[] = [];
          for (let index = 0; index < res.pairs.length; index += 2) {
            const batch = await Promise.all(
              res.pairs.slice(index, index + 2).map(async (pair) => {
                let safety = safetyCache.get(pair.mint);
                const attemptedAt = safetyAttemptAt.get(pair.mint) ?? 0;
                const retryDue =
                  safety !== undefined &&
                  Date.now() - attemptedAt >= 60_000 &&
                  (!safety.reportAvailable || (Boolean(safety.creator) && !safety.creatorHistoryAvailable));
                if (!safety || retryDue) {
                  safetyAttemptAt.set(pair.mint, Date.now());
                  try {
                    safety = await screenMint({
                      data: { mint: pair.mint, venue: pair.venue, includeCreatorHistory: true },
                    });
                  } catch {
                    safety = {
                      ok: false,
                      reportAvailable: false,
                      reason: "RugCheck request failed.",
                      mintRevoked: null,
                      freezeRevoked: null,
                      lpLocked: null,
                      top10: null,
                      lpLockedPct: null,
                      creator: null,
                      creatorHistoryAvailable: false,
                      creatorTokenCount: null,
                      devPriorRugs: null,
                    };
                  }
                  safetyCache.set(pair.mint, safety);
                }
                return {
                  ...pair,
                  safetyState: safety?.reportAvailable
                    ? ("checked" as const)
                    : safety
                      ? ("unavailable" as const)
                      : ("checking" as const),
                  safetyChecked: safety?.reportAvailable ?? false,
                  mintRevoked: safety?.mintRevoked ?? null,
                  freezeRevoked: safety?.freezeRevoked ?? null,
                  lpLocked: safety?.lpLocked ?? null,
                  top10Pct: safety?.top10 ?? null,
                  creator: safety?.creator ?? null,
                  devPriorRugs: safety?.devPriorRugs ?? null,
                  creatorHistoryAvailable: safety?.creatorHistoryAvailable ?? false,
                  creatorTokenCount: safety?.creatorTokenCount ?? null,
                  safetyReason: safety?.ok ? null : safety?.reason ?? "RugCheck report unavailable.",
                };
              }),
            );
            pairs.push(...batch);
            if (stop) return;
          }
          useDesk.getState().ingestPublic({ ...res, pairs });
        }
      } catch {
        if (!stop) useDesk.getState().ingestPublic({ ok: false, pairs: [], scanned: 0, dropped: 0 });
      } finally {
        pulling = false;
      }
      const mints = useDesk.getState().opens.map((position) => position.mint);
      if (!stop && mints.length > 0) {
        try {
          const marks = await markPrices({ data: { mints } });
          if (!stop && marks.ok) useDesk.getState().markPaperPrices(marks.prices);
        } catch {
          // Keep the last public mark until the next refresh.
        }
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 20000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [ready]);

  const liveWatch = useLive((s) => s.armed || s.positions.length > 0);

  useEffect(() => {
    let stop = false;
    void bootLive().then(() => {
      if (!stop) void reconnectPhantom();
    });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!liveWatch) return;
    let stop = false;
    const pull = () => {
      if (!stop) void runLiveCycle();
    };
    pull();
    const id = window.setInterval(pull, 20000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [liveWatch]);

  if (!ready) return <Skeleton />;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-bg text-fg">
      <Header />
      <ul className="flex w-full min-w-0 shrink-0 gap-1.5 overflow-x-auto px-3 py-2">
        {RULES.map((rule) => (
          <li key={rule} className="shrink-0 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-muted">
            {rule}
          </li>
        ))}
      </ul>
      <Metrics />
      <Agents />
      <Workspace />
      <RecapGate />
    </div>
  );
}

function Skeleton() {
  return (
    <main className="flex h-svh flex-col bg-bg px-4 py-6 text-fg">
      <p className="font-mono text-xs tracking-widest text-amber">KEEL</p>
      <h1 className="mt-2 text-2xl font-medium">Opening the paper book</h1>
      <p className="mt-2 max-w-md text-sm text-muted">Scout, Filter, Analyst, Executor, Risk, Logger. Nothing is signed.</p>
    </main>
  );
}

function Header() {
  const deskTime = useDesk((s) => s.deskTime);
  const running = useDesk((s) => s.running);
  const nightTarget = useDesk((s) => s.nightTarget);
  const recapFrom = useDesk((s) => s.recapFrom);
  const mode = useDesk((s) => s.mode);
  const publicTape = useDesk((s) => s.publicTape);
  const scanState = useDesk((s) => s.scanState);
  const toggleRun = useDesk((s) => s.toggleRun);
  const startNight = useDesk((s) => s.startNight);
  const openRecap = useDesk((s) => s.openRecap);
  const setPaper = useDesk((s) => s.setPaper);
  const reset = useDesk((s) => s.reset);
  const liveOn = useLive((s) => s.armed);
  const livePositions = useLive((s) => s.positions.length);
  const liveStatus = useLive((s) => s.status);
  const [confirmReset, setConfirmReset] = useState(false);

  const sessionOpen = nightTarget - recapFrom >= SESSION - 60_000 && deskTime < nightTarget;
  const sessionLeft = Math.max(0, nightTarget - deskTime);
  const tapeLabel =
    scanState === "fetching"
      ? "Fetching public market"
      : scanState === "screening"
      ? "Screening live candidates"
      : publicTape === "live"
        ? "Live market · paper trades"
        : publicTape === "offline"
          ? "Live market offline"
          : "Live market connecting";

  return (
    <header className="w-full min-w-0 shrink-0 border-b border-line">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <div>
            <div className="font-mono text-sm tracking-widest">KEEL</div>
            <div className="text-xs text-muted">Capital stays first</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md px-2 py-1 font-mono text-xs", liveOn ? "bg-amber text-ink" : mode === "shadow" ? "bg-amber text-ink" : "bg-raised text-up")}>
            {liveOn ? "LIVE" : mode === "shadow" ? "SHADOW" : "PAPER"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("size-1.5 rounded-full", running ? "bg-up keel-pulse" : "bg-dim")} aria-hidden="true" />
            {tapeLabel}
          </span>
        </div>
        <p className="num font-mono text-lg" aria-label="Desk clock">
          {deskClock(deskTime)}
          {sessionOpen ? <span className="ml-2 text-xs text-amber">{deskClock(sessionLeft)} left in 24h</span> : <span className="ml-2 text-xs text-dim">24h paper</span>}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (running || sessionOpen ? toggleRun() : startNight())}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-up px-3 text-sm font-medium text-ink"
          >
            {running ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {running ? "Pause" : sessionOpen ? "Resume" : "Run 24h"}
          </button>
          <button type="button" onClick={openRecap} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
            <Sunrise className="size-4" aria-hidden="true" />
            Recap
          </button>
          <WalletButton />
          <LiveButton />
          {mode === "paper" ? null : (
            <button type="button" onClick={setPaper} className="inline-flex min-h-11 items-center rounded-md border border-amber px-3 text-sm text-amber">
              Back to paper
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              reset();
              setConfirmReset(false);
            }}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-dim"
          >
            {confirmReset ? "Confirm reset" : "Reset"}
          </button>
        </div>
      </div>
      {liveOn ? (
        <p className="border-t border-line px-3 py-1.5 text-xs text-amber">Live. {liveStatus}</p>
      ) : livePositions > 0 ? (
        <p className="border-t border-line px-3 py-1.5 text-xs text-amber">Disarmed. {livePositions} chain name{livePositions === 1 ? "" : "s"} still watched for stops.</p>
      ) : null}
      {mode === "shadow" ? (
        <p className="border-t border-line px-3 py-1.5 text-xs text-amber">Shadow arm. The agents still write orders. Nothing is signed or broadcast.</p>
      ) : null}
    </header>
  );
}

function Metrics() {
  const cash = useDesk((s) => s.cash);
  const opens = useDesk((s) => s.opens);
  const startCash = useDesk((s) => s.startCash);
  const stats = useDesk((s) => s.stats);
  const equity = equityOf({ cash, opens });
  const delta = equity - startCash;
  const deployed = opens.reduce((sum, row) => sum + row.qty * row.price, 0);
  return (
    <section className="grid shrink-0 grid-cols-2 gap-2 px-3 lg:grid-cols-4" aria-label="Balance">
      <Metric label="Balance" value={money(equity)} note={pct(startCash ? delta / startCash : 0) + " session"} noteClass={delta >= 0 ? "text-up" : "text-down"} />
      <Metric label="Cash" value={money(cash)} note="Undeployed" noteClass="text-muted" />
      <Metric label="Open risk" value={money(deployed)} note={`${opens.length} names · 8% cap each`} noteClass="text-muted" />
      <Metric label="Fills / kills" value={`${stats.buys} / ${stats.killed}`} note={`${stats.stops} stops · ${stats.trails} trails`} noteClass="text-muted" />
    </section>
  );
}

function Metric({ label, value, note, noteClass }: { label: string; value: string; note: string; noteClass: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="num font-mono text-lg">{value}</div>
      <div className={cn("num font-mono text-xs", noteClass)}>{note}</div>
    </div>
  );
}

function Agents() {
  const agents = useDesk((s) => s.agents);
  const tapeNote = useDesk((s) => s.tapeNote);
  return (
    <section className="w-full min-w-0 shrink-0 px-3 py-2" aria-label="Agent activity">
      <div className="flex gap-1.5 overflow-x-auto lg:grid lg:grid-cols-6 lg:overflow-visible">
        {AGENT_META.map((agent, index) => {
          const snap = agents[agent.id];
          const Icon = ICONS[agent.id];
          const border = snap.tone === "kill" ? "border-down" : snap.tone === "pass" ? "border-up" : snap.tone === "work" ? "border-amber" : "border-line";
          return (
            <article key={agent.id} className={cn("w-44 shrink-0 rounded-md border bg-surface px-2.5 py-2 lg:w-auto", border)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="text-sm font-medium">{agent.name}</h2>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-fg">{snap.last}</p>
              <p className="mt-1 line-clamp-2 text-xs text-dim">
                {agent.id === "scout" ? tapeNote : agent.id === "analyst" ? `Paper ≥${PAPER_MIN_SCORE.toFixed(2)} · live ≥0.45` : agent.duty}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Workspace() {
  const [tab, setTab] = useState<Tab>("book");
  const [filter, setFilter] = useState<LogFilter>("all");
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 gap-2 px-3 pb-2 lg:grid-cols-12">
        <Panel title="Scanner" hint="Live candidates · agent decisions" className={cn("lg:col-span-3", tab === "tape" ? "flex" : "hidden lg:flex")}>
          <Tape />
        </Panel>
        <Panel title="Book" hint="Equity and open risk" className={cn("lg:col-span-5", tab === "book" ? "flex" : "hidden lg:flex")}>
          <Book />
        </Panel>
        <Panel
          title="Log"
          hint="Reason on every decision"
          className={cn("lg:col-span-4", tab === "log" ? "flex" : "hidden lg:flex")}
          extra={<LogFilters filter={filter} onChange={setFilter} />}
        >
          <LogList filter={filter} />
        </Panel>
      </div>
      <nav className="grid shrink-0 grid-cols-3 border-t border-line lg:hidden" aria-label="Desk sections">
        {(
          [
            ["book", "Book"],
            ["tape", "Tape"],
            ["log", "Log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("min-h-11 text-sm", tab === id ? "text-up" : "text-muted")}
            aria-pressed={tab === id}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Panel({
  title,
  hint,
  className,
  extra,
  children,
}: {
  title: string;
  hint: string;
  className?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-dim">{hint}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Tape() {
  const tape = useDesk((s) => s.tape);
  const candidates = useDesk((s) => s.marketCandidates);
  const inbox = useDesk((s) => s.inbox);
  const scanState = useDesk((s) => s.scanState);
  const marketUpdatedAt = useDesk((s) => s.marketUpdatedAt);
  const marketScanned = useDesk((s) => s.marketScanned);
  const marketDropped = useDesk((s) => s.marketDropped);
  const scanLabel =
    scanState === "screening"
      ? "Checking RugCheck and creator history"
      : scanState === "offline"
        ? "Feed offline · last snapshot shown"
        : scanState === "fetching"
          ? "Fetching public market"
          : scanState === "live"
            ? "Public feed live · refreshes every 20s"
            : "Waiting for the public feed";
  return (
    <div className="scroll min-h-0 flex-1 overflow-y-auto">
      <ManualScan />
      <div className="border-b border-line px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg">Live candidates</h3>
          <span className="font-mono text-xs text-muted">{candidates.length} · {inbox.length} queued</span>
        </div>
        <p className="mt-1 text-xs text-dim">
          {scanLabel}
          {marketUpdatedAt ? ` · ${new Date(marketUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          {marketScanned > 0 ? ` · ${marketScanned} mints scanned` : ""}
          {marketDropped > 0 ? ` · ${marketDropped} other venues skipped` : ""}
        </p>
      </div>
      {candidates.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted">
          {scanState === "offline" ? "No current snapshot. The scanner will resume when public data returns." : "No Pump.fun or Raydium candidates in this feed snapshot."}
        </p>
      ) : (
        <ul>
          {candidates.map((pair) => <CandidateRow key={pair.mint} pair={pair} />)}
        </ul>
      )}
      <div className="border-y border-line bg-bg/40 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg">Agent decisions</h3>
          <span className="font-mono text-xs text-muted">{tape.length}</span>
        </div>
      </div>
      {tape.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted">Candidates are queued for the scan pipeline. Decisions will appear here.</p>
      ) : (
        <ul>
          {tape.map((row) => (
            <li key={`${row.id}-${row.t}`} className="border-b border-line px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm">
                  {row.symbol}
                  <span className="ml-2 text-xs text-dim">{row.venue}</span>
                </span>
                <Outcome row={row} />
              </div>
              <p className="mt-0.5 font-mono text-xs text-dim">
                {deskClock(row.t)} · {row.source === "public" ? "public" : "index"} · {compactUsd(row.volume1hUsd)} 1h
                {row.score !== null ? ` · ${row.score.toFixed(2)}` : ""}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-snug text-muted">{row.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type StageState = "pass" | "blocked" | "diagnostic" | "not-run";

type ManualStage = {
  name: string;
  state: StageState;
  reason: string;
};

type ManualResult = {
  pair: PublicPairDTO;
  screen: ScreenResult;
  score: number;
  stages: ManualStage[];
};

function screenIssues(pair: PublicPairDTO, screen: ScreenResult): string[] {
  const issues: string[] = [];
  if (!screen.reportAvailable) issues.push(screen.reason);
  else if (!screen.ok) issues.push(screen.reason);
  if (!screen.creator) issues.push("Creator address is missing.");
  if (!screen.creatorHistoryAvailable || screen.devPriorRugs === null) {
    issues.push("Creator history is not indexed; unknown remains blocked.");
  } else if (screen.devPriorRugs > 0) {
    issues.push(`Creator has ${screen.devPriorRugs} prior rug${screen.devPriorRugs === 1 ? "" : "s"}.`);
  }
  if (pair.venue === "raydium" && screen.lpLockedPct !== null && screen.lpLockedPct < 80) {
    issues.push(`Raydium LP lock is ${screen.lpLockedPct.toFixed(0)}%; at least 80% is required.`);
  }
  return [...new Set(issues)];
}

function ManualScan() {
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualResult | null>(null);
  const armed = useLive((state) => state.armed);
  const signer = useLive((state) => state.signer);
  const phantom = useLive((state) => state.phantom);
  const deskPubkey = useLive((state) => state.deskPubkey);
  const sol = useLive((state) => state.sol);
  const halted = useLive((state) => state.halted);
  const positions = useLive((state) => state.positions);
  const maxPositions = useLive((state) => state.maxPositions);
  const solPerTrade = useLive((state) => state.solPerTrade);
  const locks = useLive((state) => state.locks);

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const address = mint.trim();
    try {
      const market = await fetchMintPair({ data: { mint: address } });
      if (!market.ok || !market.pair) {
        setError(market.error ?? "No supported market pair was found.");
        return;
      }

      const pair = market.pair;
      const screen = await screenMint({
        data: { mint: pair.mint, venue: pair.venue, includeCreatorHistory: true },
      });
      const filterIssues = [tapeBlock(pair), ...screenIssues(pair, screen)].filter(
        (issue): issue is string => Boolean(issue),
      );
      const filterPassed = filterIssues.length === 0;
      const score = liveScore(pair, screen.top10);
      const analystPassed = score >= MIN_LIVE_SCORE;
      const owner = activeAddress({ signer, phantom, deskPubkey });
      const ticket = sol === null ? null : ticketSol(sol, solPerTrade);
      const executorIssues: string[] = [];
      if (halted) executorIssues.push(halted);
      if (positions.some((position) => position.mint === pair.mint)) executorIssues.push("This mint is already open.");
      if ((locks[pair.mint] ?? 0) > Date.now()) executorIssues.push("This mint is in the revenge lock.");
      if (positions.length >= maxPositions) executorIssues.push(`Live book is full (${maxPositions} positions).`);
      if (!owner) executorIssues.push("No signer address is configured.");
      if (!armed) executorIssues.push("Live is disarmed.");
      if (ticket === null) executorIssues.push("Wallet balance has not been refreshed.");
      else if (ticket < MIN_TICKET_SOL) executorIssues.push(`Ticket is below ${MIN_TICKET_SOL} SOL after the cap and reserve.`);

      const executorPassed = filterPassed && analystPassed && executorIssues.length === 0;
      const riskIssues = [
        ...(halted ? [halted] : []),
        ...(positions.some((position) => position.mint === pair.mint) ? ["This mint is already open."] : []),
        ...((locks[pair.mint] ?? 0) > Date.now() ? ["This mint is in the revenge lock."] : []),
        ...(positions.length >= maxPositions ? [`Position limit reached (${maxPositions}).`] : []),
        ...(ticket !== null && ticket < MIN_TICKET_SOL ? [`Risk-sized ticket is below ${MIN_TICKET_SOL} SOL.`] : []),
      ];
      setResult({
        pair,
        screen,
        score,
        stages: [
          { name: "Scout", state: "pass", reason: "Mint found on DexScreener; selected the deepest supported Solana pair." },
          {
            name: "Filter",
            state: filterPassed ? "pass" : "blocked",
            reason: filterPassed ? "Market and safety gates passed." : filterIssues.join(" "),
          },
          {
            name: "Analyst",
            state: "diagnostic",
            reason: `Analysis completed. Diagnostic score ${score.toFixed(2)}; live minimum ${MIN_LIVE_SCORE.toFixed(2)} is ${analystPassed ? "met" : "not met"}. Live Filter results do not stop this read-only analysis.`,
          },
          {
            name: "Executor",
            state: executorPassed ? "pass" : "blocked",
            reason: `${!filterPassed ? `Live Filter blocked: ${filterIssues.join(" ")} ` : ""}${!analystPassed ? `Analyst score is below ${MIN_LIVE_SCORE.toFixed(2)}. ` : ""}${executorPassed
              ? `Live preflight clear for ${ticket?.toFixed(3)} SOL; manual scans still never submit swaps.`
              : `Live preflight blocked: ${executorIssues.join(" ")}`}`,
          },
          {
            name: "Risk",
            state: "diagnostic",
            reason: `Read-only risk preflight; not trade approval. ${!filterPassed ? `Live Filter blocked: ${filterIssues.join(" ")} ` : ""}${!analystPassed ? `Analyst score is below ${MIN_LIVE_SCORE.toFixed(2)}. ` : ""}${riskIssues.length ? riskIssues.join(" ") + " " : "Risk checks are clear. "}Hard stop −6%; trail arms +12%; max ${(MAX_PCT * 100).toFixed(0)}% of balance, with ${LIVE_RESERVE_SOL} SOL reserve; daily loss halt ${useLive.getState().dailyLossSol} SOL.`,
          },
        ],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Manual scan could not complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-line bg-bg/40 px-3 py-3" aria-labelledby="manual-scan-title">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-amber" aria-hidden="true" />
        <h3 id="manual-scan-title" className="text-xs font-medium uppercase tracking-wide text-fg">Manual mint scan</h3>
      </div>
      <p className="mt-1 text-xs leading-snug text-dim">
        Read-only diagnostics report live gates without stopping analysis. No order is signed or submitted.
      </p>
      <form className="mt-2 flex gap-2" onSubmit={scan}>
        <label className="sr-only" htmlFor="manual-mint">Solana token mint</label>
        <input
          id="manual-mint"
          value={mint}
          onChange={(event) => setMint(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={44}
          placeholder="Paste Solana contract address"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-xs text-fg placeholder:text-dim"
        />
        <button
          type="submit"
          disabled={busy || !mint.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-up px-3 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Scanning" : "Scan"}
        </button>
      </form>
      <p className="mt-2 text-[10px] leading-snug text-dim">
        Intake: new pairs ≥ {compactUsd(MIN_LIVE_VOL)} 1h volume / {compactUsd(MIN_LIVE_LIQ)} liquidity; breakouts ≥ {compactUsd(MIN_BREAKOUT_VOL)} / {compactUsd(MIN_BREAKOUT_LIQ)}; score ≥ {MIN_LIVE_SCORE.toFixed(2)}.
      </p>
      <p className="mt-1 text-[10px] leading-snug text-amber">
        Paper simulation: no age cutoff, ≥ {compactUsd(PAPER_MIN_VOL)} 1h volume, score ≥ {PAPER_MIN_SCORE.toFixed(2)}. Rug, authority, LP-lock, holder, and creator-history safety checks still apply.
      </p>
      {error ? <p className="mt-2 text-xs text-down" role="alert">{error}</p> : null}
      {result ? (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm">{result.pair.symbol} · {result.pair.venue}</p>
              <p className="truncate font-mono text-[10px] text-dim">{result.pair.mint}</p>
            </div>
            <a
              className="min-h-11 shrink-0 py-2 text-xs text-up underline-offset-2 hover:underline"
              href={`https://dexscreener.com/solana/${result.pair.mint}`}
              target="_blank"
              rel="noreferrer"
            >
              Chart
            </a>
          </div>
          <p className="mt-1 text-xs text-muted">
            {compactUsd(result.pair.liquidityUsd)} liquidity · {compactUsd(result.pair.volume1hUsd)} 1h volume · age {Math.floor(result.pair.ageMin / 1440)}d
          </p>
          <ol className="mt-2 space-y-1.5">
            {result.stages.map((stage) => (
              <li key={stage.name} className="flex gap-2 text-xs">
                <StageIcon state={stage.state} />
                <div className="min-w-0">
                  <span className="font-medium">{stage.name}: </span>
                  <span className={stage.state === "blocked" ? "text-down" : stage.state === "pass" ? "text-up" : stage.state === "diagnostic" ? "text-amber" : "text-dim"}>
                    {stage.reason}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "pass") return <Check className="mt-0.5 size-3.5 shrink-0 text-up" aria-label="Passed" />;
  if (state === "blocked") return <X className="mt-0.5 size-3.5 shrink-0 text-down" aria-label="Blocked" />;
  if (state === "diagnostic") return <Search className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="Diagnostic only" />;
  return <span className="mt-1 size-2.5 shrink-0 rounded-full border border-dim" aria-label="Not run" />;
}

function CandidateRow({ pair }: { pair: PublicPairDTO }) {
  const creator = pair.creator ? `${pair.creator.slice(0, 5)}…${pair.creator.slice(-5)}` : null;
  let gateLabel = "Screening";
  let gateClass = "text-amber";
  let detail = "RugCheck and creator history are being checked.";
  if (pair.safetyState === "unavailable") {
    gateLabel = "Safety data unavailable";
    gateClass = "text-down";
    detail = pair.safetyReason ?? "RugCheck did not return a report. Candidate is blocked.";
  } else if (pair.safetyState === "checked" && pair.safetyReason) {
    gateLabel = "RugCheck blocked";
    gateClass = "text-down";
    detail = pair.safetyReason;
  } else if (pair.safetyState === "checked" && !creator) {
    gateLabel = "Creator unknown";
    gateClass = "text-down";
    detail = "RugCheck did not identify a creator; candidate is blocked.";
  } else if (pair.safetyState === "checked" && pair.devPriorRugs === null) {
    gateLabel = "Creator history unknown";
    gateClass = "text-down";
    detail = "No indexed Scorp record or lookup failed. Unknown stays blocked.";
  } else if (pair.devPriorRugs && pair.devPriorRugs > 0) {
    gateLabel = `${pair.devPriorRugs} prior rugs reported`;
    gateClass = "text-down";
    detail = `Scorp tracked ${pair.creatorTokenCount ?? "some"} creator launches.`;
  } else if (pair.safetyState === "checked" && pair.devPriorRugs === 0) {
    gateLabel = "Safety gates clear";
    gateClass = "text-up";
    detail = `Scorp tracked ${pair.creatorTokenCount ?? 0} launches with 0 reported rugs; volume and score still gate entry.`;
  }

  return (
    <li className="border-b border-line px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-sm">
          {pair.symbol}<span className="ml-2 text-xs text-dim">{pair.venue}</span>
        </span>
        <span className="num shrink-0 font-mono text-sm">{pxPrice(pair.priceUsd)}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-dim">{pair.name} · {Math.floor(pair.ageMin)}m old · liquidity {compactUsd(pair.liquidityUsd)}</p>
      <p className="mt-0.5 font-mono text-xs text-dim">1h volume {compactUsd(pair.volume1hUsd)} · mcap {compactUsd(pair.mcapUsd)}</p>
      <p className="mt-1 font-mono text-[10px] text-dim">
        Mint {authorityState(pair.mintRevoked)} · freeze {authorityState(pair.freezeRevoked)} · LP {pair.lpLocked === null || pair.lpLocked === undefined ? "unknown" : pair.lpLocked ? "locked" : "unlocked"} · top 10 {pair.top10Pct == null ? "unknown" : `${pair.top10Pct.toFixed(1)}%`}
      </p>
      <p className={cn("mt-1 text-xs font-medium", gateClass)}>{gateLabel}</p>
      <p className="line-clamp-2 text-xs leading-snug text-muted">{detail}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] text-dim">Creator {creator ?? "not identified"}</span>
        <a className="shrink-0 text-xs text-up underline-offset-2 hover:underline" href={`https://dexscreener.com/solana/${pair.mint}`} target="_blank" rel="noreferrer">Chart</a>
      </div>
    </li>
  );
}

function authorityState(revoked: boolean | null | undefined): string {
  if (revoked === true) return "revoked";
  if (revoked === false) return "live";
  return "unknown";
}

function Outcome({ row }: { row: TapeRow }) {
  const label = row.outcome === "kill" ? "Killed" : row.outcome === "reject" ? "Score rejected" : row.outcome === "skip" ? "Skipped" : "Filled";
  const color = row.outcome === "buy" ? "text-up" : row.outcome === "kill" ? "text-down" : "text-amber";
  return <span className={cn("font-mono text-xs", color)}>{label}</span>;
}

function Book() {
  const equity = useDesk((s) => s.equity);
  const opens = useDesk((s) => s.opens);
  const startCash = useDesk((s) => s.startCash);
  const last = equity[equity.length - 1]?.equity ?? startCash;
  const down = last < startCash;
  const stroke = down ? "var(--color-down)" : "var(--color-up)";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-36 shrink-0 px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={equity} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<EquityTip />} />
            <Area type="monotone" dataKey="equity" stroke={stroke} fill={stroke} fillOpacity={0.16} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="scroll min-h-0 flex-1 overflow-y-auto border-t border-line">
        {opens.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted">No risk on. The book is flat, and that is allowed.</li>
        ) : (
          opens.map((row) => <PositionRow key={row.id} row={row} />)
        )}
      </ul>
    </div>
  );
}

function EquityTip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ value?: number; payload?: { t: number } }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  if (point?.value === undefined || point.payload === undefined) return null;
  return (
    <div className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs">
      <div className="text-dim">{deskClock(point.payload.t)}</div>
      <div>{money(point.value)}</div>
    </div>
  );
}

function PositionRow({ row }: { row: Fill }) {
  const pnl = row.price / row.entryPrice - 1;
  return (
    <li className="border-b border-line px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm">
          {row.symbol}
          <span className="ml-2 text-xs text-dim">{row.venue}</span>
        </span>
        <span className={cn("num font-mono text-sm", pnl >= 0 ? "text-up" : "text-down")}>{pct(pnl)}</span>
      </div>
      <p className="mt-0.5 font-mono text-xs text-dim">
        {money(row.sizeUsd)} · {(row.sizePct * 100).toFixed(2)}% · score {row.score.toFixed(2)} · {pxPrice(row.price)}
      </p>
      <PnlTrack pnl={pnl} />
      <p className="mt-1 text-xs text-muted">
        {row.trailArmed && row.trailStopPct !== null
          ? `Trail on. Stop ${pct(row.trailStopPct)} (peak ${pct(row.peakPnlPct)}).`
          : "Hard stop −6%. Trail stays off until +12%."}
      </p>
    </li>
  );
}

function PnlTrack({ pnl }: { pnl: number }) {
  const min = -0.1;
  const max = 0.26;
  const place = (value: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    return `${((clamped - min) / (max - min)) * 100}%`;
  };
  return (
    <div className="relative mt-2 h-1.5 rounded-full bg-raised" aria-hidden="true">
      <span className="absolute inset-y-0 w-px bg-down" style={{ left: place(-0.06) }} />
      <span className="absolute inset-y-0 w-px bg-amber" style={{ left: place(0.12) }} />
      <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg" style={{ left: place(pnl) }} />
    </div>
  );
}

function LogFilters({ filter, onChange }: { filter: LogFilter; onChange: (next: LogFilter) => void }) {
  const items: { id: LogFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "rej", label: "Rejections" },
    { id: "orders", label: "Orders" },
    { id: "risk", label: "Risk" },
  ];
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn("min-h-11 rounded-md px-2 text-xs", filter === item.id ? "bg-raised text-fg" : "text-dim")}
          aria-pressed={filter === item.id}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function LogList({ filter }: { filter: LogFilter }) {
  const logs = useDesk((s) => s.logs);
  const rows = logs.filter((row) => matchLog(row, filter)).slice().reverse();
  const latest = rows[0];
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {latest ? `${latest.agent}: ${latest.reason}` : "Log empty"}
      </p>
      <ul className="scroll min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted">No lines in this filter yet.</li>
        ) : (
          rows.map((row) => <LogRow key={row.id} row={row} />)
        )}
      </ul>
    </>
  );
}

function matchLog(row: DeskLog, filter: LogFilter): boolean {
  if (filter === "all") return true;
  if (filter === "rej") return row.kind === "kill" || row.kind === "reject" || row.kind === "skip";
  if (filter === "orders") return row.kind === "buy" || row.kind === "pass" || row.kind === "score";
  return row.kind === "arm" || row.kind === "stop" || row.kind === "trail";
}

function LogRow({ row }: { row: DeskLog }) {
  const name = AGENT_META.find((agent) => agent.id === row.agent)?.name ?? row.agent;
  const color =
    row.kind === "kill" || row.kind === "stop"
      ? "text-down"
      : row.kind === "buy" || row.kind === "pass" || row.kind === "trail"
        ? "text-up"
        : row.kind === "reject" || row.kind === "skip" || row.kind === "arm"
          ? "text-amber"
          : "text-fg";
  return (
    <li className="border-b border-line px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 font-mono text-xs text-dim">
        <span>{deskClock(row.t)}</span>
        <span>{name}</span>
      </div>
      <p className={cn("mt-0.5 text-sm leading-snug", color)}>{row.reason}</p>
    </li>
  );
}

function RecapGate() {
  const open = useDesk((s) => s.recapOpen);
  if (!open) return null;
  return <RecapScreen />;
}
