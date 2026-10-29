/**
 * Helius Enhanced WebSocket listener (LaserStream / Geyser-style).
 *
 * Subscribes to successful transactions that touch Pump.fun or Raydium AMM,
 * extracts candidate token mints from account keys / logs, and keeps a short
 * ring buffer the public tape can merge on each poll.
 *
 * Requires HELIUS_API_KEY in the server environment. Without it the listener
 * stays idle and the desk falls back to DexScreener-only discovery.
 *
 * Note: a long-lived WebSocket only survives in a durable Node process
 * (`npm run dev` / a long-running host). Serverless cold starts will not keep
 * the stream open between requests.
 */

import type { Venue } from "@/lib/desk/types";

export type GeyserHit = {
  mint: string;
  venue: Venue;
  signature: string;
  seenAt: number;
};

export type HeliusStreamStatus = {
  enabled: boolean;
  connected: boolean;
  lastError: string | null;
  hits: number;
  bufferSize: number;
};

const PUMP_FUN = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const RAYDIUM_AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

const BUFFER_CAP = 48;
const DEDUPE_MS = 10 * 60 * 1000;

const buffer: GeyserHit[] = [];
const seenMints = new Map<string, number>();

let ws: WebSocket | null = null;
let connected = false;
let lastError: string | null = null;
let hits = 0;
let started = false;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function apiKey(): string | undefined {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key || undefined;
}

function pushHit(mint: string, venue: Venue, signature: string) {
  if (!mint || mint.length < 32) return;
  const now = Date.now();
  const prior = seenMints.get(mint);
  if (prior && now - prior < DEDUPE_MS) return;
  seenMints.set(mint, now);
  // prune stale dedupe keys
  if (seenMints.size > 400) {
    for (const [m, t] of seenMints) {
      if (now - t > DEDUPE_MS) seenMints.delete(m);
    }
  }
  const row: GeyserHit = { mint, venue, signature, seenAt: now };
  buffer.unshift(row);
  if (buffer.length > BUFFER_CAP) buffer.length = BUFFER_CAP;
  hits += 1;
}

function pubkeyOf(key: unknown): string | null {
  if (typeof key === "string") return key;
  if (key && typeof key === "object" && "pubkey" in key) {
    const p = (key as { pubkey?: unknown }).pubkey;
    return typeof p === "string" ? p : null;
  }
  return null;
}

function extractFromNotification(payload: unknown) {
  if (!payload || typeof payload !== "object") return;
  const root = payload as {
    method?: string;
    params?: { result?: unknown };
    result?: unknown;
  };
  const result =
    root.params && typeof root.params === "object" && "result" in root.params
      ? root.params.result
      : root.result;
  if (!result || typeof result !== "object") return;

  const r = result as {
    signature?: string;
    transaction?: {
      meta?: { logMessages?: string[]; err?: unknown };
      transaction?: { message?: { accountKeys?: unknown[] } };
      message?: { accountKeys?: unknown[] };
    };
  };

  const signature = typeof r.signature === "string" ? r.signature : "";
  const tx = r.transaction;
  if (!tx) return;
  if (tx.meta?.err) return;

  const logs = tx.meta?.logMessages ?? [];
  const keysRaw =
    tx.transaction?.message?.accountKeys ?? tx.message?.accountKeys ?? [];
  const keys = keysRaw.map(pubkeyOf).filter((k): k is string => Boolean(k));

  const isPumpInit = logs.some(
    (l) =>
      typeof l === "string" &&
      (l.includes("Instruction: InitializeMint2") ||
        l.includes("Instruction: Create") ||
        l.includes("InitializeMint")),
  );
  const touchesPump = keys.includes(PUMP_FUN) || logs.some((l) => typeof l === "string" && l.includes(PUMP_FUN));
  const touchesRay = keys.includes(RAYDIUM_AMM_V4) || logs.some((l) => typeof l === "string" && l.includes("raydium"));

  // Pump.fun: creator is often keys[0], mint keys[1] on InitializeMint2 paths.
  if (touchesPump && isPumpInit && keys.length >= 2) {
    const mint = keys[1];
    if (mint && mint !== PUMP_FUN) pushHit(mint, "pump.fun", signature);
    return;
  }

  // Raydium: any successful non-failed tx that includes the AMM program —
  // take the first non-program, non-system account as a candidate mint hint.
  // DexScreener enrichment will drop non-tokens.
  if (touchesRay && keys.length >= 3) {
    const SYSTEM = "11111111111111111111111111111111";
    const TOKEN_PROG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    for (const k of keys) {
      if (!k) continue;
      if (k === RAYDIUM_AMM_V4 || k === SYSTEM || k === TOKEN_PROG || k === PUMP_FUN) continue;
      if (k.endsWith("1111111111111111111111111111111")) continue;
      // Prefer accounts that look like mints (base58 length typical of pubkeys already)
      pushHit(k, "raydium", signature);
      break;
    }
  }
}

function subscribe(socket: WebSocket) {
  const commonOpts = {
    commitment: "confirmed",
    encoding: "jsonParsed",
    transactionDetails: "full",
    maxSupportedTransactionVersion: 1,
  };

  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "transactionSubscribe",
      params: [{ failed: false, accountInclude: [PUMP_FUN] }, commonOpts],
    }),
  );
  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "transactionSubscribe",
      params: [{ failed: false, accountInclude: [RAYDIUM_AMM_V4] }, commonOpts],
    }),
  );
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    started = false;
    ensureHeliusListener();
  }, 5_000);
}

/** Start the WebSocket once per process. Safe to call repeatedly. */
export function ensureHeliusListener(): HeliusStreamStatus {
  const key = apiKey();
  if (!key) {
    return { enabled: false, connected: false, lastError: null, hits, bufferSize: buffer.length };
  }

  if (started && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return status();
  }

  started = true;
  lastError = null;

  try {
    const url = `wss://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
    const socket = new WebSocket(url);
    ws = socket;

    socket.addEventListener("open", () => {
      connected = true;
      lastError = null;
      subscribe(socket);
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ jsonrpc: "2.0", method: "ping", id: Date.now() }));
          } catch {
            /* ignore */
          }
        }
      }, 20_000);
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        extractFromNotification(data);
      } catch {
        /* ignore malformed frames */
      }
    });

    socket.addEventListener("error", () => {
      lastError = "Helius WebSocket error";
      connected = false;
    });

    socket.addEventListener("close", () => {
      connected = false;
      ws = null;
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      scheduleReconnect();
    });
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Failed to open Helius WebSocket";
    started = false;
    connected = false;
  }

  return status();
}

export function status(): HeliusStreamStatus {
  return {
    enabled: Boolean(apiKey()),
    connected,
    lastError,
    hits,
    bufferSize: buffer.length,
  };
}

/** Drain recent geyser hits (does not clear; callers dedupe by mint). */
export function recentGeyserHits(limit = 16): GeyserHit[] {
  ensureHeliusListener();
  return buffer.slice(0, limit);
}

export function geyserMintAddresses(limit = 16): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const hit of recentGeyserHits(limit * 2)) {
    if (seen.has(hit.mint)) continue;
    seen.add(hit.mint);
    out.push(hit.mint);
    if (out.length >= limit) break;
  }
  return out;
}
