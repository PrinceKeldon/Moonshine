import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildRecap,
  createDesk,
  applyLiveMarks,
  noteMode,
  SESSION,
  MINUTE,
  stepMinute,
} from "@/lib/desk/engine";
import { migrateDesk } from "@/lib/desk/store-migrations";
import type { AgentId, Decision, DeskLog, DeskState, Pair, PublicTapeResult, Tone, WatchSnapshot } from "@/lib/desk/types";

const memory = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return memory.get(key) ?? null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") {
      memory.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") {
      memory.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
  },
};

export type DeskActions = {
  tick: () => void;
  toggleRun: () => void;
  startNight: () => void;
  openRecap: () => void;
  closeRecap: () => void;
  setArmOpen: (open: boolean) => void;
  armShadow: () => void;
  setPaper: () => void;
  reset: () => void;
  ingestPublic: (payload: PublicTapeResult) => void;
  stagePublicCandidates: (payload: PublicTapeResult) => void;
  setScanState: (state: DeskState["scanState"]) => void;
  markPaperPrices: (prices: Record<string, number>) => void;
  saveWatch: (address: string, snapshot: WatchSnapshot) => void;
  clearWatch: () => void;
  liveEvent: (
    agent: AgentId,
    kind: DeskLog["kind"],
    symbol: string | null,
    reason: string,
    tone: Tone,
    decision?: { mint: string; outcome: Decision["outcome"] },
  ) => void;
};

function toPublicPair(row: PublicTapeResult["pairs"][number]): Pair {
  return {
    uid: `pub-${row.mint}`,
    mint: row.mint,
    symbol: row.symbol || row.mint.slice(0, 4),
    name: row.name || row.symbol,
    venue: row.venue,
    priceUsd: row.priceUsd,
    volume1hUsd: row.volume1hUsd,
    liquidityUsd: row.liquidityUsd,
    mcapUsd: row.mcapUsd,
    ageMin: row.ageMin,
    buys1h: row.buys1h,
    sells1h: row.sells1h,
    mintRevoked: row.mintRevoked ?? null,
    freezeRevoked: row.freezeRevoked ?? null,
    lpLocked: row.lpLocked ?? null,
    top10Pct: row.top10Pct ?? null,
    devWallet: row.creator ?? null,
    devPriorRugs: row.devPriorRugs ?? null,
    devHistoryTokens: row.creatorTokenCount ?? null,
    safetyReason: row.safetyReason ?? null,
    source: "public",
  };
}

function finishNight(cur: DeskState, next: DeskState): DeskState {
  return {
    ...next,
    running: false,
    overnight: false,
    heldRun: false,
    recap: buildRecap(next, cur.recapFrom, next.deskTime),
    recapOpen: true,
  };
}

