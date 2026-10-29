import { createServerFn } from "@tanstack/react-start";
import { ensureHeliusListener, geyserMintAddresses, status as heliusStatus } from "@/lib/desk/helius-stream";
import { isSolanaAddress } from "@/lib/desk/wallet";
import type { PublicPairDTO, PublicTapeResult, Venue } from "@/lib/desk/types";

const PUMP = new Set(["pumpfun", "pumpswap"]);
const RAY = new Set(["raydium", "raydium-clmm", "raydium-cp", "raydium-cpmm"]);

/** DexScreener often 403s bare server fetches without a browser-like UA. */
const DS_HEADERS: HeadersInit = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (compatible; MoonshineDesk/1.0; +https://github.com/PrinceKeldon/Moonshine)",
};

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

async function fetchJson(url: string, ms = 5000): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: DS_HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const fetchPublicTape = createServerFn({ method: "GET" }).handler(async (): Promise<PublicTapeResult> => {
  try {
    ensureHeliusListener();

    const [boosts, profiles] = await Promise.all([
      fetchJson("https://api.dexscreener.com/token-boosts/latest/v1"),
      fetchJson("https://api.dexscreener.com/token-profiles/latest/v1"),
    ]);

    const addresses: string[] = [];
    const seen = new Set<string>();
    const limit = 40;

    for (const mint of geyserMintAddresses(12)) {
      if (addresses.length >= limit) break;
      if (seen.has(mint)) continue;
      seen.add(mint);
      addresses.push(mint);
    }

    collectAddresses(boosts, seen, addresses, limit);
    collectAddresses(profiles, seen, addresses, limit);

    if (addresses.length === 0) {
      // Discovery endpoints empty/blocked — stay "ok" so UI does not freeze offline forever.
      return { ok: true, pairs: [], scanned: 0, dropped: 0 };
    }

    // Batch in chunks of 15 (DexScreener tokens path is picky about long URLs / rate).
    const pairs: RawPair[] = [];
    for (let i = 0; i < addresses.length; i += 15) {
      const chunk = addresses.slice(i, i + 15);
      const body = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`, 6000);
      if (body && typeof body === "object" && "pairs" in body && Array.isArray((body as { pairs: unknown }).pairs)) {
        pairs.push(...((body as { pairs: RawPair[] }).pairs));
      }
    }

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
    const scanned = addresses.length + (stream.enabled && stream.connected ? stream.bufferSize : 0);
    // Always ok:true after a successful run so a thin market is not shown as "offline".
    return { ok: true, pairs: out, scanned, dropped };
  } catch {
    return { ok: false, pairs: [], scanned: 0, dropped: 0 };
  }
});

export type ManualPairResult = {
  ok: boolean;
  pair: PublicPairDTO | null;
  error: string | null;
};

export const fetchMintPair = createServerFn({ method: "POST" })
  .validator((input: { mint: string }) => {
    const mint = input.mint.trim();
    if (!isSolanaAddress(mint)) throw new Error("Enter a valid Solana token mint.");
    return { mint };
  })
  .handler(async ({ data }): Promise<ManualPairResult> => {
    let body: unknown;
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(data.mint)}`,
        { headers: DS_HEADERS, signal: AbortSignal.timeout(7000) },
      );
      if (!response.ok) return { ok: false, pair: null, error: `DexScreener returned ${response.status}.` };
      body = await response.json();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Request failed.";
      return { ok: false, pair: null, error: `DexScreener request failed: ${message.slice(0, 120)}` };
    }
    if (!body || typeof body !== "object" || !("pairs" in body) || !Array.isArray(body.pairs)) {
      return { ok: false, pair: null, error: "DexScreener did not return token pairs." };
    }

    const matching = (body.pairs as RawPair[]).flatMap((raw) => {
      if (raw.chainId !== "solana" || raw.baseToken?.address !== data.mint) return [];
      const venue = venueOf(raw.dexId ?? "");
      if (!venue) return [];
      const priceUsd = num(raw.priceUsd);
      if (priceUsd <= 0) return [];
      const created = num(raw.pairCreatedAt);
      const symbol = (raw.baseToken?.symbol ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
      const name = (raw.baseToken?.name ?? symbol).replace(/\s+/g, " ").trim().slice(0, 48);
      if (!symbol || EXPLICIT.test(symbol) || EXPLICIT.test(name)) return [];
      return [{
        pair: {
          mint: data.mint,
          symbol,
          name: name || symbol,
          venue,
          priceUsd,
          volume1hUsd: num(raw.volume?.h1),
          liquidityUsd: num(raw.liquidity?.usd),
          mcapUsd: num(raw.marketCap) || num(raw.fdv),
          ageMin: created > 0 ? Math.max(0, (Date.now() - created) / 60000) : 0,
          buys1h: num(raw.txns?.h1?.buys),
          sells1h: num(raw.txns?.h1?.sells),
        } satisfies PublicPairDTO,
        volume: num(raw.volume?.h1),
        liquidity: num(raw.liquidity?.usd),
      }];
    });

    matching.sort((a, b) => b.volume - a.volume || b.liquidity - a.liquidity);
    const pair = matching[0]?.pair;
    return pair
      ? { ok: true, pair, error: null }
      : { ok: false, pair: null, error: "No supported Solana Pump.fun or Raydium pair was found for this mint." };
  });

export const fetchHeliusStreamStatus = createServerFn({ method: "GET" }).handler(async () => {
  ensureHeliusListener();
  return heliusStatus();
});
