import { createServerFn } from "@tanstack/react-start";
import { ensureHeliusListener, geyserMintAddresses, status as heliusStatus } from "@/lib/desk/helius-stream";
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

/** Pull Solana token addresses from a DexScreener list payload (boosts or profiles). */
function collectAddresses(payload: unknown, seen: Set<string>, addresses: string[], limit: number) {
  if (!Array.isArray(payload)) return;
  for (const row of payload) {
    if (addresses.length >= limit) return;
    if (!row || typeof row !== "object") continue;
    const chain = "chainId" in row ? String(row.chainId) : "";
    const token = "tokenAddress" in row ? String(row.tokenAddress) : "";
    if (chain !== "solana" || token.length < 20 || seen.has(token)) continue;
    seen.add(token);
    addresses.push(token);
  }
}

export const fetchPublicTape = createServerFn({ method: "GET" }).handler(async (): Promise<PublicTapeResult> => {
  const empty: PublicTapeResult = { ok: false, pairs: [], scanned: 0, dropped: 0 };
  try {
    // Keep the Helius stream warm on every tape pull (no-op without API key).
    ensureHeliusListener();

    // DexScreener discovery + real-time geyser mints from Helius.
    const [boostsRes, profilesRes] = await Promise.all([
      fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
        signal: AbortSignal.timeout(4500),
        headers: { accept: "application/json" },
      }),
      fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
        signal: AbortSignal.timeout(4500),
        headers: { accept: "application/json" },
      }),
    ]);

    const addresses: string[] = [];
    const seen = new Set<string>();
    const limit = 40;

    // Prefer on-chain hits first so brand-new pairs rank into enrichment.
    for (const mint of geyserMintAddresses(12)) {
      if (addresses.length >= limit) break;
      if (seen.has(mint)) continue;
      seen.add(mint);
      addresses.push(mint);
    }

    if (boostsRes.ok) {
      collectAddresses(await boostsRes.json(), seen, addresses, limit);
    }
    if (profilesRes.ok && addresses.length < limit) {
      collectAddresses(await profilesRes.json(), seen, addresses, limit);
    }

    if (addresses.length === 0) {
      // Still report ok so the desk knows the poll ran (stream may just be quiet).
      return { ok: true, pairs: [], scanned: 0, dropped: 0 };
    }

    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(",")}`, {
      signal: AbortSignal.timeout(4500),
      headers: { accept: "application/json" },
    });
    if (!dexRes.ok) return empty;
    const body: unknown = await dexRes.json();
    const pairs: RawPair[] =
      body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];

    const best = new Map<string, { pair: RawPair; venue: Venue; liq: number; vol: number }>();
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
      const vol = num(pair.volume?.h1);
      const prev = best.get(mint);
      if (!prev || vol > prev.vol || (vol === prev.vol && liq > prev.liq)) {
        best.set(mint, { pair, venue, liq, vol });
      }
    }

    const ranked = [...best.entries()].sort((a, b) => b[1].vol - a[1].vol);

    const out: PublicPairDTO[] = [];
    for (const [mint, pick] of ranked) {
      const pair = pick.pair;
      const created = num(pair.pairCreatedAt);
      const ageMin = created > 0 ? Math.max(0, (Date.now() - created) / 60000) : 0;
      const priceUsd = num(pair.priceUsd);
      if (!(priceUsd > 0)) continue;
      const symbol = (pair.baseToken?.symbol ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
      const name = (pair.baseToken?.name ?? symbol).replace(/\s+/g, " ").trim().slice(0, 48);
      if (!symbol || EXPLICIT.test(symbol) || EXPLICIT.test(name)) continue;
      out.push({
        mint,
        symbol,
        name: name || symbol,
        venue: pick.venue,
        priceUsd,
        volume1hUsd: num(pair.volume?.h1),
        liquidityUsd: num(pair.liquidity?.usd),
        mcapUsd: num(pair.marketCap) || num(pair.fdv),
        ageMin,
        buys1h: num(pair.txns?.h1?.buys),
        sells1h: num(pair.txns?.h1?.sells),
      });
      if (out.length >= 14) break;
    }

    const stream = heliusStatus();
    if (stream.enabled && stream.connected) {
      // Scanned count includes stream buffer so the UI can see activity.
      return { ok: true, pairs: out, scanned: addresses.length + stream.bufferSize, dropped };
    }

    return { ok: true, pairs: out, scanned: addresses.length, dropped };
  } catch {
    return empty;
  }
});

/** Desk / ops can poll stream health without pulling the full tape. */
export const fetchHeliusStreamStatus = createServerFn({ method: "GET" }).handler(async () => {
  ensureHeliusListener();
  return heliusStatus();
});