export const useDesk = create<DeskState & DeskActions>()(
  persist(
    (set) => ({
      ...createDesk(),
      stagePublicCandidates: (payload) =>
        set((cur) => ({
          ...cur,
          scanState: "screening",
          marketUpdatedAt: Date.now(),
          marketScanned: payload.scanned,
          marketDropped: payload.dropped,
          marketCandidates: payload.pairs.map((pair) => ({ ...pair, safetyState: "checking" })),
        })),
      setScanState: (scanState) => set({ scanState }),
      tick: () =>
        set((cur) => {
          if (!cur.running) return cur;
          const span = cur.nightTarget - cur.recapFrom;
          if (span < SESSION - MINUTE) return { running: false, overnight: false };
          const next = stepMinute(cur);
          if (next.deskTime >= cur.nightTarget) return finishNight(cur, next);
          return { ...next, overnight: false };
        }),
      toggleRun: () =>
        set((cur) => {
          if (cur.running) return { running: false, overnight: false };
          const span = cur.nightTarget - cur.recapFrom;
          const open = span >= SESSION - MINUTE && cur.deskTime < cur.nightTarget;
          if (!open) {
            return {
              running: true,
              overnight: false,
              recapOpen: false,
              heldRun: false,
              recapFrom: cur.deskTime,
              nightTarget: cur.deskTime + SESSION,
            };
          }
          return { running: true, overnight: false, recapOpen: false };
        }),
      startNight: () =>
        set((cur) => ({
          running: true,
          overnight: false,
          recapOpen: false,
          heldRun: false,
          recapFrom: cur.deskTime,
          nightTarget: cur.deskTime + SESSION,
        })),
      openRecap: () =>
        set((cur) => ({
          recap: buildRecap(cur, cur.recapFrom, cur.deskTime),
          recapOpen: true,
          heldRun: cur.running,
          running: false,
          overnight: false,
        })),
      closeRecap: () =>
        set((cur) => ({
          recapOpen: false,
          running: cur.heldRun,
          heldRun: false,
        })),
      setArmOpen: (open) => set({ armOpen: open }),
      armShadow: () => set((cur) => ({ ...noteMode(cur, "shadow"), armOpen: false })),
      setPaper: () => set((cur) => noteMode(cur, "paper")),
      reset: () =>
        set((cur) => ({ ...createDesk((Date.now() ^ 0x9e3779b9) >>> 0), watchAddress: cur.watchAddress ?? "", watch: cur.watch ?? null })),
      liveEvent: (agent, kind, symbol, reason, tone, decision) =>
        set((cur) => {
          const seq = cur.seq + 1;
          const row: DeskLog = { id: `L${seq}`, t: cur.deskTime, agent, symbol, kind, reason };
          const logs = [...cur.logs, row];
          if (logs.length > 180) logs.splice(0, logs.length - 180);
          const agents = { ...cur.agents, [agent]: { last: reason, tone } };
          let decisions = cur.decisions;
          if (decision && symbol) {
            decisions = [...cur.decisions, { t: cur.deskTime, symbol, mint: decision.mint, outcome: decision.outcome, reason }];
            if (decisions.length > 3000) decisions = decisions.slice(decisions.length - 3000);
          }
          return { ...cur, seq, logs, agents, decisions };
        }),
      ingestPublic: (payload) =>
        set((cur) => {
          if (!payload.ok) {
            return {
              ...cur,
              publicTape: "offline",
              scanState: "offline",
              tapeNote: "Public tape offline. Paper trading is paused until live market data returns.",
            };
          }
          const seen = new Set(cur.seenMints);
          const checkedMints = new Set(cur.checkedMints ?? []);
          const inbox = cur.inbox.slice();
          let added = 0;
          let newlyChecked = 0;
          const latestByMint = new Map(
            payload.pairs.map((row) => toPublicPair(row)).filter((pair) => pair.priceUsd > 0).map((pair) => [pair.mint, pair]),
          );
          for (const pair of latestByMint.values()) {
            const queued = inbox.findIndex((item) => item.mint === pair.mint);
            if (queued >= 0) inbox[queued] = pair;
            const wasChecked = checkedMints.has(pair.mint);
            const checkedNow = payload.pairs.find((row) => row.mint === pair.mint)?.safetyChecked === true;
            if (checkedNow) checkedMints.add(pair.mint);
            const isNew = !seen.has(pair.mint);
            const isNewlyChecked = checkedNow && !wasChecked && queued < 0 && !isNew;
            if (isNew || isNewlyChecked) {
              seen.add(pair.mint);
              inbox.push(pair);
              if (isNewlyChecked) newlyChecked += 1;
              if (isNew) added += 1;
            }
          }
          const opens = cur.opens.map((position) => {
            const latest = latestByMint.get(position.mint);
            return latest ? { ...position, price: latest.priceUsd, template: latest } : position;
          });
          const note =
            added > 0 || newlyChecked > 0
              ? `Live market data. ${added} new listings and ${newlyChecked} RugCheck retries queued. Scorp creator history is checked when indexed; unknown remains blocked.`
              : `Live market data refreshed. RugCheck screens candidates; Scorp creator history is required for paper fills. Unknown remains blocked.`;
          return {
            ...cur,
            opens,
            publicTape: "live",
            scanState: "live",
            marketUpdatedAt: Date.now(),
            marketScanned: payload.scanned,
            marketDropped: payload.dropped,
            marketCandidates: payload.pairs,
            tapeNote: note,
            inbox: inbox.slice(0, 30),
            seenMints: [...seen].slice(-400),
            checkedMints: [...checkedMints].slice(-400),
          };
        }),
      markPaperPrices: (prices) => set((cur) => applyLiveMarks(cur, prices)),
      saveWatch: (address, snapshot) => set({ watchAddress: address, watch: snapshot }),
      clearWatch: () => set({ watchAddress: "", watch: null }),
    }),
    {
      name: "keel-desk-v1",
      version: 4,
      migrate: migrateDesk,
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => {
        const {
          tick: _tick,
          toggleRun: _toggleRun,
          startNight: _startNight,
          openRecap: _openRecap,
          closeRecap: _closeRecap,
          setArmOpen: _setArmOpen,
          armShadow: _armShadow,
          setPaper: _setPaper,
          reset: _reset,
          ingestPublic: _ingestPublic,
          stagePublicCandidates: _stagePublicCandidates,
          setScanState: _setScanState,
          markPaperPrices: _markPaperPrices,
          saveWatch: _saveWatch,
          clearWatch: _clearWatch,
          liveEvent: _liveEvent,
          ...data
        } = state;
        return data;
      },
    },
  ),
);

export function bootDesk() {
  const current = useDesk.getState();
  if (typeof current.watchAddress !== "string") useDesk.setState({ watchAddress: "", watch: current.watch ?? null });
}
