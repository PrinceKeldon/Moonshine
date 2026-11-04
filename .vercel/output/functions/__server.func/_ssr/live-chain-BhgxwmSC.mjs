import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-BYs_ScYe.mjs";
import { r as isSolanaAddress } from "./wallet-QdX2ufqE.mjs";
import { l as SOL_MINT } from "./live-score-D08J72c8.mjs";
// node_modules/.nitro/vite/services/ssr/assets/live-chain-BhgxwmSC.js
var RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
var JUP = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1"];
var TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
async function rpc(method, params) {
	let last = "The chain did not answer.";
	for (const url of RPCS) try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json"
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method,
				params
			}),
			signal: AbortSignal.timeout(8e3)
		});
		if (!res.ok) continue;
		const body = await res.json();
		if (!body || typeof body !== "object") continue;
		if ("error" in body && body.error) {
			last = (typeof body.error === "object" && body.error && "message" in body.error ? String(body.error.message) : "The chain refused the request.").slice(0, 180);
			continue;
		}
		return "result" in body ? body.result : null;
	} catch {
		last = "The chain did not answer.";
	}
	throw new Error(last);
}
function num(value) {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : NaN;
}
function judge(report) {
	const empty = (reason) => ({
		ok: false,
		reportAvailable: false,
		reason,
		mintRevoked: null,
		freezeRevoked: null,
		lpLocked: null,
		top10: null,
		lpLockedPct: null,
		creator: null,
		creatorHistoryAvailable: false,
		creatorTokenCount: null,
		devPriorRugs: null
	});
	if (!report || typeof report !== "object") return empty("RugCheck returned nothing.");
	const row = report;
	const token = row.token && typeof row.token === "object" ? row.token : null;
	if (!token) return empty("RugCheck has no mint record yet.");
	const mintRevoked = "mintAuthority" in token ? token.mintAuthority == null : null;
	const freezeRevoked = "freezeAuthority" in token ? token.freezeAuthority == null : null;
	const creatorValue = row.creator ?? token.creator;
	const creator = typeof creatorValue === "string" && isSolanaAddress(creatorValue) ? creatorValue : null;
	const risks = Array.isArray(row.risks) ? row.risks : [];
	for (const risk of risks) {
		if (!risk || typeof risk !== "object") continue;
		const name = "name" in risk ? String(risk.name) : "risk";
		const level = "level" in risk ? String(risk.level).toLowerCase() : "";
		const lower = name.toLowerCase();
		if (level === "danger" || level === "critical") return {
			...empty(`RugCheck danger: ${name}.`),
			reportAvailable: true,
			mintRevoked,
			freezeRevoked,
			creator
		};
		if (lower.includes("honeypot") || lower.includes("mint authority") || lower.includes("freeze")) return {
			...empty(`RugCheck: ${name}.`),
			reportAvailable: true,
			mintRevoked,
			freezeRevoked,
			creator
		};
	}
	const pcts = [];
	const topHolders = Array.isArray(row.topHolders) ? row.topHolders : [];
	const knownAccounts = row.knownAccounts && typeof row.knownAccounts === "object" ? row.knownAccounts : {};
	if (topHolders.length > 0) for (const holder of topHolders) {
		if (!holder || typeof holder !== "object" || !("pct" in holder)) continue;
		const entry = holder;
		const known = [entry.owner, entry.address].map((address) => typeof address === "string" ? knownAccounts[address] : null).find((account) => account && typeof account === "object");
		const knownType = typeof known?.type === "string" ? known.type.toUpperCase() : "";
		if (knownType === "AMM" || knownType === "LOCKER") continue;
		const pct = num(holder.pct);
		if (Number.isFinite(pct)) pcts.push(pct);
	}
	pcts.sort((a, b) => b - a);
	const usable = pcts[0] !== void 0 && pcts[0] > 35 ? pcts.slice(1) : pcts;
	const top10 = usable.slice(0, 10).reduce((sum, pct) => sum + pct, 0);
	const counted = Math.min(10, usable.length);
	const holderTotal = num(row.totalHolders);
	const holdersComplete = counted >= (Number.isFinite(holderTotal) && holderTotal > 0 ? Math.min(10, holderTotal) : 10);
	const marketLocks = (Array.isArray(row.markets) ? row.markets : []).flatMap((market) => {
		if (!market || typeof market !== "object" || !("lp" in market) || !market.lp || typeof market.lp !== "object") return [];
		const lp = market.lp;
		const pct = num(lp.lpLockedPct);
		const locked = num(lp.lpLocked);
		const total = num(lp.lpTotalSupply);
		const baseUsd = num(lp.baseUSD);
		const quoteUsd = num(lp.quoteUSD);
		const lockedUsd = num(lp.lpLockedUSD);
		const weight = Number.isFinite(baseUsd) && Number.isFinite(quoteUsd) && baseUsd + quoteUsd > 0 ? baseUsd + quoteUsd : Number.isFinite(lockedUsd) && lockedUsd > 0 ? lockedUsd : 1;
		if (Number.isFinite(pct)) return [{
			pct,
			weight
		}];
		if (Number.isFinite(locked) && Number.isFinite(total) && total > 0) return [{
			pct: locked / total * 100,
			weight
		}];
		return [];
	});
	const reportLpPct = num(row.lpLockedPct);
	const lp = Number.isFinite(reportLpPct) ? reportLpPct : marketLocks.length > 0 ? marketLocks.reduce((sum, item) => sum + item.pct * item.weight, 0) / marketLocks.reduce((sum, item) => sum + item.weight, 0) : NaN;
	const lpLockedPct = Number.isFinite(lp) ? lp : null;
	const lpLocked = lpLockedPct !== null ? lpLockedPct >= 80 : null;
	const failures = [];
	if (mintRevoked !== true) failures.push(mintRevoked === false ? "Mint authority is live" : "Mint authority is unknown");
	if (freezeRevoked !== true) failures.push(freezeRevoked === false ? "Freeze authority is live" : "Freeze authority is unknown");
	if (!holdersComplete) failures.push("Top-holder data is incomplete");
	else if (top10 > 20) failures.push(`Top holders control ${top10.toFixed(1)}% (limit 20%)`);
	if (lpLocked !== true) failures.push(lpLockedPct === null ? "LP lock is unknown" : `LP lock is ${lpLockedPct.toFixed(0)}% (need 80%)`);
	if (!creator) failures.push("Creator address is missing");
	const holderNote = holdersComplete ? `top holders ${top10.toFixed(1)}%` : "top-holder data incomplete";
	const lpNote = lpLockedPct === null ? "LP lock unknown" : `LP lock ${lpLockedPct.toFixed(0)}%`;
	const reason = failures.length > 0 ? `${failures.join(". ")}.` : `Mint and freeze authority revoked; ${holderNote}; ${lpNote}. Creator identified.`;
	return {
		ok: failures.length === 0,
		reportAvailable: true,
		reason,
		mintRevoked,
		freezeRevoked,
		lpLocked,
		top10: holdersComplete ? top10 : null,
		lpLockedPct,
		creator,
		creatorHistoryAvailable: false,
		creatorTokenCount: null,
		devPriorRugs: null
	};
}
async function withCreatorHistory(screen) {
	if (!screen.creator) return screen;
	try {
		const url = new URL("https://trader.scorplabs.online/api/public/tools/dev-reputation");
		url.searchParams.set("wallet", screen.creator);
		const res = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(5e3)
		});
		if (!res.ok) return screen;
		const body = await res.json();
		if (!body || typeof body !== "object" || !("found" in body) || body.found !== true) return screen;
		const row = body;
		const tokenCount = num(row.tokens_count);
		const rugCount = num(row.rugged);
		if (!Number.isInteger(tokenCount) || tokenCount < 1 || !Number.isInteger(rugCount) || rugCount < 0) return screen;
		return {
			...screen,
			creatorHistoryAvailable: true,
			creatorTokenCount: tokenCount,
			devPriorRugs: rugCount
		};
	} catch {
		return screen;
	}
}
var screenMint_createServerFn_handler = createServerRpc({
	id: "9bdd83570495a606c75c52654410c30d3765b8a71b83eb441dafa59c5287409f",
	name: "screenMint",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => screenMint.__executeServer(opts));
var screenMint = createServerFn({ method: "POST" }).validator((input) => {
	const mint = input.mint.trim();
	if (!isSolanaAddress(mint)) throw new Error("Bad mint.");
	return {
		mint,
		venue: input.venue === "raydium" ? "raydium" : "pump.fun",
		includeCreatorHistory: input.includeCreatorHistory === true
	};
}).handler(screenMint_createServerFn_handler, async ({ data }) => {
	try {
		const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${data.mint}/report`, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(8e3)
		});
		if (res.status === 429) return {
			...judge(null),
			reason: "RugCheck is rate limiting. Skipped this pass."
		};
		if (!res.ok) return {
			...judge(null),
			reason: "RugCheck did not answer."
		};
		const screen = judge(await res.json());
		return data.includeCreatorHistory ? withCreatorHistory(screen) : screen;
	} catch {
		return {
			...judge(null),
			reason: "RugCheck did not answer."
		};
	}
});
async function quoteOn(host, params) {
	try {
		const res = await fetch(`${host}/quote?${params}`, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(8e3)
		});
		if (!res.ok) return { error: `Jupiter quote failed (${res.status}).` };
		const quote = await res.json();
		if (!quote || typeof quote !== "object") return { error: "Jupiter quote was empty." };
		if ("error" in quote && quote.error) return { error: String(quote.error).slice(0, 160) };
		return { quote };
	} catch {
		return { error: "Jupiter did not quote." };
	}
}
var buildSwap_createServerFn_handler = createServerRpc({
	id: "b844cec9e490ad7e10c5ec7cd3578e30da109cb9b6d16b08c74637a8c5555432",
	name: "buildSwap",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => buildSwap.__executeServer(opts));
var buildSwap = createServerFn({ method: "POST" }).validator((input) => {
	const user = input.user.trim();
	const inputMint = input.inputMint.trim();
	const outputMint = input.outputMint.trim();
	const amount = input.amount.trim();
	const slippageBps = Math.round(input.slippageBps);
	if (!isSolanaAddress(user) || !isSolanaAddress(inputMint) || !isSolanaAddress(outputMint)) throw new Error("Bad address.");
	if (!/^\d+$/.test(amount) || amount === "0" || amount.length > 30) throw new Error("Bad amount.");
	if (slippageBps < 30 || slippageBps > 500) throw new Error("Slippage is out of range.");
	return {
		user,
		inputMint,
		outputMint,
		amount,
		slippageBps
	};
}).handler(buildSwap_createServerFn_handler, async ({ data }) => {
	const params = new URLSearchParams({
		inputMint: data.inputMint,
		outputMint: data.outputMint,
		amount: data.amount,
		slippageBps: String(data.slippageBps)
	});
	let last = "Jupiter did not quote.";
	for (const host of JUP) {
		const quoted = await quoteOn(host, params);
		if ("error" in quoted) {
			last = quoted.error;
			continue;
		}
		const quote = quoted.quote;
		const impact = num(quote.priceImpactPct);
		if (Number.isFinite(impact) && impact > .05) return {
			ok: false,
			tx: null,
			outAmount: null,
			impact,
			error: `Price impact ${(impact * 100).toFixed(1)}% is over 5%.`
		};
		try {
			const res = await fetch(`${host}/swap`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json"
				},
				body: JSON.stringify({
					quoteResponse: quoted.quote,
					userPublicKey: data.user,
					wrapAndUnwrapSol: true,
					dynamicComputeUnitLimit: true
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (!res.ok) {
				last = `Jupiter swap failed (${res.status}).`;
				continue;
			}
			const body = await res.json();
			if (!body || typeof body !== "object") {
				last = "Jupiter swap was empty.";
				continue;
			}
			if ("simulationError" in body && body.simulationError) return {
				ok: false,
				tx: null,
				outAmount: quote.outAmount ?? null,
				impact: Number.isFinite(impact) ? impact : null,
				error: "Jupiter simulation failed."
			};
			const tx = "swapTransaction" in body ? String(body.swapTransaction) : "";
			if (!tx) {
				last = "Jupiter did not return a transaction.";
				continue;
			}
			return {
				ok: true,
				tx,
				outAmount: quote.outAmount ?? null,
				impact: Number.isFinite(impact) ? impact : null,
				error: null
			};
		} catch {
			last = "Jupiter did not build the swap.";
		}
	}
	return {
		ok: false,
		tx: null,
		outAmount: null,
		impact: null,
		error: last
	};
});
var tokenHolding_createServerFn_handler = createServerRpc({
	id: "47caa6a4c74078c749027d978275dc04f3f822091deb09dbb78c900f65d02a31",
	name: "tokenHolding",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => tokenHolding.__executeServer(opts));
var tokenHolding = createServerFn({ method: "POST" }).validator((input) => {
	const owner = input.owner.trim();
	const mint = input.mint.trim();
	if (!isSolanaAddress(owner) || !isSolanaAddress(mint)) throw new Error("Bad address.");
	return {
		owner,
		mint
	};
}).handler(tokenHolding_createServerFn_handler, async ({ data }) => {
	try {
		const filters = [{ mint: data.mint }, ...TOKEN_PROGRAMS.map((programId) => ({ programId }))];
		for (const filter of filters) {
			const result = await rpc("getTokenAccountsByOwner", [
				data.owner,
				filter,
				{ encoding: "jsonParsed" }
			]);
			const value = result && typeof result === "object" && "value" in result && Array.isArray(result.value) ? result.value : [];
			for (const row of value) {
				if (!row || typeof row !== "object" || !("account" in row)) continue;
				const account = row.account;
				if (!account || typeof account !== "object" || !("data" in account)) continue;
				const parsed = account.data && typeof account.data === "object" && "parsed" in account.data ? account.data.parsed : null;
				const info = parsed && typeof parsed === "object" && "info" in parsed && parsed.info && typeof parsed.info === "object" ? parsed.info : null;
				if (!info || info.mint !== data.mint || !info.tokenAmount) continue;
				const raw = String(info.tokenAmount.amount ?? "0");
				const ui = num(info.tokenAmount.uiAmount);
				if (raw !== "0") return {
					ok: true,
					raw,
					ui: Number.isFinite(ui) ? ui : 0,
					error: null
				};
			}
		}
		return {
			ok: true,
			raw: "0",
			ui: 0,
			error: null
		};
	} catch (error) {
		return {
			ok: false,
			raw: "0",
			ui: 0,
			error: error instanceof Error ? error.message : "Balance read failed."
		};
	}
});
var markPrices_createServerFn_handler = createServerRpc({
	id: "170417f8ce0740f3ba0c5618827e32f2b773af9ddff0765a041d6402e1129f41",
	name: "markPrices",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => markPrices.__executeServer(opts));
var markPrices = createServerFn({ method: "POST" }).validator((input) => {
	const mints = input.mints.map((mint) => mint.trim()).filter((mint) => isSolanaAddress(mint)).slice(0, 20);
	return { mints: [.../* @__PURE__ */ new Set([SOL_MINT, ...mints])] };
}).handler(markPrices_createServerFn_handler, async ({ data }) => {
	const prices = {};
	try {
		const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${data.mints.join(",")}`, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(6e3)
		});
		if (!res.ok) return {
			ok: false,
			solUsd: null,
			prices
		};
		const body = await res.json();
		const pairs = body && typeof body === "object" && "pairs" in body && Array.isArray(body.pairs) ? body.pairs : [];
		const liq = /* @__PURE__ */ new Map();
		for (const pair of pairs) {
			if (!pair || typeof pair !== "object") continue;
			const base = "baseToken" in pair && pair.baseToken && typeof pair.baseToken === "object" ? pair.baseToken : null;
			const mint = base && "address" in base ? String(base.address) : "";
			const price = "priceUsd" in pair ? num(pair.priceUsd) : NaN;
			const pool = "liquidity" in pair && pair.liquidity && typeof pair.liquidity === "object" && "usd" in pair.liquidity ? num(pair.liquidity.usd) : 0;
			if (!mint || !Number.isFinite(price)) continue;
			if ((liq.get(mint) ?? -1) > pool) continue;
			liq.set(mint, Number.isFinite(pool) ? pool : 0);
			prices[mint] = price;
		}
		return {
			ok: true,
			solUsd: prices["So11111111111111111111111111111111111111112"] ?? null,
			prices
		};
	} catch {
		return {
			ok: false,
			solUsd: null,
			prices
		};
	}
});
var latestBlockhash_createServerFn_handler = createServerRpc({
	id: "ebfb502f5fe75170e615efb1db080b9eaac1a69207a0acc8bf63af57550dd7f5",
	name: "latestBlockhash",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => latestBlockhash.__executeServer(opts));
var latestBlockhash = createServerFn({ method: "GET" }).handler(latestBlockhash_createServerFn_handler, async () => {
	try {
		const result = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
		const blockhash = result && typeof result === "object" && "blockhash" in result ? String(result.blockhash) : "";
		if (!blockhash) return {
			ok: false,
			blockhash: null,
			error: "No blockhash."
		};
		return {
			ok: true,
			blockhash,
			error: null
		};
	} catch (error) {
		return {
			ok: false,
			blockhash: null,
			error: error instanceof Error ? error.message : "No blockhash."
		};
	}
});
async function statusOf(signature) {
	const status = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
	const value = status && typeof status === "object" && "value" in status && Array.isArray(status.value) ? status.value[0] : null;
	if (!value || typeof value !== "object") return "pending";
	if ("err" in value && value.err) return "err";
	const conf = "confirmationStatus" in value ? String(value.confirmationStatus) : "";
	if (conf === "confirmed" || conf === "finalized") return "ok";
	return "pending";
}
var confirmSig_createServerFn_handler = createServerRpc({
	id: "ab91eb722dd2569fbc33afec2afcf489587017b3e6cd3ccaec1fcbcc356dfe06",
	name: "confirmSig",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => confirmSig.__executeServer(opts));
var confirmSig = createServerFn({ method: "POST" }).validator((input) => {
	const signature = input.signature.trim();
	if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(signature)) throw new Error("Bad signature.");
	return { signature };
}).handler(confirmSig_createServerFn_handler, async ({ data }) => {
	try {
		for (let i = 0; i < 6; i += 1) {
			const state = await statusOf(data.signature);
			if (state === "ok") return {
				ok: true,
				signature: data.signature,
				error: null
			};
			if (state === "err") return {
				ok: false,
				signature: data.signature,
				error: "The chain rejected the transaction."
			};
			await new Promise((resolve) => setTimeout(resolve, 800));
		}
		return {
			ok: true,
			signature: data.signature,
			error: null
		};
	} catch (error) {
		return {
			ok: false,
			signature: data.signature,
			error: error instanceof Error ? error.message : "Confirm failed."
		};
	}
});
var sendRaw_createServerFn_handler = createServerRpc({
	id: "fa8dcb9292572793e25f4bcdc29fd37cc2f90ac65fd625f41294f8f87bec147b",
	name: "sendRaw",
	filename: "src/lib/desk/live-chain.ts"
}, (opts) => sendRaw.__executeServer(opts));
var sendRaw = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input.raw.trim();
	if (raw.length < 32 || raw.length > 8e3) throw new Error("Bad transaction.");
	return { raw };
}).handler(sendRaw_createServerFn_handler, async ({ data }) => {
	try {
		const sig = await rpc("sendTransaction", [data.raw, {
			encoding: "base64",
			skipPreflight: false,
			preflightCommitment: "confirmed",
			maxRetries: 2
		}]);
		if (typeof sig !== "string" || !sig) return {
			ok: false,
			signature: null,
			error: "The chain did not take the transaction."
		};
		for (let i = 0; i < 6; i += 1) {
			const state = await statusOf(sig);
			if (state === "ok") return {
				ok: true,
				signature: sig,
				error: null
			};
			if (state === "err") return {
				ok: false,
				signature: sig,
				error: "The chain rejected the swap."
			};
			await new Promise((resolve) => setTimeout(resolve, 800));
		}
		return {
			ok: true,
			signature: sig,
			error: null
		};
	} catch (error) {
		return {
			ok: false,
			signature: null,
			error: error instanceof Error ? error.message.slice(0, 180) : "Send failed."
		};
	}
});
export { buildSwap_createServerFn_handler, confirmSig_createServerFn_handler, latestBlockhash_createServerFn_handler, markPrices_createServerFn_handler, screenMint_createServerFn_handler, sendRaw_createServerFn_handler, tokenHolding_createServerFn_handler };
