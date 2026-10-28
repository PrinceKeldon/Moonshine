import { fetchWallet } from "@/lib/desk/wallet";
import { fetchPublicTape } from "@/lib/desk/public-tape";
import { buildSwap, markPrices, screenMint, tokenHolding } from "@/lib/desk/live-chain";
import { SOL_MINT, liveScore, tapeBlock, ticketSol, MIN_LIVE_SCORE, MIN_TICKET_SOL, MAX_PCT } from "@/lib/desk/live-score";
import { activeAddress, dayStamp, useLive, type LiveOrder, type LivePosition } from "@/lib/desk/live-store";
import { signAndSend } from "@/lib/desk/solana-wallet";
import type { PublicPairDTO } from "@/lib/desk/types";

const HARD_STOP = -0.06;
const TRAIL_ARM = 0.12;
const TRAIL_GIVE = 0.06;
const LOCK_MS = 12 * 60 * 60 * 1000;

let inflight: Promise<void> | null = null;

function order(partial: Omit<LiveOrder, "id" | "t">): LiveOrder {
  return { id: `L${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, t: Date.now(), ...partial };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHold(owner: string, mint: string, fallbackRaw: string | null) {
  for (let i = 0; i < 3; i += 1) {
    const hold = await tokenHolding({ data: { owner, mint } });
    if (hold.ok && hold.raw !== "0") return hold;
    await sleep(1200);
  }
  if (fallbackRaw && fallbackRaw !== "0") return { ok: true, raw: fallbackRaw, ui: 0, error: null };
  return { ok: false, raw: "0", ui: 0, error: "Token balance did not show." };
}

async function sell(pos: LivePosition, reason: string) {
  const state = useLive.getState();
  const owner = activeAddress(state);
  if (!owner) {
    state.pushOrder(order({ side: "sell", symbol: pos.symbol, mint: pos.mint, signature: null, status: "failed", reason: "No signer for the sell." }));
    return;
  }
  const hold = await tokenHolding({ data: { owner, mint: pos.mint } });
  const raw = hold.ok && hold.raw !== "0" ? hold.raw : pos.tokenRaw;
  if (!raw || raw === "0") {
    useLive.setState((current) => ({ positions: current.positions.filter((row) => row.mint !== pos.mint) }));
    useLive.getState().pushOrder(order({ side: "sell", symbol: pos.symbol, mint: pos.mint, signature: null, status: "skipped", reason: "No token balance left." }));
    return;
  }
  const built = await buildSwap({
    data: { user: owner, inputMint: pos.mint, outputMint: SOL_MINT, amount: raw, slippageBps: useLive.getState().slippageBps },
  });
  if (!built.ok || !built.tx) {
    useLive.getState().pushOrder(
      order({ side: "sell", symbol: pos.symbol, mint: pos.mint, signature: null, status: "failed", reason: built.error ?? "No sell route." }),
    );
    return;
  }
  const sent = await signAndSend(built.tx);
  if (!sent.ok || !sent.signature) {
    useLive.getState().pushOrder(
      order({ side: "sell", symbol: pos.symbol, mint: pos.mint, signature: sent.signature, status: "failed", reason: sent.error ?? "Sell did not land." }),
    );
    return;
  }
  const solOut = built.outAmount ? Number(built.outAmount) / 1e9 : 0;
  const pnlSol = Number.isFinite(solOut) ? solOut - pos.solIn : 0;
  useLive.setState((current) => {
    const dayKey = dayStamp();
    const sameDay = current.dayKey === dayKey;
    const dayPnlSol = (sameDay ? current.dayPnlSol : 0) + pnlSol;
    const halted =
      dayPnlSol <= -current.dailyLossSol
        ? `Halted. Day loss ${dayPnlSol.toFixed(3)} SOL hit the ${current.dailyLossSol} SOL stop. Exits still run.`
        : current.halted;
    const locks = pnlSol < 0 ? { ...current.locks, [pos.mint]: Date.now() + LOCK_MS } : current.locks;
    return {
      positions: current.positions.filter((row) => row.mint !== pos.mint),
      dayKey,
      dayPnlSol,
      halted,
      locks,
    };
  });
  useLive.getState().pushOrder(
    order({
      side: "sell",
      symbol: pos.symbol,
      mint: pos.mint,
      signature: sent.signature,
      status: "filled",
      reason,
    }),
  );
}

async function buy(pair: PublicPairDTO, sol: number, note: string) {
  const state = useLive.getState();
  const owner = activeAddress(state);
  const lamports = Math.floor(sol * 1e9);
  const built = await buildSwap({
    data: {
      user: owner,
      inputMint: SOL_MINT,
      outputMint: pair.mint,
      amount: String(lamports),
      slippageBps: state.slippageBps,
    },
  });
  if (!built.ok || !built.tx) {
    state.remember(pair.mint);
    state.pushOrder(order({ side: "buy", symbol: pair.symbol, mint: pair.mint, signature: null, status: "failed", reason: built.error ?? "No buy route." }));
    return;
  }
  const sent = await signAndSend(built.tx);
  if (!sent.ok || !sent.signature) {
    state.remember(pair.mint);
    useLive.getState().pushOrder(
      order({ side: "buy", symbol: pair.symbol, mint: pair.mint, signature: sent.signature, status: "failed", reason: sent.error ?? "Buy did not land." }),
    );
    return;
  }
  const hold = await waitHold(owner, pair.mint, built.outAmount);
  const position: LivePosition = {
    mint: pair.mint,
    symbol: pair.symbol,
    venue: pair.venue,
    solIn: sol,
    tokenRaw: hold.raw,
    tokenUi: hold.ui,
    entryPriceUsd: pair.priceUsd,
    priceUsd: pair.priceUsd,
    openedAt: Date.now(),
    signature: sent.signature,
    peakPnlPct: 0,
    trailArmed: false,
    trailStopPct: null,
  };
  useLive.setState((current) => ({
    positions: [...current.positions.filter((row) => row.mint !== pair.mint), position],
  }));
  useLive.getState().remember(pair.mint);
  useLive.getState().pushOrder(order({ side: "buy", symbol: pair.symbol, mint: pair.mint, signature: sent.signature, status: "filled", reason: note }));
}

async function cycle() {
  const start = useLive.getState();
  if (start.busy) return;
  const owner = activeAddress(start);
  const watching = start.armed || start.positions.length > 0 || start.flatten;
  if (!watching) return;
  useLive.getState().patch({ busy: true });
  try {
    if (owner) {
      try {
        const bag = await fetchWallet({ data: { address: owner } });
        if (bag.ok && bag.snapshot) {
          useLive.getState().patch({ sol: bag.snapshot.sol, solUsd: bag.snapshot.solUsd });
        }
      } catch {
        /* balance is advisory */
      }
    }

    const dayKey = dayStamp();
    if (useLive.getState().dayKey !== dayKey) {
      useLive.getState().patch({ dayKey, dayPnlSol: 0, halted: null });
    }

    let positions = useLive.getState().positions;
    if (positions.length > 0) {
      const marks = await markPrices({ data: { mints: positions.map((row) => row.mint) } });
      if (marks.ok) {
        if (marks.solUsd !== null) useLive.getState().patch({ solUsd: marks.solUsd });
        positions = positions.map((pos) => {
          const price = marks.prices[pos.mint];
          if (!price || !pos.entryPriceUsd) return pos;
          const pnl = price / pos.entryPriceUsd - 1;
          const peak = Math.max(pos.peakPnlPct, pnl);
          let trailArmed = pos.trailArmed;
          let trailStop = pos.trailStopPct;
          if (!trailArmed && peak >= TRAIL_ARM) {
            trailArmed = true;
            trailStop = peak - TRAIL_GIVE;
          } else if (trailArmed && trailStop !== null) {
            const ratcheted = peak - TRAIL_GIVE;
            if (ratcheted > trailStop + 0.01) trailStop = ratcheted;
          }
          return { ...pos, priceUsd: price, peakPnlPct: peak, trailArmed, trailStopPct: trailStop };
        });
        useLive.getState().patch({ positions });
      }
    }

    const forced = new Set(useLive.getState().exitMints);
    const flatten = useLive.getState().flatten;
    useLive.getState().patch({ exitMints: [], flatten: false });
    for (const pos of useLive.getState().positions) {
      const pnl = pos.entryPriceUsd > 0 ? pos.priceUsd / pos.entryPriceUsd - 1 : 0;
      const trailHit = pos.trailArmed && pos.trailStopPct !== null && pnl <= pos.trailStopPct;
      const stopHit = pnl <= HARD_STOP;
      if (flatten || forced.has(pos.mint) || stopHit || trailHit) {
        const reason = flatten || forced.has(pos.mint)
          ? `Flat ${pos.symbol}. Sold back to SOL.`
          : stopHit
            ? `Hard stop. ${pos.symbol} marked ${(pnl * 100).toFixed(1)}%.`
            : `Trail stop. ${pos.symbol} marked ${(pnl * 100).toFixed(1)}%.`;
        await sell(pos, reason);
      }
    }

    const now = useLive.getState();
    if (!now.armed || now.halted || !owner) {
      now.patch({
        status: !owner
          ? "No signer address."
          : now.halted
            ? now.halted
            : now.positions.length
              ? `Disarmed. Still watching ${now.positions.length} chain name${now.positions.length === 1 ? "" : "s"} for stops.`
              : "Disarmed. Paper still runs.",
      });
      return;
    }

    const tape = await fetchPublicTape();
    if (!tape.ok) {
      useLive.getState().patch({ status: "Public tape offline. No new buys." });
      return;
    }

    const openMints = new Set(useLive.getState().positions.map((row) => row.mint));
    const seen = new Set(useLive.getState().seen);
    const locks = useLive.getState().locks;
    let held = 0;
    let scanned = 0;
    for (const pair of tape.pairs) {
      scanned += 1;
      if (openMints.has(pair.mint) || seen.has(pair.mint)) continue;
      if ((locks[pair.mint] ?? 0) > Date.now()) {
        held += 1;
        continue;
      }
      const block = tapeBlock(pair);
      if (block) continue;
      if (useLive.getState().positions.length >= useLive.getState().maxPositions) {
        useLive.getState().patch({ status: `Book is full (${useLive.getState().maxPositions}). No new buys.` });
        return;
      }
      const screen = await screenMint({ data: { mint: pair.mint, venue: pair.venue } });
      if (!screen.ok) {
        if (!screen.reason.includes("rate")) useLive.getState().remember(pair.mint);
        useLive.getState().pushOrder(order({ side: "buy", symbol: pair.symbol, mint: pair.mint, signature: null, status: "skipped", reason: screen.reason }));
        continue;
      }
      if (pair.venue === "raydium" && screen.lpLockedPct !== null && screen.lpLockedPct < 80) continue;
      const score = liveScore(pair, screen.top10);
      if (score < MIN_LIVE_SCORE) {
        useLive.getState().remember(pair.mint);
        useLive.getState().pushOrder(
          order({ side: "buy", symbol: pair.symbol, mint: pair.mint, signature: null, status: "skipped", reason: `Score ${score.toFixed(2)} under 0.60.` }),
        );
        continue;
      }
      const balance = useLive.getState().sol ?? 0;
      const size = ticketSol(balance, useLive.getState().solPerTrade);
      if (size < MIN_TICKET_SOL) {
        useLive.getState().patch({
          status: `Balance ${balance.toFixed(3)} SOL cannot fund a ticket inside the 8% cap and ${0.02} SOL reserve.`,
        });
        return;
      }
      const note = `Bought ${size.toFixed(3)} SOL of ${pair.symbol}. Score ${score.toFixed(2)}. Cap ${(MAX_PCT * 100).toFixed(0)}%. ${screen.reason}`;
      await buy(pair, size, note);
      useLive.getState().patch({ status: note });
      return;
    }
    useLive.getState().patch({
      status: `Watching. Scanned ${scanned}. ${held} revenge-locked. Nothing cleared.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live cycle failed.";
    useLive.getState().patch({ status: message.slice(0, 180) });
  } finally {
    useLive.getState().patch({ busy: false });
  }
}

export function runLiveCycle(): Promise<void> {
  if (inflight) return inflight;
  inflight = cycle().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function requestFlatten() {
  useLive.getState().patch({ flatten: true });
  void runLiveCycle();
}

export function requestSell(mint: string) {
  const state = useLive.getState();
  if (!state.exitMints.includes(mint)) state.patch({ exitMints: [...state.exitMints, mint] });
  void runLiveCycle();
}
