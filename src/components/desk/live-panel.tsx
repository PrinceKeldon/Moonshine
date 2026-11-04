import { useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, Wallet, X } from "lucide-react";
import { requestFlatten, requestSell, runLiveCycle } from "@/lib/desk/autotrade";
import { SOL_MINT, ticketSol } from "@/lib/desk/live-score";
import { buildSwap } from "@/lib/desk/live-chain";
import { activeAddress, useLive } from "@/lib/desk/live-store";
import { AGENT_CONFIG, dynamicTrailGive, MAX_HOLD_SECONDS, TRAIL_ARM } from "@/lib/desk/live-risk";
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
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

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
  const [loss, setLoss] = useState(String(dailyLossSol));
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewMint, setPreviewMint] = useState(USDC_MINT);
  const [previewSol, setPreviewSol] = useState("0.01");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    wallet: string;
    outputMint: string;
    solIn: number;
    outAmount: string;
    impact: number | null;
    builtAt: number;
  } | null>(null);
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

  async function buildPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewError(null);
    setPreviewResult(null);
    if (armed || positions.length > 0 || busy) {
      setPreviewError("Disarm Live and close any chain positions before previewing; live position management can submit swaps.");
      return;
    }
    const amountSol = Number(previewSol);
    const outputMint = previewMint.trim();
    if (!phantom) {
      setPreviewError("Connect a wallet first. The preview uses its public address only.");
      return;
    }
    if (outputMint.length < 32 || outputMint.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(outputMint)) {
      setPreviewError("Enter a valid Solana token mint.");
      return;
    }
    if (outputMint === SOL_MINT) {
      setPreviewError("Choose a token mint different from wrapped SOL.");
      return;
    }
    if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > 0.1) {
      setPreviewError("Use an amount greater than 0 and no more than 0.1 SOL.");
      return;
    }

    setPreviewBusy(true);
    try {
      const built = await buildSwap({
        data: {
          user: phantom,
          inputMint: SOL_MINT,
          outputMint,
          amount: String(Math.floor(amountSol * 1_000_000_000)),
          slippageBps,
        },
      });
      if (!built.ok || !built.tx || !built.outAmount) {
        setPreviewError(built.error ?? "Jupiter did not build an unsigned transaction.");
        return;
      }
      setPreviewResult({
        wallet: phantom,
        outputMint,
        solIn: amountSol,
        outAmount: built.outAmount,
        impact: built.impact,
        builtAt: Date.now(),
      });
      // Deliberately retain only quote details. The unsigned transaction is discarded here.
      built.tx = null;
    } catch (caught) {
      setPreviewError(caught instanceof Error ? caught.message : "The preview could not be built.");
    } finally {
      setPreviewBusy(false);
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

            <div className="mt-3 rounded-md border border-line bg-bg px-3 py-3">
              <h3 className="text-sm font-medium">Build-only swap preview</h3>
              <p className="mt-1 text-xs text-dim">
                Uses the connected wallet address to build an unsigned Jupiter transaction, then discards it. No signature or transaction submission occurs here.
              </p>
              <form className="mt-3 flex flex-col gap-2" onSubmit={(event) => void buildPreview(event)}>
                <label className="text-xs text-muted">
                  Output token mint
                  <input
                    value={previewMint}
                    onChange={(event) => setPreviewMint(event.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className={cn(field, "mt-1")}
                  />
                </label>
                <label className="text-xs text-muted">
                  Input amount (SOL, max 0.1)
                  <input
                    value={previewSol}
                    onChange={(event) => setPreviewSol(event.target.value)}
                    inputMode="decimal"
                    className={cn(field, "mt-1")}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!phantom || previewBusy || armed || positions.length > 0 || busy}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-3 text-sm disabled:opacity-60"
                >
                  {previewBusy ? "Building preview…" : "Build unsigned preview"}
                </button>
              </form>
              {!phantom ? <p className="mt-2 text-xs text-muted">Connect a wallet above to enable the wallet-specific preview.</p> : null}
              {armed || positions.length > 0 ? <p className="mt-2 text-xs text-amber">Disarm Live and close chain positions before previewing.</p> : null}
              {previewError ? <p className="mt-2 text-sm text-down">{previewError}</p> : null}
              {previewResult ? (
                <div className="mt-3 rounded-md border border-up/40 px-3 py-2 text-xs">
                  <p className="font-medium text-up">Unsigned transaction built and discarded · {clock(previewResult.builtAt)}</p>
                  <p className="mt-1 font-mono text-dim">Wallet {short(previewResult.wallet)}</p>
                  <p className="mt-1 font-mono text-dim">{previewResult.solIn} SOL → {previewResult.outAmount} raw token units</p>
                  <p className="mt-1 text-dim">Price impact {previewResult.impact === null ? "unknown" : `${(previewResult.impact * 100).toFixed(3)}%`}</p>
                  <p className="mt-1 break-all font-mono text-dim">Mint {previewResult.outputMint}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-medium">Limits</h3>
            <p className="mt-1 text-xs text-dim">
              No position-count cap. Each ticket is the smaller of your requested size and 8% of signer balance, with 0.02 SOL reserved for fees.
            </p>
            <p className="mt-1 text-xs text-dim">
              Hard stop −6%; trail arms at +{(TRAIL_ARM * 100).toFixed(0)}% and tightens at +25%, +50%, +100%, and +200% peaks.
              Full time stop at {Math.round(MAX_HOLD_SECONDS / 60)} min.
            </p>
            <p className="mt-1 text-xs text-dim">
              Agent exits below ${AGENT_CONFIG.minLiqUsd.toLocaleString()} liquidity or below {(AGENT_CONFIG.minLiqFracOfSeen * 100).toFixed(0)}% of best-seen liquidity, or after a {(AGENT_CONFIG.maxGivebackFrac * 100).toFixed(0)}% peak give-back.
              It scales {(AGENT_CONFIG.forceScalePct * 100).toFixed(0)}% once at +{(AGENT_CONFIG.forceScalePeak * 100).toFixed(0)}% peak, then {(AGENT_CONFIG.timeScalePct * 100).toFixed(0)}% per live check after
              {" "}{(MAX_HOLD_SECONDS * AGENT_CONFIG.timePressureFrac / 60).toFixed(1)} min below +{(AGENT_CONFIG.softTp * 100).toFixed(0)}%, until the full time stop.
            </p>
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
                        <p className="text-xs text-muted">
                          {pos.trailArmed && pos.trailStopPct !== null
                            ? `Trail ${pct(pos.trailStopPct)} · give-back ${pct(dynamicTrailGive(pos.peakPnlPct))}`
                            : `Hard stop −6% · trail arms +${(TRAIL_ARM * 100).toFixed(0)}%`}
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
