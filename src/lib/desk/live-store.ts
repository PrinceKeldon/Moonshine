import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Venue } from "@/lib/desk/types";

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

export type LivePosition = {
  mint: string;
  symbol: string;
  venue: Venue;
  solIn: number;
  tokenRaw: string;
  tokenUi: number;
  entryPriceUsd: number;
  priceUsd: number;
  openedAt: number;
  signature: string;
  peakPnlPct: number;
  trailArmed: boolean;
  trailStopPct: number | null;
};

export type LiveOrder = {
  id: string;
  t: number;
  side: "buy" | "sell";
  symbol: string;
  mint: string;
  signature: string | null;
  status: "filled" | "failed" | "skipped";
  reason: string;
};

export type LiveData = {
  armed: boolean;
  signer: "phantom" | "desk";
  phantom: string;
  deskPubkey: string;
  solPerTrade: number;
  slippageBps: number;
  maxPositions: number;
  dailyLossSol: number;
  dayKey: string;
  dayPnlSol: number;
  halted: string | null;
  positions: LivePosition[];
  orders: LiveOrder[];
  seen: string[];
  locks: Record<string, number>;
  status: string;
  sol: number | null;
  solUsd: number | null;
  busy: boolean;
  flatten: boolean;
  exitMints: string[];
};

type LiveActions = {
  patch: (partial: Partial<LiveData>) => void;
  pushOrder: (order: LiveOrder) => void;
  remember: (mint: string) => void;
};

export type LiveState = LiveData & LiveActions;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initial(): LiveData {
  return {
    armed: false,
    signer: "desk",
    phantom: "",
    deskPubkey: "",
    solPerTrade: 0.05,
    slippageBps: 150,
    maxPositions: 2,
    dailyLossSol: 0.2,
    dayKey: today(),
    dayPnlSol: 0,
    halted: null,
    positions: [],
    orders: [],
    seen: [],
    locks: {},
    status: "Disarmed. Paper still runs.",
    sol: null,
    solUsd: null,
    busy: false,
    flatten: false,
    exitMints: [],
  };
}

export const useLive = create<LiveState>()(
  persist(
    (set) => ({
      ...initial(),
      patch: (partial) => set(partial),
      pushOrder: (order) => set((state) => ({ orders: [order, ...state.orders].slice(0, 40) })),
      remember: (mint) =>
        set((state) => ({
          seen: state.seen.includes(mint) ? state.seen : [...state.seen, mint].slice(-400),
        })),
    }),
    {
      name: "keel-live-v1",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        armed: state.armed,
        signer: state.signer,
        phantom: state.phantom,
        deskPubkey: state.deskPubkey,
        solPerTrade: state.solPerTrade,
        slippageBps: state.slippageBps,
        maxPositions: state.maxPositions,
        dailyLossSol: state.dailyLossSol,
        dayKey: state.dayKey,
        dayPnlSol: state.dayPnlSol,
        halted: state.halted,
        positions: state.positions,
        orders: state.orders,
        seen: state.seen,
        locks: state.locks,
        status: state.status,
        sol: state.sol,
        solUsd: state.solUsd,
      }),
    },
  ),
);

export function activeAddress(state: Pick<LiveData, "signer" | "phantom" | "deskPubkey">): string {
  return state.signer === "desk" ? state.deskPubkey : state.phantom;
}

export function dayStamp(): string {
  return today();
}
