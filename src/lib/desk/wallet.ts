import { createServerFn } from "@tanstack/react-start";
import type { WatchResult, WatchSnapshot, WatchToken } from "@/lib/desk/types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

export function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  let zeros = 0;
  while (value[zeros] === "1") zeros += 1;
  const bytes: number[] = [];
  for (let i = zeros; i < value.length; i += 1) {
    const digit = B58.indexOf(value[i] ?? "");
    if (digit < 0) return false;
    let carry = digit;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return zeros + bytes.length === 32;
}

type ParsedAccount = {
  mint?: string;
  tokenAmount?: { uiAmount?: number | null; uiAmountString?: string };
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "The chain did not answer.";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        last = "The chain did not answer.";
        continue;
      }
      const body: unknown = await res.json();
      if (!body || typeof body !== "object") continue;
      if ("error" in body && body.error) {
        const message =
          typeof body.error === "object" && body.error && "message" in body.error ? String(body.error.message) : "The chain refused that address.";
        last = message.slice(0, 140);
        continue;
      }
      return "result" in body ? body.result : null;
    } catch {
      last = "The chain did not answer.";
    }
  }
  throw new Error(last);
}

function accountsOf(result: unknown): ParsedAccount[] {
  if (!result || typeof result !== "object" || !("value" in result) || !Array.isArray(result.value)) return [];
  const out: ParsedAccount[] = [];
  for (const row of result.value) {
    if (!row || typeof row !== "object" || !("account" in row)) continue;
    const account = row.account;
    if (!account || typeof account !== "object" || !("data" in account)) continue;
    const data = account.data;
    if (!data || typeof data !== "object" || !("parsed" in data)) continue;
    const parsed = data.parsed;
    if (!parsed || typeof parsed !== "object" || !("info" in parsed)) continue;
    const info = parsed.info;
    if (info && typeof info === "object") out.push(info as ParsedAccount);
  }
  return out;
}

async function quotes(mints: string[]): Promise<Map<string, { symbol: string; price: number }>> {
  const map = new Map<string, { symbol: string; price: number; liq: number }>();
  if (mints.length === 0) return map;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return map;
    const body: unknown = await res.json();
    const pairs =
      body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];
    for (const pair of pairs) {
      if (!pair || typeof pair !== "object") continue;
      const base = "baseToken" in pair && pair.baseToken && typeof pair.baseToken === "object" ? pair.baseToken : null;
      const mint = base && "address" in base ? String(base.address) : "";
      const symbol = base && "symbol" in base ? String(base.symbol) : "";
      const price = "priceUsd" in pair ? Number(pair.priceUsd) : NaN;
      const liq =
        "liquidity" in pair && pair.liquidity && typeof pair.liquidity === "object" && "usd" in pair.liquidity
          ? Number(pair.liquidity.usd)
          : 0;
      if (!mint || !Number.isFinite(price)) continue;
      const prev = map.get(mint);
      if (!prev || liq > prev.liq) map.set(mint, { symbol: symbol.slice(0, 16), price, liq });
    }
  } catch {
    return map;
  }
  return map;
}

export const fetchWallet = createServerFn({ method: "POST" })
  .validator((input: { address: string }) => {
    const address = input.address.trim();
    if (!isSolanaAddress(address)) throw new Error("That is not a Solana address.");
    return { address };
  })
  .handler(async ({ data }): Promise<WatchResult> => {
    try {
      const balance = await rpc("getBalance", [data.address]);
      const lamports =
        balance && typeof balance === "object" && "value" in balance && typeof balance.value === "number" ? balance.value : 0;
      const sol = lamports / 1_000_000_000;

      const bags = await Promise.all(
        TOKEN_PROGRAMS.map(async (programId) => {
          try {
            return accountsOf(
              await rpc("getTokenAccountsByOwner", [data.address, { programId }, { encoding: "jsonParsed" }]),
            );
          } catch {
            return [];
          }
        }),
      );

      const held = new Map<string, number>();
      for (const info of bags.flat()) {
        const mint = info.mint;
        if (!mint) continue;
        const amount = Number(info.tokenAmount?.uiAmountString ?? info.tokenAmount?.uiAmount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        held.set(mint, (held.get(mint) ?? 0) + amount);
      }

      const mints = [SOL_MINT, ...held.keys()].slice(0, 30);
      const priced = await quotes(mints);
      const solQuote = priced.get(SOL_MINT);
      const tokens: WatchToken[] = [...held.entries()]
        .map(([mint, amount]) => {
          const quote = priced.get(mint);
          return {
            mint,
            symbol: mint === SOL_MINT ? "wSOL" : quote?.symbol || mint.slice(0, 4),
            amount,
            usd: quote ? amount * quote.price : null,
          };
        })
        .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1))
        .slice(0, 12);

      const snapshot: WatchSnapshot = {
        address: data.address,
        sol,
        solUsd: solQuote ? sol * solQuote.price : null,
        tokens,
        fetchedAt: Date.now(),
      };
      return { ok: true, snapshot, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The chain did not answer.";
      return { ok: false, snapshot: null, error: message.slice(0, 160) };
    }
  });
