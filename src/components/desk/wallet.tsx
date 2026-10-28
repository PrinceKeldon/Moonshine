import { useEffect, useState } from "react";
import { RefreshCw, Wallet, X } from "lucide-react";
import { money, pct, pxPrice } from "@/lib/desk/format";
import { equityOf } from "@/lib/desk/engine";
import { isSolanaAddress, fetchWallet } from "@/lib/desk/wallet";
import { useDesk } from "@/lib/desk/store";
import type { Fill, WatchSnapshot } from "@/lib/desk/types";
import { cn } from "@/lib/utils";

function short(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function qty(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  if (abs >= 1) return n.toFixed(2);
  if (abs === 0) return "0";
  return n.toPrecision(2);
}

function ago(t: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function markValue(fill: Fill): number {
  return fill.qty * fill.price;
}

function pnlOf(fill: Fill): number {
  return markValue(fill) * (1 - 0.003) - fill.sizeUsd;
}

export function WalletButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
        <Wallet className="size-4" aria-hidden="true" />
        Wallet
      </button>
      {open ? <WalletSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function WalletSheet({ onClose }: { onClose: () => void }) {
  const cash = useDesk((s) => s.cash);
  const opens = useDesk((s) => s.opens);
  const closed = useDesk((s) => s.closed);
  const startCash = useDesk((s) => s.startCash);
  const watchAddress = useDesk((s) => s.watchAddress) ?? "";
  const watch = useDesk((s) => s.watch) ?? null;
  const saveWatch = useDesk((s) => s.saveWatch);
  const clearWatch = useDesk((s) => s.clearWatch);

  const [draft, setDraft] = useState(watchAddress);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equity = equityOf({ cash, opens });
  const delta = startCash ? (equity - startCash) / startCash : 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function load(address: string) {
    const next = address.trim();
    if (!isSolanaAddress(next)) {
      setError("That is not a Solana address.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await fetchWallet({ data: { address: next } });
      if (!result.ok || !result.snapshot) {
        setError(result.error ?? "The chain did not answer.");
        return;
      }
      saveWatch(next, result.snapshot);
      setDraft(next);
    } catch {
      setError("The chain did not answer.");
    } finally {
      setPending(false);
    }
  }

  const moves = [...opens.map((fill) => ({ id: fill.id, t: fill.openedAt, symbol: fill.symbol, side: "Buy" as const, usd: fill.sizeUsd })), ...closed.map((fill) => ({ id: `${fill.id}-out`, t: fill.closedAt ?? fill.openedAt, symbol: fill.symbol, side: "Sell" as const, usd: fill.pnlUsd ?? 0 }))].sort((a, b) => b.t - a.t).slice(0, 8);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
      <div className="flex max-h-svh w-full max-w-lg flex-col overflow-hidden border border-line bg-surface sm:max-h-[85svh] sm:rounded-md">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-amber">WALLET</p>
            <h2 id="wallet-title" className="text-lg font-medium">
              Paper book, public watch
            </h2>
            <p className="text-xs text-muted">This book is simulated. Chain autotrade is under Live.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md border border-line" aria-label="Close wallet">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-sm font-medium">Paper book</h3>
            <p className="mt-1 text-xs text-dim">Cash and names the agents already hold. Not an on-chain wallet. Do not send funds here.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-bg px-3 py-2">
                <div className="text-xs text-muted">Balance</div>
                <div className="num font-mono text-lg">{money(equity)}</div>
                <div className={cn("num font-mono text-xs", delta >= 0 ? "text-up" : "text-down")}>{pct(delta)} session</div>
              </div>
              <div className="rounded-md border border-line bg-bg px-3 py-2">
                <div className="text-xs text-muted">Cash</div>
                <div className="num font-mono text-lg">{money(cash)}</div>
                <div className="text-xs text-muted">Undeployed</div>
              </div>
            </div>
            <ul className="mt-3">
              {opens.length === 0 ? (
                <li className="border-t border-line py-3 text-sm text-muted">Flat. Cash is the whole book.</li>
              ) : (
                opens.map((fill) => {
                  const pnl = pnlOf(fill);
                  return (
                    <li key={fill.id} className="flex items-baseline justify-between gap-3 border-t border-line py-3">
                      <div className="min-w-0">
                        <div className="font-mono text-sm">
                          {fill.symbol}
                          <span className="ml-2 text-xs text-dim">{fill.venue}</span>
                        </div>
                        <p className="text-xs text-muted">
                          {qty(fill.qty)} · {pxPrice(fill.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="num font-mono text-sm">{money(markValue(fill))}</div>
                        <div className={cn("num font-mono text-xs", pnl >= 0 ? "text-up" : "text-down")}>{money(pnl)}</div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            {moves.length > 0 ? (
              <div className="mt-2">
                <h3 className="text-sm font-medium">Recent paper fills</h3>
                <ul>
                  {moves.map((move) => (
                    <li key={move.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-sm">
                      <span>
                        <span className={move.side === "Buy" ? "text-up" : "text-down"}>{move.side}</span>
                        <span className="ml-2 font-mono">{move.symbol}</span>
                      </span>
                      <span className="num font-mono text-muted">{money(move.usd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-medium">Watch a public address</h3>
            <p className="mt-1 text-xs text-dim">Paste a Solana address. Balances are read from the chain. No connect, no signature.</p>
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void load(draft);
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">Solana address</span>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Public address"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="w-full min-h-11 rounded-md border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim"
                />
              </label>
              <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-md bg-up px-4 text-sm font-medium text-ink disabled:opacity-60">
                {pending ? "Reading" : "Watch"}
              </button>
            </form>
            {error ? <p className="mt-2 text-sm text-down">{error}</p> : null}
            {watch ? <WatchView snapshot={watch} pending={pending} onRefresh={() => void load(watch.address)} onClear={clearWatch} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function WatchView({
  snapshot,
  pending,
  onRefresh,
  onClear,
}: {
  snapshot: WatchSnapshot;
  pending: boolean;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const priced = snapshot.tokens.filter((row) => row.usd !== null && row.usd >= 0.01);
  const rows = priced.length > 0 ? priced.slice(0, 8) : snapshot.tokens.slice(0, 8);
  const hidden = snapshot.tokens.length - rows.length;
  const total = (snapshot.solUsd ?? 0) + rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
  const hasMark = snapshot.solUsd !== null || rows.some((row) => row.usd !== null);
  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm" title={snapshot.address}>
            {short(snapshot.address)}
          </p>
          <p className="text-xs text-dim">Read {ago(snapshot.fetchedAt)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} disabled={pending} className="inline-flex size-11 items-center justify-center rounded-md border border-line disabled:opacity-60" aria-label="Refresh balances">
            <RefreshCw className={cn("size-4", pending && "keel-pulse")} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-dim">
            Clear
          </button>
        </div>
      </div>
      {hasMark ? <p className="num mt-2 font-mono text-lg">{money(total)} marked</p> : null}
      <ul className="mt-2">
        <li className="flex items-baseline justify-between gap-3 border-t border-line py-2">
          <div>
            <div className="font-mono text-sm">SOL</div>
            <p className="text-xs text-muted">{qty(snapshot.sol)}</p>
          </div>
          <div className="num font-mono text-sm">{snapshot.solUsd === null ? "—" : money(snapshot.solUsd)}</div>
        </li>
        {rows.length === 0 ? (
          <li className="border-t border-line py-3 text-sm text-muted">No token balances on this address.</li>
        ) : (
          rows.map((row) => (
            <li key={row.mint} className="flex items-baseline justify-between gap-3 border-t border-line py-2">
              <div className="min-w-0">
                <div className="font-mono text-sm">{row.symbol}</div>
                <p className="truncate text-xs text-muted">{qty(row.amount)}</p>
              </div>
              <div className="num font-mono text-sm">{row.usd === null ? "—" : money(row.usd)}</div>
            </li>
          ))
        )}
        {hidden > 0 ? <li className="border-t border-line py-2 text-xs text-dim">{hidden} unmarked tokens left off the list.</li> : null}
      </ul>
    </div>
  );
}
