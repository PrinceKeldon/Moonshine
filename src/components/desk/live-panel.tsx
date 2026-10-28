import { useEffect, useState } from "react";
import { Copy, KeyRound, Wallet, X } from "lucide-react";
import { requestFlatten, requestSell, runLiveCycle } from "@/lib/desk/autotrade";
import { ticketSol } from "@/lib/desk/live-score";
import { activeAddress, useLive } from "@/lib/desk/live-store";
import {
  connectPhantom,
  createDeskKey,
  forgetDeskKey,
  fundDesk,
  getProvider,
  importDeskKey,
  readSecret,
} from "@/lib/desk/solana-wallet";
import { useDesk } from "@/lib/desk/store";
import { pct } from "@/lib/desk/format";
import { cn } from "@/lib/utils";

const field =
  "w-full min-h-11 rounded-md border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim";

function short(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function clock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveButton() {
  const [open, setOpen] = useState(false);
  const armed = useLive((s) => s.armed);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center rounded-md px-3 text-sm",
          armed ? "bg-amber font-medium text-ink" : "border border-line text-muted",
        )}
      >
        {armed ? "Live on" : "Live"}
      </button>
      {open ? <LiveSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LiveSheet({ onClose }: { onClose: () => void }) {
  const armed = useLive((s) => s.armed);
  const signer = useLive((s) => s.signer);
  const phantom = useLive((s) => s.phantom);
  const deskPubkey = useLive((s) => s.deskPubkey);
  const solPerTrade = useLive((s) => s.solPerTrade);
  const slippageBps = useLive((s) => s.slippageBps);
  const maxPositions = useLive((s) => s.maxPositions);
  const dailyLossSol = useLive((s) => s.dailyLossSol);
  const sol = useLive((s) => s.sol);
  const dayPnlSol = useLive((s) => s.dayPnlSol);
  const halted = useLive((s) => s.halted);
  const status = useLive((s) => s.status);
  const busy = useLive((s) => s.busy);
  const positions = useLive((s) => s.positions);
  const orders = useLive((s) => s.orders);
  const patch = useLive((s) => s.patch);
  const armShadow = useDesk((s) => s.armShadow);

  const [phrase, setPhrase] = useState("");
  const [secretDraft, setSecretDraft] = useState("");
  const [fund, setFund] = useState("0.1");
  const [ticket, setTicket] = useState(String(solPerTrade));
  const [slip, setSlip] = useState(String(slippageBps));
  const [names, setNames] = useState(String(maxPositions));
  const [loss, setLoss] = useState(String(dailyLossSol));
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasExtension = typeof window !== "undefined" && getProvider() !== null;
  const address = activeAddress({ signer, phantom, deskPubkey });
  const nextTicket = sol === null ? null : ticketSol(sol, solPerTrade);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(task: () => Promise<void>) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not complete.");
    } finally {
      setPending(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch {
      setError("Copy failed. Select the address instead.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="live-title">
      <div className="flex max-h-svh w-full max-w-lg flex-col overflow-hidden border border-line bg-surface sm:max-h-[85svh] sm:rounded-md">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-amber">LIVE</p>
            <h2 id="live-title" className="text-lg font-medium">
              Autotrade on Solana
            </h2>
            <p className="text-xs text-muted">Paper keeps its own book. Live signs Jupiter swaps only after you arm it.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md border border-line" aria-label="Close live">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-sm font-medium">Signer</h3>
            <p className="mt-1 text-xs text-dim">
              Desk key stays in this browser and signs without a popup. A connected wallet signs each swap unless that wallet auto-approves KEEL. Never fund more than you can lose.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => patch({ signer: "desk" })}
                className={cn("min-h-11 rounded-md border px-3 text-sm", signer === "desk" ? "border-amber text-amber" : "border-line text-muted")}
              >
                Desk key
              </button>
              <button
                type="button"
                onClick={() => patch({ signer: "phantom" })}
                className={cn("min-h-11 rounded-md border px-3 text-sm", signer === "phantom" ? "border-amber text-amber" : "border-line text-muted")}
              >
                Connected wallet
              </button>
            </div>

            <div className="mt-3 rounded-md border border-line bg-bg px-3 py-3">
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="size-4 text-amber" aria-hidden="true" />
                <span>Desk key</span>
              </div>
              {deskPubkey ? (
                <p className="mt-2 break-all font-mono text-xs">{deskPubkey}</p>
              ) : (
                <p className="mt-2 text-xs text-muted">No desk key yet.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {deskPubkey ? (
                  <button type="button" onClick={() => void copy(deskPubkey)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
                    <Copy className="size-4" aria-hidden="true" />
                    Copy
                  </button>
                ) : (
                  <button type="button" disabled={pending} onClick={() => void run(async () => void (await createDeskKey()))} className="inline-flex min-h-11 items-center rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60">
                    Create desk key
                  </button>
                )}
                {deskPubkey ? (
                  <button
                    type="button"
                    onClick={() => setRevealed(revealed ? null : readSecret())}
                    className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm"
                  >
                    {revealed ? "Hide secret" : "Reveal secret"}
                  </button>
                ) : null}
                {deskPubkey ? (
                  <button
                    type="button"
                    onClick={() => {
                      forgetDeskKey();
                      setRevealed(null);
                    }}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-down"
                  >
                    Forget key
                  </button>
                ) : null}
              </div>
              {revealed ? <p className="mt-2 break-all font-mono text-xs text-amber">{revealed}</p> : null}
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await importDeskKey(secretDraft);
                    setSecretDraft("");
                    setNotice("Desk key imported. It stays in this browser.");
                  });
                }}
              >
                <label className="text-xs text-muted">
                  Import a trading secret (base58). It is not sent to a server.
                  <textarea
                    value={secretDraft}
                    onChange={(event) => setSecretDraft(event.target.value)}
                    spellCheck={false}
                    rows={2}
                    className={cn(field, "mt-1")}
                    placeholder="Base58 secret"
                  />
                </label>
                <button type="submit" disabled={pending || secretDraft.trim().length < 32} className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-3 text-sm disabled:opacity-60">
                  Import
                </button>
              </form>
            </div>

            <div className="mt-3 rounded-md border border-line bg-bg px-3 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="size-4" aria-hidden="true" />
                <span>Connected wallet</span>
              </div>
              <p className="mt-2 font-mono text-xs">{phantom ? phantom : hasExtension ? "Not connected." : "No wallet extension in this window."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => void run(async () => void (await connectPhantom()))} className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm disabled:opacity-60">
                  {phantom ? "Reconnect" : "Connect"}
                </button>
              </div>
              {deskPubkey ? (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const sent = await fundDesk(Number(fund));
                      if (!sent.ok) throw new Error(sent.error ?? "Funding failed.");
                      setNotice(sent.signature ? `Funded. ${sent.signature.slice(0, 8)}…` : "Funded.");
                      void runLiveCycle();
                    });
                  }}
                >
                  <label className="min-w-0 flex-1 text-xs text-muted">
                    Send SOL from the connected wallet
                    <input value={fund} onChange={(event) => setFund(event.target.value)} inputMode="decimal" className={cn(field, "mt-1")} />
                  </label>
                  <button type="submit" disabled={pending || !phantom} className="inline-flex min-h-11 items-center justify-center rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60 sm:self-end">
                    Fund desk
                  </button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-medium">Limits</h3>
            <p className="mt-1 text-xs text-dim">Size is the smaller of your ticket and 8% of the signer balance, leaving 0.02 SOL for fees. Hard stop −6%. Trail after +12%.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                SOL per trade
                <input value={ticket} onChange={(event) => setTicket(event.target.value)} onBlur={() => {
                  const next = clampNum(ticket, 0.01, 2, solPerTrade);
                  patch({ solPerTrade: next });
                  setTicket(String(next));
                }} inputMode="decimal" className={cn(field, "mt-1")} />
              </label>
              <label className="text-xs text-muted">
                Slippage bps
                <input value={slip} onChange={(event) => setSlip(event.target.value)} onBlur={() => {
                  const next = Math.round(clampNum(slip, 30, 500, slippageBps));
                  patch({ slippageBps: next });
                  setSlip(String(next));
                }} inputMode="numeric" className={cn(field, "mt-1")} />
              </label>
              <label className="text-xs text-muted">
                Max names
                <input value={names} onChange={(event) => setNames(event.target.value)} onBlur={() => {
                  const next = Math.round(clampNum(names, 1, 4, maxPositions));
                  patch({ maxPositions: next });
                  setNames(String(next));
                }} inputMode="numeric" className={cn(field, "mt-1")} />
              </label>
              <label className="text-xs text-muted">
                Day-loss halt, SOL
                <input value={loss} onChange={(event) => setLoss(event.target.value)} onBlur={() => {
                  const next = clampNum(loss, 0.05, 5, dailyLossSol);
                  patch({ dailyLossSol: next });
                  setLoss(String(next));
                }} inputMode="decimal" className={cn(field, "mt-1")} />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line px-3 py-2">
                <div className="text-xs text-muted">Signer balance</div>
                <div className="num font-mono text-lg">{sol === null ? "—" : `${sol.toFixed(3)} SOL`}</div>
                <div className="truncate font-mono text-xs text-dim">{address ? short(address) : "No signer"}</div>
              </div>
              <div className="rounded-md border border-line px-3 py-2">
                <div className="text-xs text-muted">Next ticket</div>
                <div className="num font-mono text-lg">{nextTicket === null ? "—" : `${nextTicket.toFixed(3)} SOL`}</div>
                <div className={cn("num font-mono text-xs", dayPnlSol >= 0 ? "text-up" : "text-down")}>
                  Day {dayPnlSol >= 0 ? "+" : ""}
                  {dayPnlSol.toFixed(3)} SOL
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-medium">{armed ? "Armed" : "Arm"}</h3>
            <p className="mt-2 text-sm text-fg">{status}</p>
            {halted ? <p className="mt-2 text-sm text-down">{halted}</p> : null}
            {error ? <p className="mt-2 text-sm text-down">{error}</p> : null}
            {notice ? <p className="mt-2 text-sm text-up">{notice}</p> : null}
            {armed ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => patch({ armed: false, status: "Disarmed. Open names stay watched for stops." })} className="inline-flex min-h-11 items-center rounded-md border border-amber px-4 text-sm text-amber">
                  Disarm
                </button>
                {halted ? (
                  <button type="button" onClick={() => patch({ halted: null })} className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm">
                    Clear halt
                  </button>
                ) : null}
                <button type="button" disabled={busy || positions.length === 0} onClick={() => requestFlatten()} className="inline-flex min-h-11 items-center rounded-md border border-down px-3 text-sm text-down disabled:opacity-60">
                  Flatten
                </button>
              </div>
            ) : (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (phrase.trim().toUpperCase() !== "TRADE") {
                    setError('Type TRADE to arm.');
                    return;
                  }
                  if (!address) {
                    setError("Choose a signer that has an address.");
                    return;
                  }
                  setError(null);
                  patch({ armed: true, halted: null, status: "Armed. Scanning the public tape." });
                  void runLiveCycle();
                }}
              >
                <label className="text-xs text-muted">
                  Type TRADE to arm live swaps
                  <input value={phrase} onChange={(event) => setPhrase(event.target.value)} className={cn(field, "mt-1")} autoCapitalize="characters" />
                </label>
                <button type="submit" disabled={!address} className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber px-4 text-sm font-medium text-ink disabled:opacity-60">
                  Arm live
                </button>
              </form>
            )}
            <button type="button" onClick={() => { armShadow(); onClose(); }} className="mt-3 inline-flex min-h-11 items-center text-sm text-dim">
              Rehearse on the shadow book instead
            </button>
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-medium">Chain book</h3>
            <ul className="mt-2">
              {positions.length === 0 ? (
                <li className="border-t border-line py-3 text-sm text-muted">Flat on-chain.</li>
              ) : (
                positions.map((pos) => {
                  const pnl = pos.entryPriceUsd > 0 ? pos.priceUsd / pos.entryPriceUsd - 1 : 0;
                  return (
                    <li key={pos.mint} className="flex items-center justify-between gap-3 border-t border-line py-3">
                      <div className="min-w-0">
                        <div className="font-mono text-sm">
                          {pos.symbol}
                          <span className="ml-2 text-xs text-dim">{pos.venue}</span>
                        </div>
                        <p className={cn("num font-mono text-xs", pnl >= 0 ? "text-up" : "text-down")}>
                          {pct(pnl)} · {pos.solIn.toFixed(3)} SOL in
                        </p>
                      </div>
                      <button type="button" onClick={() => requestSell(pos.mint)} className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm">
                        Sell
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {orders.length > 0 ? (
            <section className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-medium">Chain log</h3>
              <ul>
                {orders.slice(0, 8).map((row) => (
                  <li key={row.id} className="border-t border-line py-2">
                    <div className="flex items-baseline justify-between gap-2 text-xs text-dim">
                      <span>
                        {clock(row.t)} · {row.side} {row.symbol}
                      </span>
                      <span className={row.status === "filled" ? "text-up" : row.status === "failed" ? "text-down" : "text-amber"}>{row.status}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-fg">{row.reason}</p>
                    {row.signature ? (
                      <a className="font-mono text-xs text-amber" href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer">
                        {short(row.signature)}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function clampNum(value: string, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
