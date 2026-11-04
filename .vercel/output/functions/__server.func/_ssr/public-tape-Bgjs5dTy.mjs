import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-BYs_ScYe.mjs";
import { r as isSolanaAddress } from "./wallet-QdX2ufqE.mjs";
// node_modules/.nitro/vite/services/ssr/assets/public-tape-Bgjs5dTy.js
var PUMP_FUN = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
var RAYDIUM_AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
var BUFFER_CAP = 48;
var DEDUPE_MS = 6e5;
var buffer = [];
var seenMints = /* @__PURE__ */ new Map();
var ws = null;
var connected = false;
var lastError = null;
var hits = 0;
var started = false;
var pingTimer = null;
var reconnectTimer = null;
function apiKey() {
	return process.env.HELIUS_API_KEY?.trim() || void 0;
}
function pushHit(mint, venue, signature) {
	if (!mint || mint.length < 32) return;
	const now = Date.now();
	const prior = seenMints.get(mint);
	if (prior && now - prior < DEDUPE_MS) return;
	seenMints.set(mint, now);
	if (seenMints.size > 400) {
		for (const [m, t] of seenMints) if (now - t > DEDUPE_MS) seenMints.delete(m);
	}
	const row = {
		mint,
		venue,
		signature,
		seenAt: now
	};
	buffer.unshift(row);
	if (buffer.length > BUFFER_CAP) buffer.length = BUFFER_CAP;
	hits += 1;
}
function pubkeyOf(key) {
	if (typeof key === "string") return key;
	if (key && typeof key === "object" && "pubkey" in key) {
		const p = key.pubkey;
		return typeof p === "string" ? p : null;
	}
	return null;
}
function extractFromNotification(payload) {
	if (!payload || typeof payload !== "object") return;
	const root = payload;
	const result = root.params && typeof root.params === "object" && "result" in root.params ? root.params.result : root.result;
	if (!result || typeof result !== "object") return;
	const r = result;
	const signature = typeof r.signature === "string" ? r.signature : "";
	const tx = r.transaction;
	if (!tx) return;
	if (tx.meta?.err) return;
	const logs = tx.meta?.logMessages ?? [];
	const keys = (tx.transaction?.message?.accountKeys ?? tx.message?.accountKeys ?? []).map(pubkeyOf).filter((k) => Boolean(k));
	const isPumpInit = logs.some((l) => typeof l === "string" && (l.includes("Instruction: InitializeMint2") || l.includes("Instruction: Create") || l.includes("InitializeMint")));
	const touchesPump = keys.includes(PUMP_FUN) || logs.some((l) => typeof l === "string" && l.includes(PUMP_FUN));
	const touchesRay = keys.includes(RAYDIUM_AMM_V4) || logs.some((l) => typeof l === "string" && l.includes("raydium"));
	if (touchesPump && isPumpInit && keys.length >= 2) {
		const mint = keys[1];
		if (mint && mint !== PUMP_FUN) pushHit(mint, "pump.fun", signature);
		return;
	}
	if (touchesRay && keys.length >= 3) {
		const SYSTEM = "11111111111111111111111111111111";
		const TOKEN_PROG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
		for (const k of keys) {
			if (!k) continue;
			if (k === RAYDIUM_AMM_V4 || k === SYSTEM || k === TOKEN_PROG || k === PUMP_FUN) continue;
			if (k.endsWith("1111111111111111111111111111111")) continue;
			pushHit(k, "raydium", signature);
			break;
		}
	}
}
function subscribe(socket) {
	const commonOpts = {
		commitment: "confirmed",
		encoding: "jsonParsed",
		transactionDetails: "full",
		maxSupportedTransactionVersion: 1
	};
	socket.send(JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "transactionSubscribe",
		params: [{
			failed: false,
			accountInclude: [PUMP_FUN]
		}, commonOpts]
	}));
	socket.send(JSON.stringify({
		jsonrpc: "2.0",
		id: 2,
		method: "transactionSubscribe",
		params: [{
			failed: false,
			accountInclude: [RAYDIUM_AMM_V4]
		}, commonOpts]
	}));
}
function scheduleReconnect() {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		started = false;
		ensureHeliusListener();
	}, 5e3);
}
/** Start the WebSocket once per process. Safe to call repeatedly. */
function ensureHeliusListener() {
	const key = apiKey();
	if (!key) return {
		enabled: false,
		connected: false,
		lastError: null,
		hits,
		bufferSize: buffer.length
	};
	if (started && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return status();
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
				if (socket.readyState === WebSocket.OPEN) try {
					socket.send(JSON.stringify({
						jsonrpc: "2.0",
						method: "ping",
						id: Date.now()
					}));
				} catch {}
			}, 2e4);
		});
		socket.addEventListener("message", (event) => {
			try {
				extractFromNotification(typeof event.data === "string" ? JSON.parse(event.data) : event.data);
			} catch {}
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
function status() {
	return {
		enabled: Boolean(apiKey()),
		connected,
		lastError,
		hits,
		bufferSize: buffer.length
	};
}
/** Drain recent geyser hits (does not clear; callers dedupe by mint). */
function recentGeyserHits(limit = 16) {
	ensureHeliusListener();
	return buffer.slice(0, limit);
}
function geyserMintAddresses(limit = 16) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const hit of recentGeyserHits(limit * 2)) {
		if (seen.has(hit.mint)) continue;
		seen.add(hit.mint);
		out.push(hit.mint);
		if (out.length >= limit) break;
	}
	return out;
}
var PUMP = /* @__PURE__ */ new Set(["pumpfun", "pumpswap"]);
var RAY = /* @__PURE__ */ new Set([
	"raydium",
	"raydium-clmm",
	"raydium-cp",
	"raydium-cpmm"
]);
/** DexScreener often 403s bare server fetches without a browser-like UA. */
var DS_HEADERS = {
	accept: "application/json",
	"user-agent": "Mozilla/5.0 (compatible; MoonshineDesk/1.0; +https://github.com/PrinceKeldon/Moonshine)"
};
function venueOf(dexId) {
	const id = dexId.toLowerCase();
	if (PUMP.has(id)) return "pump.fun";
	if (RAY.has(id)) return "raydium";
	return null;
}
var EXPLICIT = /\b(sex|nude|porn|xxx|horny|slut|cock|dick|pussy|boob|tits|fuck|nsfw|milf|onlyfans)\b/i;
function num(value) {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : 0;
}
function collectAddresses(payload, seen, addresses, limit) {
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
async function fetchJson(url, ms = 5e3) {
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(ms),
			headers: DS_HEADERS
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}
var fetchPublicTape_createServerFn_handler = createServerRpc({
	id: "1c636824bf6aa89498ed10efb134f011b2de42d34dcbdd2c82d81397403c4021",
	name: "fetchPublicTape",
	filename: "src/lib/desk/public-tape.ts"
}, (opts) => fetchPublicTape.__executeServer(opts));
var fetchPublicTape = createServerFn({ method: "GET" }).handler(fetchPublicTape_createServerFn_handler, async () => {
	try {
		ensureHeliusListener();
		const [boosts, profiles] = await Promise.all([fetchJson("https://api.dexscreener.com/token-boosts/latest/v1"), fetchJson("https://api.dexscreener.com/token-profiles/latest/v1")]);
		const addresses = [];
		const seen = /* @__PURE__ */ new Set();
		const limit = 40;
		for (const mint of geyserMintAddresses(12)) {
			if (addresses.length >= limit) break;
			if (seen.has(mint)) continue;
			seen.add(mint);
			addresses.push(mint);
		}
		collectAddresses(boosts, seen, addresses, limit);
		collectAddresses(profiles, seen, addresses, limit);
		if (addresses.length === 0) return {
			ok: true,
			pairs: [],
			scanned: 0,
			dropped: 0
		};
		const pairs = [];
		for (let i = 0; i < addresses.length; i += 15) {
			const body = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${addresses.slice(i, i + 15).join(",")}`, 6e3);
			if (body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs)) pairs.push(...body.pairs);
		}
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
			const vol = num(pair.volume?.h1);
			const prev = best.get(mint);
			if (!prev || vol > prev.vol || vol === prev.vol && liq > prev.liq) best.set(mint, {
				pair,
				venue,
				liq,
				vol
			});
		}
		const ranked = [...best.entries()].sort((a, b) => b[1].vol - a[1].vol);
		const out = [];
		for (const [mint, pick] of ranked) {
			const pair = pick.pair;
			const created = num(pair.pairCreatedAt);
			const ageMin = created > 0 ? Math.max(0, (Date.now() - created) / 6e4) : 0;
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
				sells1h: num(pair.txns?.h1?.sells)
			});
			if (out.length >= 14) break;
		}
		const stream = status();
		return {
			ok: true,
			pairs: out,
			scanned: addresses.length + (stream.enabled && stream.connected ? stream.bufferSize : 0),
			dropped
		};
	} catch {
		return {
			ok: false,
			pairs: [],
			scanned: 0,
			dropped: 0
		};
	}
});
var fetchMintPair_createServerFn_handler = createServerRpc({
	id: "95b83212ba7cd0bdc4228835993334a11869eea06f17da257208de2c40d33e68",
	name: "fetchMintPair",
	filename: "src/lib/desk/public-tape.ts"
}, (opts) => fetchMintPair.__executeServer(opts));
var fetchMintPair = createServerFn({ method: "POST" }).validator((input) => {
	const mint = input.mint.trim();
	if (!isSolanaAddress(mint)) throw new Error("Enter a valid Solana token mint.");
	return { mint };
}).handler(fetchMintPair_createServerFn_handler, async ({ data }) => {
	let body;
	try {
		const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(data.mint)}`, {
			headers: DS_HEADERS,
			signal: AbortSignal.timeout(7e3)
		});
		if (!response.ok) return {
			ok: false,
			pair: null,
			error: `DexScreener returned ${response.status}.`
		};
		body = await response.json();
	} catch (caught) {
		return {
			ok: false,
			pair: null,
			error: `DexScreener request failed: ${(caught instanceof Error ? caught.message : "Request failed.").slice(0, 120)}`
		};
	}
	if (!body || typeof body !== "object" || !("pairs" in body) || !Array.isArray(body.pairs)) return {
		ok: false,
		pair: null,
		error: "DexScreener did not return token pairs."
	};
	const matching = body.pairs.flatMap((raw) => {
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
				ageMin: created > 0 ? Math.max(0, (Date.now() - created) / 6e4) : 0,
				buys1h: num(raw.txns?.h1?.buys),
				sells1h: num(raw.txns?.h1?.sells)
			},
			volume: num(raw.volume?.h1),
			liquidity: num(raw.liquidity?.usd)
		}];
	});
	matching.sort((a, b) => b.volume - a.volume || b.liquidity - a.liquidity);
	const pair = matching[0]?.pair;
	return pair ? {
		ok: true,
		pair,
		error: null
	} : {
		ok: false,
		pair: null,
		error: "No supported Solana Pump.fun or Raydium pair was found for this mint."
	};
});
var fetchHeliusStreamStatus_createServerFn_handler = createServerRpc({
	id: "9015dfc2b42a77dfa0e991bd53867dd5da5cc59e5ba3b0308534bd7af6983b5f",
	name: "fetchHeliusStreamStatus",
	filename: "src/lib/desk/public-tape.ts"
}, (opts) => fetchHeliusStreamStatus.__executeServer(opts));
var fetchHeliusStreamStatus = createServerFn({ method: "GET" }).handler(fetchHeliusStreamStatus_createServerFn_handler, async () => {
	ensureHeliusListener();
	return status();
});
export { fetchHeliusStreamStatus_createServerFn_handler, fetchMintPair_createServerFn_handler, fetchPublicTape_createServerFn_handler };
