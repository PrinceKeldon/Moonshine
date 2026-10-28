import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildRecap,
  createDesk,
  nextNightTarget,
  nightBounds,
  noteMode,
  stepMinute,
} from "@/lib/desk/engine";
import type { DeskState, Pair, PublicTapeResult, WatchSnapshot } from "@/lib/desk/types";

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
  markPaperPrices: (prices: Record<string, number>) => void;
  saveWatch: (address: string, snapshot: WatchSnapshot) => void;
  clearWatch: () => void;
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
      tick: () =>
        set((cur) => {
          if (!cur.running) return cur;
          const bursts = cur.overnight ? 4 : 1;
          let next: DeskState = cur;
          for (let i = 0; i < bursts; i += 1) {
            next = stepMinute(next);
            if (cur.overnight && next.deskTime >= cur.nightTarget) return finishNight(cur, next);
          }
          return next;
        }),
      toggleRun: () =>
        set((cur) => ({
          running: !cur.running,
          overnight: cur.running ? false : cur.overnight,
        })),
      startNight: () =>
        set((cur) => {
          const night = nextNightTarget(cur.deskTime);
          return {
            running: true,
            overnight: true,
            recapOpen: false,
            heldRun: false,
            recapFrom: night.from,
            nightTarget: night.target,
          };
        }),
      openRecap: () =>
        set((cur) => {
          const bounds = nightBounds(cur.deskTime);
          return {
            recap: buildRecap(cur, bounds.from, bounds.to),
            recapOpen: true,
            heldRun: cur.running,
            running: false,
            overnight: false,
          };
        }),
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
      ingestPublic: (payload) =>
        set((cur) => {
          if (!payload.ok) {
            return {
              ...cur,
              publicTape: "offline",
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
              ? `Live market data. ${added} new listings and ${newlyChecked} RugCheck retries queued. Creator rug history is still required; no chain orders are sent.`
              : `Live market data refreshed. RugCheck screens candidates; paper positions use the latest public price. Creator rug history is still required.`;
          return {
            ...cur,
            opens,
            publicTape: "live",
            tapeNote: note,
            inbox: inbox.slice(0, 30),
            seenMints: [...seen].slice(-400),
            checkedMints: [...checkedMints].slice(-400),
          };
        }),
      markPaperPrices: (prices) =>
        set((cur) => ({
          opens: cur.opens.map((position) => {
            const price = prices[position.mint];
            return Number.isFinite(price) && price > 0 ? { ...position, price } : position;
          }),
        })),
      saveWatch: (address, snapshot) => set({ watchAddress: address, watch: snapshot }),
      clearWatch: () => set({ watchAddress: "", watch: null }),
    }),
    {
      name: "keel-desk-v1",
      version: 3,
      migrate: (persisted: unknown) => {
        const old = persisted && typeof persisted === "object" ? (persisted as Partial<DeskState>) : {};
        return {
          ...createDesk(),
          watchAddress: typeof old.watchAddress === "string" ? old.watchAddress : "",
          watch: old.watch ?? null,
        };
      },
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
          markPaperPrices: _markPaperPrices,
          saveWatch: _saveWatch,
          clearWatch: _clearWatch,
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
