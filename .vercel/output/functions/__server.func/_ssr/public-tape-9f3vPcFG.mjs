import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/public-tape-9f3vPcFG.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var PUMP = /* @__PURE__ */ new Set(["pumpfun", "pumpswap"]);
var RAY = /* @__PURE__ */ new Set([
	"raydium",
	"raydium-clmm",
	"raydium-cp",
	"raydium-cpmm"
]);
function venueOf(dexId) {
	const id = dexId.toLowerCase();
	if (PUMP.has(id)) return "pump.fun";
	if (RAY.has(id)) return "raydium";
	return null;
}
function num(value) {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : 0;
}
var fetchPublicTape_createServerFn_handler = createServerRpc({
	id: "1c636824bf6aa89498ed10efb134f011b2de42d34dcbdd2c82d81397403c4021",
	name: "fetchPublicTape",
	filename: "src/lib/desk/public-tape.ts"
}, (opts) => fetchPublicTape.__executeServer(opts));
var fetchPublicTape = createServerFn({ method: "GET" }).handler(fetchPublicTape_createServerFn_handler, async () => {
	const empty = {
		ok: false,
		pairs: [],
		scanned: 0,
		dropped: 0
	};
	try {
		const boostsRes = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
			signal: AbortSignal.timeout(4500),
			headers: { accept: "application/json" }
		});
		if (!boostsRes.ok) return empty;
		const boosts = await boostsRes.json();
		if (!Array.isArray(boosts)) return empty;
		const addresses = [];
		const seen = /* @__PURE__ */ new Set();
		for (const row of boosts) {
			if (!row || typeof row !== "object") continue;
			const chain = "chainId" in row ? String(row.chainId) : "";
			const token = "tokenAddress" in row ? String(row.tokenAddress) : "";
			if (chain !== "solana" || token.length < 20 || seen.has(token)) continue;
			seen.add(token);
			addresses.push(token);
			if (addresses.length >= 24) break;
		}
		if (addresses.length === 0) return {
			ok: true,
			pairs: [],
			scanned: 0,
			dropped: 0
		};
		const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(",")}`, {
			signal: AbortSignal.timeout(4500),
			headers: { accept: "application/json" }
		});
		if (!dexRes.ok) return empty;
		const body = await dexRes.json();
		const pairs = body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];
		const best = /* @__PURE__ */ new Map();
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
			if (!prev || liq > prev.liq) best.set(mint, {
				pair,
				venue,
				liq
			});
		}
		const out = [];
		for (const [mint, pick] of best) {
			const pair = pick.pair;
			const created = num(pair.pairCreatedAt);
			const ageMin = created > 0 ? Math.max(0, (Date.now() - created) / 6e4) : 0;
			const symbol = (pair.baseToken?.symbol ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
			const name = (pair.baseToken?.name ?? symbol).replace(/\s+/g, " ").trim().slice(0, 48);
			if (!symbol) continue;
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
				sells1h: num(pair.txns?.h1?.sells)
			});
			if (out.length >= 8) break;
		}
		return {
			ok: true,
			pairs: out,
			scanned: addresses.length,
			dropped
		};
	} catch {
		return empty;
	}
});
//#endregion
export { fetchPublicTape_createServerFn_handler };
