import { useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Crosshair, Filter, Moon, Pause, Play, Radar, Scale, ScrollText, Shield, Sunrise } from "lucide-react";
import { RecapScreen } from "@/components/desk/recap";
import { WalletButton } from "@/components/desk/wallet";
import { LiveButton } from "@/components/desk/live-panel";
import { runLiveCycle } from "@/lib/desk/autotrade";
import { useLive } from "@/lib/desk/live-store";
import { bootLive, reconnectPhantom } from "@/lib/desk/solana-wallet";
import { AGENT_META, equityOf } from "@/lib/desk/engine";
import { compactUsd, deskClock, money, pct, pxPrice } from "@/lib/desk/format";
import { fetchPublicTape } from "@/lib/desk/public-tape";
import { bootDesk, useDesk } from "@/lib/desk/store";
import type { AgentId, DeskLog, Fill, TapeRow } from "@/lib/desk/types";
import { cn } from "@/lib/utils";

const RULES = [
  "Mint revoked",
  "LP locked",
  "Top 10 ≤ 20%",
  "1h vol ≥ $50k",
  "Clean dev",
  "Score ≥ 0.60",
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
  const overnight = useDesk((s) => s.overnight);

  useEffect(() => {
    if (!ready || !running) return;
    const id = window.setInterval(() => useDesk.getState().tick(), overnight ? 110 : 1500);
    return () => window.clearInterval(id);
  }, [ready, running, overnight]);

  useEffect(() => {
    if (!ready) return;
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetchPublicTape();
        if (!stop) useDesk.getState().ingestPublic(res);
      } catch {
        if (!stop) useDesk.getState().ingestPublic({ ok: false, pairs: [], scanned: 0, dropped: 0 });
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
  const overnight = useDesk((s) => s.overnight);
  const mode = useDesk((s) => s.mode);
  const publicTape = useDesk((s) => s.publicTape);
  const toggleRun = useDesk((s) => s.toggleRun);
  const startNight = useDesk((s) => s.startNight);
  const openRecap = useDesk((s) => s.openRecap);
  const setPaper = useDesk((s) => s.setPaper);
  const reset = useDesk((s) => s.reset);
  const liveOn = useLive((s) => s.armed);
  const livePositions = useLive((s) => s.positions.length);
  const liveStatus = useLive((s) => s.status);
  const [confirmReset, setConfirmReset] = useState(false);

  const tapeLabel = publicTape === "live" ? "Public tape live" : publicTape === "offline" ? "Public tape offline" : "Public tape connecting";

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
          {overnight ? <span className="ml-2 text-xs text-amber">night</span> : null}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleRun} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
            {running ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {running ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={startNight}
            disabled={overnight}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60"
          >
            <Moon className="size-4" aria-hidden="true" />
            {overnight ? "Night running" : "Run the night"}
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
              <p className="mt-1 line-clamp-2 text-xs text-dim">{agent.id === "scout" ? tapeNote : agent.duty}</p>
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
        <Panel title="Tape" hint="Scout → handoff" className={cn("lg:col-span-3", tab === "tape" ? "flex" : "hidden lg:flex")}>
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
  if (tape.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted">Scout is quiet. The next print lands on the minute.</p>;
  }
  return (
    <ul className="scroll min-h-0 flex-1 overflow-y-auto">
      {tape.map((row) => (
        <li key={row.id} className="border-b border-line px-3 py-2">
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
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">{row.reason}</p>
        </li>
      ))}
    </ul>
  );
}

function Outcome({ row }: { row: TapeRow }) {
  const label = row.outcome === "kill" ? "Killed" : row.outcome === "reject" ? "Under 0.60" : row.outcome === "skip" ? "Skipped" : "Filled";
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
