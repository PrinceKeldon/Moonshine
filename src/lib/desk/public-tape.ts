import { createServerFn } from "@tanstack/react-start";
import type { PublicPairDTO, PublicTapeResult, Venue } from "@/lib/desk/types";

const PUMP = new Set(["pumpfun", "pumpswap"]);
const RAY = new Set(["raydium", "raydium-clmm", "raydium-cp", "raydium-cpmm"]);

function venueOf(dexId: string): Venue | null {
  const id = dexId.toLowerCase();
  if (PUMP.has(id)) return "pump.fun";
  if (RAY.has(id)) return "raydium";
  return null;
}

type RawPair = {
  chainId?: string;
  dexId?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  volume?: { h1?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  txns?: { h1?: { buys?: number; sells?: number } };
};

const EXPLICIT = /\b(sex|nude|porn|xxx|horny|slut|cock|dick|pussy|boob|tits|fuck|nsfw|milf|onlyfans)\b/i;

function num(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export const fetchPublicTape = createServerFn({ method: "GET" }).handler(async (): Promise<PublicTapeResult> => {
  const empty: PublicTapeResult = { ok: false, pairs: [], scanned: 0, dropped: 0 };
  try {
    const boostsRes = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
      signal: AbortSignal.timeout(4500),
      headers: { accept: "application/json" },
    });
    if (!boostsRes.ok) return empty;
    const boosts: unknown = await boostsRes.json();
    if (!Array.isArray(boosts)) return empty;

    const addresses: string[] = [];
    const seen = new Set<string>();
    for (const row of boosts) {
      if (!row || typeof row !== "object") continue;
      const chain = "chainId" in row ? String(row.chainId) : "";
      const token = "tokenAddress" in row ? String(row.tokenAddress) : "";
      if (chain !== "solana" || token.length < 20 || seen.has(token)) continue;
      seen.add(token);
      addresses.push(token);
      if (addresses.length >= 24) break;
    }
    if (addresses.length === 0) return { ok: true, pairs: [], scanned: 0, dropped: 0 };

    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(",")}`, {
      signal: AbortSignal.timeout(4500),
      headers: { accept: "application/json" },
    });
    if (!dexRes.ok) return empty;
    const body: unknown = await dexRes.json();
    const pairs: RawPair[] =
      body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];

    const best = new Map<string, { pair: RawPair; venue: Venue; liq: number }>();
    let dropped = 0;
    for (const pair of pairs) {
      if (pair.chainId !== "solana") continue;
      const mint = pair.baseToken?.address;
      if (!mint) continue;
      const venue = venueOf(pair.dexId ?? "");
      if (!venue) {
        dropped += 1;
        continue;
      }
      const liq = num(pair.liquidity?.usd);
      const prev = best.get(mint);
      if (!prev || liq > prev.liq) best.set(mint, { pair, venue, liq });
    }

    const out: PublicPairDTO[] = [];
    for (const [mint, pick] of best) {
      const pair = pick.pair;
      const created = num(pair.pairCreatedAt);
      const ageMin = created > 0 ? Math.max(0, (Date.now() - created) / 60000) : 0;
      const symbol = (pair.baseToken?.symbol ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
      const name = (pair.baseToken?.name ?? symbol).replace(/\s+/g, " ").trim().slice(0, 48);
      if (!symbol || EXPLICIT.test(symbol) || EXPLICIT.test(name)) continue;
      out.push({
        mint,
        symbol,
        name: name || symbol,
        venue: pick.venue,
        priceUsd: num(pair.priceUsd),
        volume1hUsd: num(pair.volume?.h1),
        liquidityUsd: num(pair.liquidity?.usd),
        mcapUsd: num(pair.marketCap) || num(pair.fdv),
        ageMin,
        buys1h: num(pair.txns?.h1?.buys),
        sells1h: num(pair.txns?.h1?.sells),
      });
      if (out.length >= 8) break;
    }

    return { ok: true, pairs: out, scanned: addresses.length, dropped };
  } catch {
    return empty;
  }
});
