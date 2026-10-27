import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildRecap,
  createDesk,
  nextNightTarget,
  nightBounds,
  noteMode,
  prewarm,
  stepMinute,
} from "@/lib/desk/engine";
import type { DeskState, Pair, PublicTapeResult } from "@/lib/desk/types";

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
};

function toPublicPair(row: PublicTapeResult["pairs"][number]): Pair {
  return {
    uid: `pub-${row.mint}`,
    mint: row.mint,
    symbol: row.symbol || row.mint.slice(0, 4),
    name: row.name || row.symbol,
    venue: row.venue,
    priceUsd: row.priceUsd > 0 ? row.priceUsd : 0.000001,
    volume1hUsd: row.volume1hUsd,
    liquidityUsd: row.liquidityUsd,
    mcapUsd: row.mcapUsd,
    ageMin: row.ageMin,
    buys1h: row.buys1h,
    sells1h: row.sells1h,
    mintRevoked: null,
    lpLocked: null,
    top10Pct: null,
    devWallet: null,
    devPriorRugs: null,
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
      reset: () => set(prewarm(createDesk((Date.now() ^ 0x9e3779b9) >>> 0), 150)),
      ingestPublic: (payload) =>
        set((cur) => {
          if (!payload.ok) {
            return {
              ...cur,
              publicTape: "offline",
              tapeNote: "Public tape offline. Indexed launches only — every name still has to clear the gates.",
            };
          }
          const seen = new Set(cur.seenMints);
          const inbox = cur.inbox.slice();
          let added = 0;
          for (const row of payload.pairs) {
            if (seen.has(row.mint)) continue;
            seen.add(row.mint);
            inbox.push(toPublicPair(row));
            added += 1;
          }
          const note =
            added > 0
              ? `Public tape live. ${added} Pump.fun / Raydium names queued. ${payload.dropped} other venues left on the floor.`
              : `Public tape live. No new Pump.fun or Raydium names. ${payload.dropped} other venues left on the floor.`;
          return {
            ...cur,
            publicTape: "live",
            tapeNote: note,
            inbox: inbox.slice(0, 30),
            seenMints: [...seen].slice(-400),
          };
        }),
    }),
    {
      name: "keel-desk-v1",
      version: 1,
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
          ...data
        } = state;
        return data;
      },
    },
  ),
);

export function bootDesk() {
  const current = useDesk.getState();
  if (!current.warmed) useDesk.setState(prewarm(current, 150));
}
