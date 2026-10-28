import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { deskClock, money, pct } from "@/lib/desk/format";
import type { KillCode, Recap, TradeView } from "@/lib/desk/types";
import { useDesk } from "@/lib/desk/store";
import { cn } from "@/lib/utils";

const KILL_LABEL: Record<KillCode, string> = {
  unverified: "Public print, gates unproven",
  mint: "Mint authority still live",
  lp: "LP not locked",
  holders: "Top 10 over 20%",
  volume: "1h volume under $50k",
  dev: "Dev tied to a prior rug",
  venue: "Outside Pump.fun / Raydium",
};

const AUDIT = [
  "Mint revoked before every fill",
  "LP locked before every fill",
  "Top 10 at or under 20%",
  "1h volume at least $50k",
  "Dev wallet clean of prior rugs",
  "Score at least 0.60",
  "No fill above 8% of balance",
  "Nothing left open through −6%",
  "No trail before +12%",
  "No averaged-down position",
  "No revenge re-entry",
  "Nothing signed or broadcast",
];

function pnlClass(n: number | null): string {
  if (n === null) return "text-muted";
  if (n > 0.5) return "text-up";
  if (n < -0.5) return "text-down";
  return "text-fg";
}

function TradeLine({ trade }: { trade: TradeView }) {
  return (
    <li className="border-b border-line py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-sm">
          {trade.symbol}
          <span className="ml-2 text-xs text-dim">{trade.venue}</span>
        </div>
        <div className={cn("num font-mono text-sm", pnlClass(trade.pnlUsd))}>
          {trade.status === "open" ? "Open " : ""}
          {trade.pnlUsd === null ? "—" : money(trade.pnlUsd)}
          {trade.pnlPct !== null ? <span className="ml-2 text-xs">{pct(trade.pnlPct)}</span> : null}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        Score {trade.score.toFixed(2)} · size {money(trade.sizeUsd)} ({(trade.sizePct * 100).toFixed(2)}% of balance)
      </p>
      <p className="mt-1 text-sm text-fg">{trade.entryReason}</p>
      {trade.exitReason ? <p className="mt-1 text-sm text-muted">{trade.exitReason}</p> : null}
    </li>
  );
}

export function RecapScreen() {
  const recap = useDesk((s) => s.recap);
  const closeRecap = useDesk((s) => s.closeRecap);
  const startNight = useDesk((s) => s.startNight);
  const [copied, setCopied] = useState(false);
  if (!recap) return null;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg text-fg" role="dialog" aria-modal="true" aria-labelledby="recap-title">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-amber">{recap.partial ? "INTERIM READ" : "MORNING RECAP"}</p>
            <h2 id="recap-title" className="mt-1 text-2xl font-medium">
              {recap.partial ? "The night is still open" : "The night is closed"}
            </h2>
            <p className="mt-1 font-mono text-sm text-muted">
              Desk {deskClock(recap.from)} – {deskClock(recap.to)}
              {recap.mode === "shadow" ? " · shadow" : " · paper"}
            </p>
          </div>
          <button type="button" onClick={closeRecap} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm text-fg">
            <X className="size-4" aria-hidden="true" />
            Back to the book
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <figure className="rounded-md border border-line bg-surface p-4 sm:col-span-1">
            <figcaption className="text-xs text-muted">Balance</figcaption>
            <p className="num mt-1 font-mono text-3xl">{money(recap.endEquity)}</p>
            <p className={cn("num mt-1 font-mono text-sm", recap.endEquity - recap.startEquity >= 0 ? "text-up" : "text-down")}>
              {pct(recap.startEquity ? (recap.endEquity - recap.startEquity) / recap.startEquity : 0)} from {money(recap.startEquity)}
            </p>
          </figure>
          <figure className="rounded-md border border-line bg-surface p-4">
            <figcaption className="text-xs text-muted">Max drawdown</figcaption>
            <p className="num mt-1 font-mono text-3xl text-down">{(recap.maxDrawdown * 100).toFixed(1)}%</p>
            <p className="mt-1 text-sm text-muted">Peak to trough inside this window</p>
          </figure>
          <figure className="rounded-md border border-line bg-surface p-4">
            <figcaption className="text-xs text-muted">Realized / still open</figcaption>
            <p className={cn("num mt-1 font-mono text-3xl", pnlClass(recap.realized))}>{money(recap.realized)}</p>
            <p className="num mt-1 font-mono text-sm text-muted">Open marks {money(recap.unrealized)}</p>
          </figure>
        </div>

        <p className="max-w-3xl text-sm text-fg">{recap.narrative}</p>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-md border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Rule audit</h3>
            {recap.breaches.length === 0 ? (
              <ul className="mt-3 grid gap-2">
                {AUDIT.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-up" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-3 grid gap-2">
                {recap.breaches.map((item) => (
                  <li key={item} className="text-sm text-down">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <RejectionBars recap={recap} />
        </div>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-sm font-medium">Fills and why</h3>
            <p className="font-mono text-xs text-dim">
              {recap.wins} won · {recap.losses} lost · {recap.stops} hard stops · {recap.trails} trails
            </p>
          </div>
          {recap.trades.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No fills. The book stayed flat. That is a valid result.</p>
          ) : (
            <ul>
              {recap.trades.map((trade) => (
                <TradeLine key={`${trade.symbol}-${trade.openedAt}`} trade={trade} />
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-up px-4 text-sm font-medium text-ink"
            onClick={() => {
              startNight();
            }}
          >
            {recap.partial ? "Run the rest of the night" : "Run the next night"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(recap.lines.join("\n") || "No decisions in this window.");
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy className="size-4" aria-hidden="true" />
            {copied ? "Tape copied" : "Copy the decision tape"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionBars({ recap }: { recap: Recap }) {
  const rows = (Object.keys(KILL_LABEL) as KillCode[])
    .map((code) => ({ code, label: KILL_LABEL[code], n: recap.killBy[code] }))
    .filter((row) => row.n > 0);
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h3 className="text-sm font-medium">Why names died</h3>
      <p className="mt-1 text-sm text-muted">
        {recap.killed} killed at the gate · {recap.scoreRejected} scored under 0.60 · {recap.revengeBlocks} revenge locks · {recap.addBlocks} adds refused
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No gate kills in this window.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => (
            <li key={row.code}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="num font-mono text-xs text-muted">{row.n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-raised">
                <div className="h-1.5 rounded-full bg-down" style={{ width: `${(row.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
