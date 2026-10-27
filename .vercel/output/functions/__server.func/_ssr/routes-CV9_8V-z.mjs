import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as ScrollText, c as Play, d as Funnel, f as Crosshair, i as Shield, l as Pause, m as Check, o as Scale, p as Copy, r as Sunrise, s as Radar, t as X, u as Moon } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { a as Tooltip, i as ResponsiveContainer, n as YAxis, r as Area, t as AreaChart } from "../_libs/recharts+[...].mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CV9_8V-z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function money(n) {
	const digits = Math.abs(n) >= 1e3 ? 0 : 2;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(n);
}
function compactUsd(n) {
	const abs = Math.abs(n);
	const sign = n < 0 ? "−" : "";
	if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
	if (abs >= 1e4) return `${sign}$${Math.round(abs / 1e3)}k`;
	if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
	return `${sign}$${Math.round(abs)}`;
}
function pct(n, digits = 1) {
	const value = n * 100;
	return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;
}
function deskClock(ms) {
	const total = Math.max(0, Math.floor(ms / 1e3));
	return [
		Math.floor(total / 3600),
		Math.floor(total % 3600 / 60),
		total % 60
	].map((part) => String(part).padStart(2, "0")).join(":");
}
function pxPrice(n) {
	if (!Number.isFinite(n)) return "—";
	if (n >= 1) return `$${n.toFixed(2)}`;
	if (n >= .01) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(6)}`;
}
var START_CASH = 1e4;
var MINUTE = 6e4;
var NIGHT = 480 * MINUTE;
var MAX_PCT = .08;
var TRAIL_GIVE = .06;
var REVENGE_MS = 30 * NIGHT;
var NAMES = [
	["SOOT", "Soot"],
	["BRAMBLE", "Bramble"],
	["PEBBLE", "Pebble"],
	["LANTERN", "Lantern"],
	["THISTLE", "Thistle"],
	["MARSH", "Marsh"],
	["CINDER", "Cinder"],
	["PIPPIN", "Pippin"],
	["OCHRE", "Ochre"],
	["FIDDLE", "Fiddle"],
	["WICK", "Wick"],
	["GULL", "Gull"],
	["NETTLE", "Nettle"],
	["QUILL", "Quill"],
	["DRIFT", "Driftwood"],
	["HUSK", "Husk"],
	["MOTH", "Moth"],
	["SALT", "Saltpan"],
	["YARROW", "Yarrow"],
	["KELP", "Kelp"],
	["FLINT", "Flint"],
	["BORAGE", "Borage"],
	["RIND", "Rind"],
	["CLOVE", "Clove"],
	["TAWNY", "Tawny"],
	["PLOVER", "Plover"],
	["BRACK", "Brack"],
	["COPSE", "Copse"],
	["SEDGE", "Sedge"],
	["LOAM", "Loam"],
	["BRINE", "Brine"],
	["KINDLING", "Kindling"],
	["VETCH", "Vetch"],
	["ROWAN", "Rowan"],
	["GRIT", "Grit"],
	["ALDER", "Alder"],
	["FENNEL", "Fennel"],
	["COBB", "Cobb"],
	["LARK", "Lark"],
	["SORREL", "Sorrel"],
	["WOLD", "Wold"],
	["CHERT", "Chert"],
	["BRIAR", "Briar"],
	["DULSE", "Dulse"],
	["HAW", "Hawthorn"],
	["SLATE", "Slate"],
	["REED", "Reed"],
	["TOR", "Tor"]
];
var ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var AGENT_META = [
	{
		id: "scout",
		name: "Scout",
		duty: "Pump.fun and Raydium, as they print"
	},
	{
		id: "filter",
		name: "Filter",
		duty: "Five gates. One miss ends it"
	},
	{
		id: "analyst",
		name: "Analyst",
		duty: "Score 0–1. Under 0.60 is no"
	},
	{
		id: "executor",
		name: "Executor",
		duty: "Cleared names only. Max 8%"
	},
	{
		id: "risk",
		name: "Risk",
		duty: "−6% hard. Trail only after +12%"
	},
	{
		id: "logger",
		name: "Logger",
		duty: "Every fill and every rejection"
	}
];
function emptyKillBy() {
	return {
		venue: 0,
		unverified: 0,
		mint: 0,
		lp: 0,
		holders: 0,
		volume: 0,
		dev: 0
	};
}
function emptyStats() {
	return {
		scanned: 0,
		killed: 0,
		scored: 0,
		scoreRejected: 0,
		buys: 0,
		skips: 0,
		stops: 0,
		trails: 0,
		revengeBlocks: 0,
		addBlocks: 0,
		killBy: emptyKillBy()
	};
}
function idleAgents() {
	return {
		scout: {
			last: "Watching Pump.fun and Raydium.",
			tone: "idle"
		},
		filter: {
			last: "Nothing to kill yet.",
			tone: "idle"
		},
		analyst: {
			last: "Waiting on a survivor.",
			tone: "idle"
		},
		executor: {
			last: "Flat. No order without a full pass.",
			tone: "idle"
		},
		risk: {
			last: "Hard stop −6%. Trail stays off until +12%. Averaging down is not wired.",
			tone: "idle"
		},
		logger: {
			last: "The book is open. Reasons will land here.",
			tone: "idle"
		}
	};
}
function mulberry(seed) {
	let t = seed + 1831565813 | 0;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return {
		value: ((t ^ t >>> 14) >>> 0) / 4294967296,
		seed: t >>> 0
	};
}
function wallet(rand) {
	let out = "";
	for (let i = 0; i < 6; i += 1) out += ALPH[Math.floor(rand() * 58)] ?? "K";
	return out;
}
function cents(n) {
	return Math.round(n * 100) / 100;
}
function clamp01(n) {
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}
function createDesk(seed = 1262830924) {
	return {
		warmed: false,
		running: true,
		overnight: false,
		heldRun: false,
		nightTarget: NIGHT,
		recapFrom: 0,
		recapOpen: false,
		recap: null,
		armOpen: false,
		mode: "paper",
		deskTime: 0,
		rng: seed >>> 0,
		seq: 0,
		cash: START_CASH,
		startCash: START_CASH,
		opens: [],
		closed: [],
		logs: [],
		decisions: [],
		equity: [{
			t: 0,
			equity: START_CASH
		}],
		tape: [],
		inbox: [],
		seenMints: [],
		rugDevs: [],
		reissue: [],
		revengeUntil: {},
		agents: idleAgents(),
		stats: emptyStats(),
		breaches: [],
		publicTape: "idle",
		tapeNote: "Public tape has not reported yet. Indexed launches still run."
	};
}
function copyState(input) {
	return {
		...input,
		opens: input.opens.map((row) => ({
			...row,
			gates: { ...row.gates },
			template: { ...row.template }
		})),
		closed: input.closed.slice(),
		logs: input.logs.slice(),
		decisions: input.decisions.slice(),
		equity: input.equity.slice(),
		tape: input.tape.slice(),
		inbox: input.inbox.slice(),
		seenMints: input.seenMints,
		rugDevs: input.rugDevs.slice(),
		reissue: input.reissue.slice(),
		revengeUntil: { ...input.revengeUntil },
		agents: {
			scout: { ...input.agents.scout },
			filter: { ...input.agents.filter },
			analyst: { ...input.agents.analyst },
			executor: { ...input.agents.executor },
			risk: { ...input.agents.risk },
			logger: { ...input.agents.logger }
		},
		stats: {
			...input.stats,
			killBy: { ...input.stats.killBy }
		},
		breaches: input.breaches.slice(),
		recap: input.recap
	};
}
function say(s, agent, kind, symbol, reason, tone) {
	s.seq += 1;
	const row = {
		id: `L${s.seq}`,
		t: s.deskTime,
		agent,
		symbol,
		kind,
		reason
	};
	s.logs.push(row);
	if (s.logs.length > 180) s.logs.splice(0, s.logs.length - 180);
	s.agents[agent] = {
		last: reason,
		tone
	};
}
function decide(s, symbol, mint, outcome, reason) {
	s.decisions.push({
		t: s.deskTime,
		symbol,
		mint,
		outcome,
		reason
	});
	if (s.decisions.length > 3e3) s.decisions.splice(0, s.decisions.length - 3e3);
}
function rememberTape(s, pair, outcome, reason, score) {
	const row = {
		id: pair.uid,
		t: s.deskTime,
		symbol: pair.symbol,
		venue: pair.venue,
		source: pair.source,
		volume1hUsd: pair.volume1hUsd,
		outcome,
		reason,
		score
	};
	s.tape.unshift(row);
	if (s.tape.length > 24) s.tape.pop();
}
function equityOf(s) {
	const marked = s.opens.reduce((sum, row) => sum + row.qty * row.price, 0);
	return s.cash + marked;
}
function gauss(rand) {
	const u = Math.max(1e-9, rand());
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function forgePair(s, rand) {
	if (s.opens.length > 0 && rand() < .035) {
		const open = s.opens[Math.floor(rand() * s.opens.length)];
		return {
			...open.template,
			uid: `add${s.deskTime}-${open.mint}`,
			priceUsd: open.price
		};
	}
	if (s.reissue.length > 0 && rand() < .5) {
		const prior = s.reissue.shift();
		if (prior) return {
			...prior,
			uid: `re${s.deskTime}-${prior.mint}`
		};
	}
	const tierRoll = rand();
	const tier = tierRoll < .82 ? "junk" : tierRoll < .975 ? "mid" : "clean";
	const venue = rand() < .62 ? "pump.fun" : "raydium";
	const named = NAMES[Math.floor(rand() * NAMES.length)] ?? NAMES[0];
	const base = named[0];
	const name = named[1];
	const used = /* @__PURE__ */ new Set([...s.opens.map((row) => row.symbol), ...s.closed.map((row) => row.symbol)]);
	let symbol = base;
	let suffix = 2;
	while (used.has(symbol)) {
		symbol = `${base}${suffix}`;
		suffix += 1;
	}
	const mint = `idx${Math.floor(rand() * 1e9).toString(36)}${symbol}`;
	let mintRevoked = true;
	let lpLocked = true;
	let top10 = 8;
	let volume = 12e4;
	let liquidity = 8e4;
	let ageMin = 40;
	let buys = 400;
	let sells = 280;
	let prior = 0;
	if (tier === "junk") {
		mintRevoked = rand() < .45;
		lpLocked = rand() < .4;
		top10 = rand() < .58 ? 22 + rand() * 48 : 6 + rand() * 13;
		volume = rand() < .74 ? 1200 + rand() * 4e4 : 5e4 + rand() * 9e4;
		liquidity = 1800 + rand() * 28e3;
		ageMin = rand() * 30;
		buys = Math.floor(rand() * 90);
		sells = Math.floor(20 + rand() * 140);
		prior = rand() < .38 ? 1 + Math.floor(rand() * 4) : 0;
	} else if (tier === "mid") {
		mintRevoked = rand() < .78;
		lpLocked = rand() < .72;
		top10 = 9 + rand() * 16;
		volume = 28e3 + rand() * 18e4;
		liquidity = 18e3 + rand() * 8e4;
		ageMin = 10 + rand() * 120;
		buys = 90 + Math.floor(rand() * 320);
		sells = 80 + Math.floor(rand() * 340);
		prior = rand() < .2 ? 1 : 0;
	} else {
		mintRevoked = rand() < .94;
		lpLocked = rand() < .92;
		top10 = 3 + rand() * 11;
		volume = 9e4 + rand() * 82e4;
		liquidity = 6e4 + rand() * 28e4;
		ageMin = 20 + rand() * 150;
		buys = 240 + Math.floor(rand() * 900);
		sells = 90 + Math.floor(rand() * 360);
		prior = rand() < .06 ? 1 : 0;
	}
	let devWallet;
	if (prior > 0 && s.rugDevs.length > 0 && rand() < .55) {
		devWallet = s.rugDevs[Math.floor(rand() * s.rugDevs.length)];
		prior = Math.max(prior, 1);
	} else {
		devWallet = wallet(rand);
		if (prior > 0) s.rugDevs.push(devWallet);
	}
	if (prior === 0 && s.rugDevs.length > 0 && rand() < .07) {
		devWallet = s.rugDevs[Math.floor(rand() * s.rugDevs.length)];
		prior = 1 + Math.floor(rand() * 3);
	}
	if (s.rugDevs.length > 40) s.rugDevs.splice(0, s.rugDevs.length - 40);
	return {
		uid: `p${s.deskTime}-${mint}`,
		mint,
		symbol,
		name,
		venue,
		priceUsd: 2e-5 + rand() * .04,
		volume1hUsd: volume,
		liquidityUsd: liquidity,
		mcapUsd: liquidity * (3 + rand() * 9),
		ageMin,
		buys1h: buys,
		sells1h: sells,
		mintRevoked,
		lpLocked,
		top10Pct: top10,
		devWallet,
		devPriorRugs: prior,
		source: "index"
	};
}
function filterPair(pair) {
	if (pair.venue !== "pump.fun" && pair.venue !== "raydium") return {
		ok: false,
		code: "venue",
		reason: "Venue is outside Pump.fun and Raydium. Rejected."
	};
	if (pair.mintRevoked === null || pair.lpLocked === null || pair.top10Pct === null || pair.devWallet === null || pair.devPriorRugs === null) return {
		ok: false,
		code: "unverified",
		reason: "No gate attestation on this public print. Mint authority, LP lock, holder concentration, and dev history are unproven. Rejected."
	};
	if (!pair.mintRevoked) return {
		ok: false,
		code: "mint",
		reason: "Mint authority is still live. Rejected."
	};
	if (!pair.lpLocked) return {
		ok: false,
		code: "lp",
		reason: "LP is not locked. Rejected."
	};
	if (pair.top10Pct > 20) return {
		ok: false,
		code: "holders",
		reason: `Top 10 holders control ${pair.top10Pct.toFixed(1)}% (limit 20%). Rejected.`
	};
	if (pair.volume1hUsd < 5e4) return {
		ok: false,
		code: "volume",
		reason: `1h volume is ${compactUsd(pair.volume1hUsd)} (under $50,000). Rejected.`
	};
	if (pair.devPriorRugs > 0) {
		const noun = pair.devPriorRugs === 1 ? "rug" : "rugs";
		return {
			ok: false,
			code: "dev",
			reason: `Dev ${pair.devWallet} is connected to ${pair.devPriorRugs} prior ${noun}. Rejected.`
		};
	}
	return {
		ok: true,
		reason: `All gates clear. Mint revoked, LP locked, top 10 at ${pair.top10Pct.toFixed(1)}%, 1h volume ${compactUsd(pair.volume1hUsd)}, dev ${pair.devWallet} clean.`
	};
}
function analyze(pair) {
	const volScore = clamp01((Math.log10(Math.max(pair.volume1hUsd, 1)) - 4.9) / .95);
	const liqScore = clamp01((Math.log10(Math.max(pair.liquidityUsd, 1)) - 4.45) / .95);
	const holderScore = clamp01((16 - (pair.top10Pct ?? 20)) / 12);
	const ageScore = pair.ageMin < 6 ? .2 : pair.ageMin < 15 ? .5 : pair.ageMin < 180 ? .9 : .62;
	const flowScore = clamp01(.5 + (pair.buys1h - pair.sells1h) / Math.max(1, pair.buys1h + pair.sells1h) * .9);
	const raw = .2 * volScore + .24 * liqScore + .18 * holderScore + .18 * ageScore + .2 * flowScore;
	const score = Math.round(clamp01(raw) * 100) / 100;
	return {
		score,
		reason: `Score ${score.toFixed(2)}. Liquidity ${liqScore.toFixed(2)}, volume ${volScore.toFixed(2)}, holders ${holderScore.toFixed(2)}, age ${ageScore.toFixed(2)}, flow ${flowScore.toFixed(2)}. Line is 0.60.`
	};
}
function runPipeline(s, pair) {
	s.stats.scanned += 1;
	const where = pair.source === "public" ? "public tape" : "gate index";
	say(s, "scout", "scan", pair.symbol, `Saw ${pair.symbol} on ${pair.venue} via ${where}. 1h volume ${compactUsd(pair.volume1hUsd)}, liq ${compactUsd(pair.liquidityUsd)}. Handing to Filter.`, "work");
	const gated = filterPair(pair);
	if (!gated.ok) {
		s.stats.killed += 1;
		s.stats.killBy[gated.code] += 1;
		say(s, "filter", "kill", pair.symbol, gated.reason, "kill");
		const recorded = `${pair.symbol} rejected. ${gated.reason}`;
		say(s, "logger", "note", pair.symbol, `Logged rejection. ${recorded}`, "work");
		decide(s, pair.symbol, pair.mint, "kill", gated.reason);
		rememberTape(s, pair, "kill", gated.reason, null);
		return;
	}
	say(s, "filter", "pass", pair.symbol, `${gated.reason} Handing to Analyst.`, "pass");
	const view = analyze(pair);
	s.stats.scored += 1;
	if (view.score < .6) {
		s.stats.scoreRejected += 1;
		const reason = `No trade. ${view.reason} Under 0.60.`;
		say(s, "analyst", "reject", pair.symbol, reason, "kill");
		say(s, "logger", "note", pair.symbol, `Logged rejection. ${pair.symbol} scored ${view.score.toFixed(2)}. No trade.`, "work");
		decide(s, pair.symbol, pair.mint, "reject", reason);
		rememberTape(s, pair, "reject", reason, view.score);
		return;
	}
	say(s, "analyst", "score", pair.symbol, `${view.reason} Cleared. Handing to Executor.`, "pass");
	if (s.opens.find((row) => row.mint === pair.mint)) {
		s.stats.skips += 1;
		s.stats.addBlocks += 1;
		const reason = `No trade. ${pair.symbol} is already on the book. Adding would average. Refused.`;
		say(s, "executor", "skip", pair.symbol, reason, "kill");
		say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
		decide(s, pair.symbol, pair.mint, "skip", reason);
		rememberTape(s, pair, "skip", reason, view.score);
		return;
	}
	const lock = s.revengeUntil[pair.mint];
	if (lock !== void 0 && s.deskTime < lock) {
		s.stats.skips += 1;
		s.stats.revengeBlocks += 1;
		const reason = `No trade. Revenge lock on ${pair.symbol} for the rest of this book. The last exit lost money.`;
		say(s, "executor", "skip", pair.symbol, reason, "kill");
		say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
		decide(s, pair.symbol, pair.mint, "skip", reason);
		rememberTape(s, pair, "skip", reason, view.score);
		return;
	}
	if (s.opens.length >= 4) {
		s.stats.skips += 1;
		const reason = `No trade. 4 names is the book limit. Unused capital stays unused.`;
		say(s, "executor", "skip", pair.symbol, reason, "kill");
		say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
		decide(s, pair.symbol, pair.mint, "skip", reason);
		rememberTape(s, pair, "skip", reason, view.score);
		return;
	}
	const entryEquity = equityOf(s);
	const hardCap = entryEquity * MAX_PCT;
	const target = entryEquity * (view.score >= .84 ? MAX_PCT : view.score >= .74 ? .06 : .04);
	const affordable = s.cash / 1.003;
	let size = Math.min(hardCap, target, affordable);
	size = Math.floor(size * 100) / 100;
	if (size > hardCap) size = Math.floor(hardCap * 100) / 100;
	if (!(size >= 25) || size > s.cash) {
		s.stats.skips += 1;
		const reason = `No trade. Cash cannot fund a ticket inside the 8% cap (cap ${money(hardCap)}, cash ${money(s.cash)}).`;
		say(s, "executor", "skip", pair.symbol, reason, "kill");
		say(s, "logger", "note", pair.symbol, `Logged skip. ${reason}`, "work");
		decide(s, pair.symbol, pair.mint, "skip", reason);
		rememberTape(s, pair, "skip", reason, view.score);
		return;
	}
	const sizePct = size / entryEquity;
	if (sizePct > .0800001) {
		s.breaches.push(`${pair.symbol} sizing breached 8% (${(sizePct * 100).toFixed(3)}%).`);
		return;
	}
	const cost = cents(size * 1.003);
	s.cash = cents(s.cash - cost);
	const gates = {
		mintRevoked: pair.mintRevoked === true,
		lpLocked: pair.lpLocked === true,
		top10Pct: pair.top10Pct ?? 100,
		volume1hUsd: pair.volume1hUsd,
		devPriorRugs: pair.devPriorRugs ?? 99,
		devWallet: pair.devWallet ?? "unknown"
	};
	const entryReason = `Bought ${money(size)} — ${(sizePct * 100).toFixed(2)}% of ${money(entryEquity)}. Hard cap is 8% (${money(hardCap)}) and was not crossed. ${gated.reason} ${view.reason}`;
	s.seq += 1;
	const fill = {
		id: `F${s.seq}`,
		mint: pair.mint,
		symbol: pair.symbol,
		name: pair.name,
		venue: pair.venue,
		source: pair.source,
		entryPrice: pair.priceUsd,
		price: pair.priceUsd,
		sizeUsd: size,
		sizePct,
		qty: size / pair.priceUsd,
		openedAt: s.deskTime,
		score: view.score,
		entryEquity,
		peakPnlPct: 0,
		trailArmed: false,
		trailStopPct: null,
		gates,
		entryReason,
		exitReason: null,
		exitKind: null,
		status: "open",
		exitPrice: null,
		closedAt: null,
		pnlUsd: null,
		pnlPct: null,
		template: { ...pair }
	};
	s.opens.push(fill);
	s.stats.buys += 1;
	say(s, "executor", "buy", pair.symbol, entryReason, "pass");
	const riskNote = `Risk armed on ${pair.symbol}. Hard stop −6% from entry. Trail stays off until +12%, then gives back 6 points from the peak. No adds.`;
	say(s, "risk", "note", pair.symbol, riskNote, "work");
	say(s, "logger", "note", pair.symbol, `Logged entry. ${entryReason}`, "pass");
	decide(s, pair.symbol, pair.mint, "buy", entryReason);
	rememberTape(s, pair, "buy", entryReason, view.score);
}
function closePosition(s, pos, kind, pnl, reason) {
	const proceeds = cents(pos.qty * pos.price * .997);
	const pnlUsd = cents(proceeds - pos.sizeUsd);
	s.cash = cents(s.cash + proceeds);
	const closed = {
		...pos,
		status: "closed",
		exitKind: kind,
		exitReason: reason,
		exitPrice: pos.price,
		closedAt: s.deskTime,
		pnlUsd,
		pnlPct: pnl
	};
	s.closed.push(closed);
	if (kind === "stop") s.stats.stops += 1;
	else s.stats.trails += 1;
	if (pnlUsd < 0) {
		s.revengeUntil[pos.mint] = s.deskTime + REVENGE_MS;
		s.reissue.push({
			...pos.template,
			priceUsd: pos.price
		});
		if (s.reissue.length > 16) s.reissue.shift();
	}
	say(s, "risk", kind, pos.symbol, reason, kind === "stop" ? "kill" : "pass");
	say(s, "logger", "note", pos.symbol, `Logged exit. ${pos.symbol}: ${reason}`, "work");
	decide(s, pos.symbol, pos.mint, kind, reason);
}
function drawReturn(pos, rand) {
	let ret = (pos.score - .8) * .0022 + .0105 * gauss(rand);
	if (rand() < .01 && pos.score >= .74) ret += .04 + rand() * .05;
	if (rand() < .005) ret -= .045 + rand() * .07;
	if (ret > .2) return .2;
	if (ret < -.12) return -.12;
	return ret;
}
function markBook(s, rand) {
	const still = [];
	for (const pos of s.opens) {
		const price = Math.max(1e-8, pos.price * (1 + drawReturn(pos, rand)));
		const pnl = price / pos.entryPrice - 1;
		const peak = Math.max(pos.peakPnlPct, pnl);
		let trailArmed = pos.trailArmed;
		let trailStop = pos.trailStopPct;
		if (!trailArmed && peak >= .12) {
			trailArmed = true;
			trailStop = peak - TRAIL_GIVE;
			say(s, "risk", "arm", pos.symbol, `Trail armed on ${pos.symbol}. Peak ${pct(peak)} cleared +12%. Stop ratchets to ${pct(trailStop)} (peak minus 6 points).`, "work");
		} else if (trailArmed && trailStop !== null) {
			const ratcheted = peak - TRAIL_GIVE;
			if (ratcheted > trailStop + .01) trailStop = ratcheted;
		}
		const next = {
			...pos,
			price,
			peakPnlPct: peak,
			trailArmed,
			trailStopPct: trailStop
		};
		if (pnl <= -.06) closePosition(s, next, "stop", pnl, `Hard stop. ${pos.symbol} marked ${pct(pnl)}, through −6%. Sold at the print. No add on the way down.`);
		else if (trailArmed && trailStop !== null && pnl <= trailStop) closePosition(s, next, "trail", pnl, `Trail stop. ${pos.symbol} peaked ${pct(peak)}, stop was ${pct(trailStop)}, mark ${pct(pnl)}. Banked. No revenge unless this fill lost money.`);
		else still.push(next);
	}
	s.opens = still;
}
function noteMode(input, mode) {
	const s = copyState(input);
	s.mode = mode;
	if (mode === "shadow") say(s, "logger", "note", null, "Live arm requested. No key is on file. Session marked shadow — orders will be written and withheld. Nothing will be signed or broadcast.", "work");
	else say(s, "logger", "note", null, "Session returned to the paper book. Shadow arm is off.", "work");
	return s;
}
function stepMinute(input) {
	const s = copyState(input);
	let rng = s.rng >>> 0;
	const rand = () => {
		const next = mulberry(rng);
		rng = next.seed;
		return next.value;
	};
	s.deskTime += MINUTE;
	const batch = [];
	if (s.inbox.length > 0) {
		const pub = s.inbox[0];
		if (pub) batch.push(pub);
		s.inbox = s.inbox.slice(1);
	}
	if (rand() < .92) batch.push(forgePair(s, rand));
	for (const pair of batch) runPipeline(s, pair);
	markBook(s, rand);
	const equity = cents(equityOf(s));
	s.equity.push({
		t: s.deskTime,
		equity
	});
	if (s.equity.length > 1200) s.equity.splice(0, s.equity.length - 1200);
	const found = auditBook(s);
	for (const item of found) if (!s.breaches.includes(item)) s.breaches.push(item);
	s.rng = rng;
	return s;
}
function prewarm(state, minutes) {
	let s = copyState(state);
	s.warmed = true;
	const steps = Math.max(0, Math.floor(minutes));
	for (let i = 0; i < steps; i += 1) s = stepMinute(s);
	return s;
}
function auditBook(s) {
	const problems = [];
	const seen = /* @__PURE__ */ new Set();
	for (const fill of s.opens) {
		if (seen.has(fill.mint)) problems.push(`${fill.symbol} opened twice — average down.`);
		seen.add(fill.mint);
	}
	const all = [...s.opens, ...s.closed];
	for (const fill of all) {
		if (fill.sizePct > .0801) problems.push(`${fill.symbol} sized ${(fill.sizePct * 100).toFixed(2)}% of equity.`);
		if (fill.score < .6) problems.push(`${fill.symbol} entered at ${fill.score.toFixed(2)}.`);
		if (!fill.gates.mintRevoked) problems.push(`${fill.symbol} entered with a live mint.`);
		if (!fill.gates.lpLocked) problems.push(`${fill.symbol} entered with LP unlocked.`);
		if (fill.gates.top10Pct > 20) problems.push(`${fill.symbol} entered with top 10 at ${fill.gates.top10Pct}.`);
		if (fill.gates.volume1hUsd < 5e4) problems.push(`${fill.symbol} entered under the volume floor.`);
		if (fill.gates.devPriorRugs > 0) problems.push(`${fill.symbol} entered on a rug-linked dev.`);
		if (fill.source === "public") problems.push(`${fill.symbol} was a public print with unproven gates.`);
		if (fill.trailArmed && fill.peakPnlPct + 1e-9 < .12) problems.push(`${fill.symbol} trailed before +12%.`);
		if (fill.exitKind === "trail" && fill.peakPnlPct < .12) problems.push(`${fill.symbol} trail exit before +12%.`);
		if (fill.status === "open") {
			const pnl = fill.price / fill.entryPrice - 1;
			if (pnl <= -.06) problems.push(`${fill.symbol} still open through the hard stop (${pct(pnl)}).`);
		}
	}
	if (s.cash < -.05) problems.push("Cash went negative.");
	return problems;
}
function nightBounds(deskTime) {
	if (deskTime <= 0) return {
		from: 0,
		to: 0,
		partial: true
	};
	if (deskTime % 288e5 === 0) return {
		from: deskTime - NIGHT,
		to: deskTime,
		partial: false
	};
	return {
		from: Math.floor(deskTime / NIGHT) * NIGHT,
		to: deskTime,
		partial: true
	};
}
function tradeView(fill) {
	const livePnl = fill.status === "open" ? fill.price / fill.entryPrice - 1 : fill.pnlPct;
	const liveUsd = fill.status === "open" ? cents(fill.qty * fill.price * .997 - fill.sizeUsd) : fill.pnlUsd;
	return {
		symbol: fill.symbol,
		venue: fill.venue,
		score: fill.score,
		sizeUsd: fill.sizeUsd,
		sizePct: fill.sizePct,
		pnlUsd: liveUsd,
		pnlPct: livePnl,
		status: fill.status,
		entryReason: fill.entryReason,
		exitReason: fill.exitReason,
		openedAt: fill.openedAt,
		closedAt: fill.closedAt
	};
}
function buildRecap(s, from, to = s.deskTime) {
	const partial = to - from < 2874e4;
	const points = s.equity.filter((point) => point.t >= from && point.t <= to);
	const startEquity = points[0]?.equity ?? s.startCash;
	const endEquity = points[points.length - 1]?.equity ?? equityOf(s);
	let peak = startEquity;
	let maxDrawdown = 0;
	for (const point of points) {
		if (point.equity > peak) peak = point.equity;
		if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
	}
	const inWindow = (t) => t !== null && t > from && t <= to;
	const opened = [...s.closed, ...s.opens].filter((fill) => fill.openedAt > from && fill.openedAt <= to);
	const closedNow = s.closed.filter((fill) => inWindow(fill.closedAt));
	const trades = [...s.opens.map(tradeView), ...closedNow.map(tradeView)].sort((a, b) => a.openedAt - b.openedAt);
	const wins = closedNow.filter((fill) => (fill.pnlUsd ?? 0) > 0).length;
	const losses = closedNow.filter((fill) => (fill.pnlUsd ?? 0) <= 0).length;
	const realized = cents(closedNow.reduce((sum, fill) => sum + (fill.pnlUsd ?? 0), 0));
	const unrealized = cents(s.opens.reduce((sum, fill) => sum + (fill.qty * fill.price * .997 - fill.sizeUsd), 0));
	const decisions = s.decisions.filter((row) => row.t > from && row.t <= to);
	const count = (outcome) => decisions.filter((row) => row.outcome === outcome).length;
	const killBy = emptyKillBy();
	for (const row of decisions) {
		if (row.outcome !== "kill") continue;
		const code = inferKill(row.reason);
		if (code) killBy[code] += 1;
	}
	const closedViews = closedNow.map(tradeView);
	const best = closedViews.reduce((pick, row) => pick === null || (row.pnlUsd ?? 0) > (pick.pnlUsd ?? 0) ? row : pick, null);
	const worst = closedViews.reduce((pick, row) => pick === null || (row.pnlUsd ?? 0) < (pick.pnlUsd ?? 0) ? row : pick, null);
	const scanned = decisions.filter((row) => row.outcome === "kill" || row.outcome === "reject" || row.outcome === "skip" || row.outcome === "buy").length;
	const lines = decisions.map((row) => `${deskClock(row.t)}  ${row.outcome.toUpperCase().padEnd(6, " ")}  ${row.symbol.padEnd(10, " ")}  ${row.reason}`);
	const draft = {
		from,
		to,
		partial,
		startEquity,
		endEquity,
		maxDrawdown,
		realized,
		unrealized,
		scanned,
		killed: count("kill"),
		scored: opened.length + count("reject"),
		scoreRejected: count("reject"),
		buys: count("buy"),
		stops: count("stop"),
		trails: count("trail"),
		wins,
		losses,
		revengeBlocks: decisions.filter((row) => row.outcome === "skip" && row.reason.includes("Revenge lock")).length,
		addBlocks: decisions.filter((row) => row.outcome === "skip" && row.reason.includes("already on the book")).length,
		killBy,
		trades,
		breaches: s.breaches.slice(),
		mode: s.mode,
		best,
		worst,
		narrative: "",
		lines
	};
	draft.narrative = narrate(draft);
	return draft;
}
function inferKill(reason) {
	if (reason.startsWith("No gate attestation")) return "unverified";
	if (reason.startsWith("Venue is outside")) return "venue";
	if (reason.startsWith("Mint authority")) return "mint";
	if (reason.startsWith("LP is not locked")) return "lp";
	if (reason.startsWith("Top 10")) return "holders";
	if (reason.startsWith("1h volume")) return "volume";
	if (reason.startsWith("Dev ")) return "dev";
	return null;
}
function narrate(r) {
	const delta = r.endEquity - r.startEquity;
	const base = r.startEquity === 0 ? 0 : delta / r.startEquity;
	const direction = delta > 1 ? "higher" : delta < -1 ? "lower" : "flat";
	const window = r.partial ? "This is an interim read — the night is not closed." : "The night is closed.";
	const signing = r.mode === "shadow" ? "The session was armed as shadow: the same rules, orders written and then withheld. Nothing was signed." : "The session stayed on the paper book. Nothing was signed or broadcast.";
	const revenge = r.revengeBlocks > 0 ? `Revenge re-entries refused: ${r.revengeBlocks}.` : "No revenge re-entry cleared the lock.";
	const adds = r.addBlocks > 0 ? `Add attempts refused: ${r.addBlocks}.` : "No add was attempted.";
	const breach = r.breaches.length === 0 ? "Rule breaches: 0." : `Rule breaches: ${r.breaches.length}. Do not trust the book until those are read.`;
	return [
		window,
		`Balance moved from ${money(r.startEquity)} to ${money(r.endEquity)} (${pct(base)}), ${direction}.`,
		`Max drawdown ${(r.maxDrawdown * 100).toFixed(1)}%.`,
		`Scout put ${r.scanned} names through the handoff. Filter killed ${r.killed}. Analyst refused ${r.scoreRejected} under 0.60. Executor filled ${r.buys}.`,
		`Risk stopped ${r.stops} on the −6% line and trailed ${r.trails} after they had cleared +12%.`,
		revenge,
		adds,
		breach,
		signing
	].join(" ");
}
function nextNightTarget(deskTime) {
	if (deskTime > 0 && deskTime % 288e5 === 0) return {
		from: deskTime,
		target: deskTime + NIGHT
	};
	const from = Math.floor(deskTime / NIGHT) * NIGHT;
	return {
		from,
		target: from + NIGHT
	};
}
var memory = /* @__PURE__ */ new Map();
var safeStorage = {
	getItem: (key) => {
		if (typeof window === "undefined") return memory.get(key) ?? null;
		return window.localStorage.getItem(key);
	},
	setItem: (key, value) => {
		if (typeof window === "undefined") {
			memory.set(key, value);
			return;
		}
		window.localStorage.setItem(key, value);
	},
	removeItem: (key) => {
		if (typeof window === "undefined") {
			memory.delete(key);
			return;
		}
		window.localStorage.removeItem(key);
	}
};
function toPublicPair(row) {
	return {
		uid: `pub-${row.mint}`,
		mint: row.mint,
		symbol: row.symbol || row.mint.slice(0, 4),
		name: row.name || row.symbol,
		venue: row.venue,
		priceUsd: row.priceUsd > 0 ? row.priceUsd : 1e-6,
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
		source: "public"
	};
}
function finishNight(cur, next) {
	return {
		...next,
		running: false,
		overnight: false,
		heldRun: false,
		recap: buildRecap(next, cur.recapFrom, next.deskTime),
		recapOpen: true
	};
}
var useDesk = create()(persist((set) => ({
	...createDesk(),
	tick: () => set((cur) => {
		if (!cur.running) return cur;
		const bursts = cur.overnight ? 4 : 1;
		let next = cur;
		for (let i = 0; i < bursts; i += 1) {
			next = stepMinute(next);
			if (cur.overnight && next.deskTime >= cur.nightTarget) return finishNight(cur, next);
		}
		return next;
	}),
	toggleRun: () => set((cur) => ({
		running: !cur.running,
		overnight: cur.running ? false : cur.overnight
	})),
	startNight: () => set((cur) => {
		const night = nextNightTarget(cur.deskTime);
		return {
			running: true,
			overnight: true,
			recapOpen: false,
			heldRun: false,
			recapFrom: night.from,
			nightTarget: night.target
		};
	}),
	openRecap: () => set((cur) => {
		const bounds = nightBounds(cur.deskTime);
		return {
			recap: buildRecap(cur, bounds.from, bounds.to),
			recapOpen: true,
			heldRun: cur.running,
			running: false,
			overnight: false
		};
	}),
	closeRecap: () => set((cur) => ({
		recapOpen: false,
		running: cur.heldRun,
		heldRun: false
	})),
	setArmOpen: (open) => set({ armOpen: open }),
	armShadow: () => set((cur) => ({
		...noteMode(cur, "shadow"),
		armOpen: false
	})),
	setPaper: () => set((cur) => noteMode(cur, "paper")),
	reset: () => set(prewarm(createDesk((Date.now() ^ 2654435769) >>> 0), 150)),
	ingestPublic: (payload) => set((cur) => {
		if (!payload.ok) return {
			...cur,
			publicTape: "offline",
			tapeNote: "Public tape offline. Indexed launches only — every name still has to clear the gates."
		};
		const seen = new Set(cur.seenMints);
		const inbox = cur.inbox.slice();
		let added = 0;
		for (const row of payload.pairs) {
			if (seen.has(row.mint)) continue;
			seen.add(row.mint);
			inbox.push(toPublicPair(row));
			added += 1;
		}
		const note = added > 0 ? `Public tape live. ${added} Pump.fun / Raydium names queued. ${payload.dropped} other venues left on the floor.` : `Public tape live. No new Pump.fun or Raydium names. ${payload.dropped} other venues left on the floor.`;
		return {
			...cur,
			publicTape: "live",
			tapeNote: note,
			inbox: inbox.slice(0, 30),
			seenMints: [...seen].slice(-400)
		};
	})
}), {
	name: "keel-desk-v1",
	version: 1,
	skipHydration: true,
	storage: createJSONStorage(() => safeStorage),
	partialize: (state) => {
		const { tick: _tick, toggleRun: _toggleRun, startNight: _startNight, openRecap: _openRecap, closeRecap: _closeRecap, setArmOpen: _setArmOpen, armShadow: _armShadow, setPaper: _setPaper, reset: _reset, ingestPublic: _ingestPublic, ...data } = state;
		return data;
	}
}));
function bootDesk() {
	const current = useDesk.getState();
	if (!current.warmed) useDesk.setState(prewarm(current, 150));
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var KILL_LABEL = {
	unverified: "Public print, gates unproven",
	mint: "Mint authority still live",
	lp: "LP not locked",
	holders: "Top 10 over 20%",
	volume: "1h volume under $50k",
	dev: "Dev tied to a prior rug",
	venue: "Outside Pump.fun / Raydium"
};
var AUDIT = [
	"Mint revoked before every fill",
	"LP locked before every fill",
	"Top 10 at or under 20%",
	"1h volume at least $50k",
	"Dev wallet clean of prior rugs",
	"Score at least 0.60",
	"No fill above 8% of balance",
	"Nothing left open through −6%",
	"No trail before +12%",
	"No averaged-down position",
	"No revenge re-entry",
	"Nothing signed or broadcast"
];
function pnlClass(n) {
	if (n === null) return "text-muted";
	if (n > .5) return "text-up";
	if (n < -.5) return "text-down";
	return "text-fg";
}
function TradeLine({ trade }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-line py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-mono text-sm",
					children: [trade.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-xs text-dim",
						children: trade.venue
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("num font-mono text-sm", pnlClass(trade.pnlUsd)),
					children: [
						trade.status === "open" ? "Open " : "",
						trade.pnlUsd === null ? "—" : money(trade.pnlUsd),
						trade.pnlPct !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-xs",
							children: pct(trade.pnlPct)
						}) : null
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					"Score ",
					trade.score.toFixed(2),
					" · size ",
					money(trade.sizeUsd),
					" (",
					(trade.sizePct * 100).toFixed(2),
					"% of balance)"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-fg",
				children: trade.entryReason
			}),
			trade.exitReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: trade.exitReason
			}) : null
		]
	});
}
function RecapScreen() {
	const recap = useDesk((s) => s.recap);
	const closeRecap = useDesk((s) => s.closeRecap);
	const startNight = useDesk((s) => s.startNight);
	const [copied, setCopied] = (0, import_react.useState)(false);
	if (!recap) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-40 overflow-y-auto bg-bg text-fg",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "recap-title",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs tracking-widest text-amber",
							children: recap.partial ? "INTERIM READ" : "MORNING RECAP"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "recap-title",
							className: "mt-1 text-2xl font-medium",
							children: recap.partial ? "The night is still open" : "The night is closed"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 font-mono text-sm text-muted",
							children: [
								"Desk ",
								deskClock(recap.from),
								" – ",
								deskClock(recap.to),
								recap.mode === "shadow" ? " · shadow" : " · paper"
							]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: closeRecap,
						className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Back to the book"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "rounded-md border border-line bg-surface p-4 sm:col-span-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
									className: "text-xs text-muted",
									children: "Balance"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "num mt-1 font-mono text-3xl",
									children: money(recap.endEquity)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: cn("num mt-1 font-mono text-sm", recap.endEquity - recap.startEquity >= 0 ? "text-up" : "text-down"),
									children: [
										pct(recap.startEquity ? (recap.endEquity - recap.startEquity) / recap.startEquity : 0),
										" from ",
										money(recap.startEquity)
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "rounded-md border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
									className: "text-xs text-muted",
									children: "Max drawdown"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "num mt-1 font-mono text-3xl text-down",
									children: [(recap.maxDrawdown * 100).toFixed(1), "%"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Peak to trough inside this window"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "rounded-md border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
									className: "text-xs text-muted",
									children: "Realized / still open"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: cn("num mt-1 font-mono text-3xl", pnlClass(recap.realized)),
									children: money(recap.realized)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "num mt-1 font-mono text-sm text-muted",
									children: ["Open marks ", money(recap.unrealized)]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-3xl text-sm text-fg",
					children: recap.narrative
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rounded-md border border-line bg-surface p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Rule audit"
						}), recap.breaches.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 grid gap-2",
							children: AUDIT.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-start gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "mt-0.5 size-4 shrink-0 text-up",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item })]
							}, item))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 grid gap-2",
							children: recap.breaches.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "text-sm text-down",
								children: item
							}, item))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RejectionBars, { recap })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium",
						children: "Fills and why"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-xs text-dim",
						children: [
							recap.wins,
							" won · ",
							recap.losses,
							" lost · ",
							recap.stops,
							" hard stops · ",
							recap.trails,
							" trails"
						]
					})]
				}), recap.trades.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "No fills. The book stayed flat. That is a valid result."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: recap.trades.map((trade) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradeLine, { trade }, `${trade.symbol}-${trade.openedAt}`)) })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "inline-flex min-h-11 items-center gap-2 rounded-md bg-up px-4 text-sm font-medium text-ink",
						onClick: () => {
							startNight();
						},
						children: recap.partial ? "Run the rest of the night" : "Run the next night"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm",
						onClick: async () => {
							try {
								await navigator.clipboard.writeText(recap.lines.join("\n") || "No decisions in this window.");
								setCopied(true);
							} catch {
								setCopied(false);
							}
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
							className: "size-4",
							"aria-hidden": "true"
						}), copied ? "Tape copied" : "Copy the decision tape"]
					})]
				})
			]
		})
	});
}
function RejectionBars({ recap }) {
	const rows = Object.keys(KILL_LABEL).map((code) => ({
		code,
		label: KILL_LABEL[code],
		n: recap.killBy[code]
	})).filter((row) => row.n > 0);
	const max = Math.max(1, ...rows.map((row) => row.n));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-md border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-medium",
				children: "Why names died"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					recap.killed,
					" killed at the gate · ",
					recap.scoreRejected,
					" scored under 0.60 · ",
					recap.revengeBlocks,
					" revenge locks · ",
					recap.addBlocks,
					" adds refused"
				]
			}),
			rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "No gate kills in this window."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 grid gap-2",
				children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "num font-mono text-xs text-muted",
						children: row.n
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 h-1.5 rounded-full bg-raised",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-1.5 rounded-full bg-down",
						style: { width: `${row.n / max * 100}%` }
					})
				})] }, row.code))
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var fetchPublicTape = createServerFn({ method: "GET" }).handler(createSsrRpc("1c636824bf6aa89498ed10efb134f011b2de42d34dcbdd2c82d81397403c4021"));
var RULES = [
	"Mint revoked",
	"LP locked",
	"Top 10 ≤ 20%",
	"1h vol ≥ $50k",
	"Clean dev",
	"Score ≥ 0.60",
	"Size ≤ 8%",
	"Stop −6%",
	"Trail after +12%",
	"No average down",
	"No revenge"
];
var ICONS = {
	scout: Radar,
	filter: Funnel,
	analyst: Scale,
	executor: Crosshair,
	risk: Shield,
	logger: ScrollText
};
function DeskApp() {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let alive = true;
		const finish = () => {
			if (!alive) return;
			bootDesk();
			setReady(true);
		};
		const unsub = useDesk.persist.onFinishHydration(finish);
		if (useDesk.persist.hasHydrated()) finish();
		else useDesk.persist.rehydrate();
		return () => {
			alive = false;
			unsub();
		};
	}, []);
	const running = useDesk((s) => s.running);
	const overnight = useDesk((s) => s.overnight);
	(0, import_react.useEffect)(() => {
		if (!ready || !running) return;
		const id = window.setInterval(() => useDesk.getState().tick(), overnight ? 110 : 1500);
		return () => window.clearInterval(id);
	}, [
		ready,
		running,
		overnight
	]);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		let stop = false;
		const pull = async () => {
			try {
				const res = await fetchPublicTape();
				if (!stop) useDesk.getState().ingestPublic(res);
			} catch {
				if (!stop) useDesk.getState().ingestPublic({
					ok: false,
					pairs: [],
					scanned: 0,
					dropped: 0
				});
			}
		};
		pull();
		const id = window.setInterval(() => void pull(), 2e4);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [ready]);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-svh flex-col overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex w-full min-w-0 shrink-0 gap-1.5 overflow-x-auto px-3 py-2",
				children: RULES.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "shrink-0 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-muted",
					children: rule
				}, rule))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metrics, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Agents, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workspace, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecapGate, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArmGate, {})
		]
	});
}
function Skeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex h-svh flex-col bg-bg px-4 py-6 text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xs tracking-widest text-amber",
				children: "KEEL"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 text-2xl font-medium",
				children: "Opening the paper book"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-md text-sm text-muted",
				children: "Scout, Filter, Analyst, Executor, Risk, Logger. Nothing is signed."
			})
		]
	});
}
function Header() {
	const deskTime = useDesk((s) => s.deskTime);
	const running = useDesk((s) => s.running);
	const overnight = useDesk((s) => s.overnight);
	const mode = useDesk((s) => s.mode);
	const publicTape = useDesk((s) => s.publicTape);
	const toggleRun = useDesk((s) => s.toggleRun);
	const startNight = useDesk((s) => s.startNight);
	const openRecap = useDesk((s) => s.openRecap);
	const setArmOpen = useDesk((s) => s.setArmOpen);
	const setPaper = useDesk((s) => s.setPaper);
	const reset = useDesk((s) => s.reset);
	const [confirmReset, setConfirmReset] = (0, import_react.useState)(false);
	const tapeLabel = publicTape === "live" ? "Public tape live" : publicTape === "offline" ? "Public tape offline" : "Public tape connecting";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "w-full min-w-0 shrink-0 border-b border-line",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3 px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/favicon.svg",
						alt: "",
						className: "size-8"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-sm tracking-widest",
						children: "KEEL"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted",
						children: "Capital stays first"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("rounded-md px-2 py-1 font-mono text-xs", mode === "shadow" ? "bg-amber text-ink" : "bg-raised text-up"),
						children: mode === "shadow" ? "SHADOW" : "PAPER"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("size-1.5 rounded-full", running ? "bg-up keel-pulse" : "bg-dim"),
							"aria-hidden": "true"
						}), tapeLabel]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "num font-mono text-lg",
					"aria-label": "Desk clock",
					children: [deskClock(deskTime), overnight ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-xs text-amber",
						children: "night"
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: toggleRun,
							className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm",
							children: [running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, {
								className: "size-4",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
								className: "size-4",
								"aria-hidden": "true"
							}), running ? "Pause" : "Resume"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: startNight,
							disabled: overnight,
							className: "inline-flex min-h-11 items-center gap-2 rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, {
								className: "size-4",
								"aria-hidden": "true"
							}), overnight ? "Night running" : "Run the night"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: openRecap,
							className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sunrise, {
								className: "size-4",
								"aria-hidden": "true"
							}), "Recap"]
						}),
						mode === "paper" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setArmOpen(true),
							className: "inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-muted",
							children: "Live"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: setPaper,
							className: "inline-flex min-h-11 items-center rounded-md border border-amber px-3 text-sm text-amber",
							children: "Back to paper"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								if (!confirmReset) {
									setConfirmReset(true);
									return;
								}
								reset();
								setConfirmReset(false);
							},
							className: "inline-flex min-h-11 items-center rounded-md px-3 text-sm text-dim",
							children: confirmReset ? "Confirm reset" : "Reset"
						})
					]
				})
			]
		}), mode === "shadow" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "border-t border-line px-3 py-1.5 text-xs text-amber",
			children: "Shadow arm. The agents still write orders. Nothing is signed or broadcast."
		}) : null]
	});
}
function Metrics() {
	const cash = useDesk((s) => s.cash);
	const opens = useDesk((s) => s.opens);
	const startCash = useDesk((s) => s.startCash);
	const stats = useDesk((s) => s.stats);
	const equity = equityOf({
		cash,
		opens
	});
	const delta = equity - startCash;
	const deployed = opens.reduce((sum, row) => sum + row.qty * row.price, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "grid shrink-0 grid-cols-2 gap-2 px-3 lg:grid-cols-4",
		"aria-label": "Balance",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Balance",
				value: money(equity),
				note: pct(startCash ? delta / startCash : 0) + " session",
				noteClass: delta >= 0 ? "text-up" : "text-down"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Cash",
				value: money(cash),
				note: "Undeployed",
				noteClass: "text-muted"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Open risk",
				value: money(deployed),
				note: `${opens.length} names · 8% cap each`,
				noteClass: "text-muted"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Fills / kills",
				value: `${stats.buys} / ${stats.killed}`,
				note: `${stats.stops} stops · ${stats.trails} trails`,
				noteClass: "text-muted"
			})
		]
	});
}
function Metric({ label, value, note, noteClass }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-line bg-surface px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "num font-mono text-lg",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("num font-mono text-xs", noteClass),
				children: note
			})
		]
	});
}
function Agents() {
	const agents = useDesk((s) => s.agents);
	const tapeNote = useDesk((s) => s.tapeNote);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "w-full min-w-0 shrink-0 px-3 py-2",
		"aria-label": "Agent activity",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-1.5 overflow-x-auto lg:grid lg:grid-cols-6 lg:overflow-visible",
			children: AGENT_META.map((agent, index) => {
				const snap = agents[agent.id];
				const Icon = ICONS[agent.id];
				const border = snap.tone === "kill" ? "border-down" : snap.tone === "pass" ? "border-up" : snap.tone === "work" ? "border-amber" : "border-line";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: cn("w-44 shrink-0 rounded-md border bg-surface px-2.5 py-2 lg:w-auto", border),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 text-xs text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "size-3.5",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono",
									children: String(index + 1).padStart(2, "0")
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium",
								children: agent.name
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 line-clamp-2 text-xs leading-snug text-fg",
							children: snap.last
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 line-clamp-2 text-xs text-dim",
							children: agent.id === "scout" ? tapeNote : agent.duty
						})
					]
				}, agent.id);
			})
		})
	});
}
function Workspace() {
	const [tab, setTab] = (0, import_react.useState)("book");
	const [filter, setFilter] = (0, import_react.useState)("all");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 w-full min-w-0 flex-1 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-0 flex-1 gap-2 px-3 pb-2 lg:grid-cols-12",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Tape",
					hint: "Scout → handoff",
					className: cn("lg:col-span-3", tab === "tape" ? "flex" : "hidden lg:flex"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tape, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Book",
					hint: "Equity and open risk",
					className: cn("lg:col-span-5", tab === "book" ? "flex" : "hidden lg:flex"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Book, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Log",
					hint: "Reason on every decision",
					className: cn("lg:col-span-4", tab === "log" ? "flex" : "hidden lg:flex"),
					extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogFilters, {
						filter,
						onChange: setFilter
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogList, { filter })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
			className: "grid shrink-0 grid-cols-3 border-t border-line lg:hidden",
			"aria-label": "Desk sections",
			children: [
				["book", "Book"],
				["tape", "Tape"],
				["log", "Log"]
			].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setTab(id),
				className: cn("min-h-11 text-sm", tab === id ? "text-up" : "text-muted"),
				"aria-pressed": tab === id,
				children: label
			}, id))
		})]
	});
}
function Panel({ title, hint, className, extra, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2 border-b border-line px-3 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-medium",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-dim",
				children: hint
			})] }), extra]
		}), children]
	});
}
function Tape() {
	const tape = useDesk((s) => s.tape);
	if (tape.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-3 py-4 text-sm text-muted",
		children: "Scout is quiet. The next print lands on the minute."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "scroll min-h-0 flex-1 overflow-y-auto",
		children: tape.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "border-b border-line px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-sm",
						children: [row.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-xs text-dim",
							children: row.venue
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outcome, { row })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 font-mono text-xs text-dim",
					children: [
						deskClock(row.t),
						" · ",
						row.source === "public" ? "public" : "index",
						" · ",
						compactUsd(row.volume1hUsd),
						" 1h",
						row.score !== null ? ` · ${row.score.toFixed(2)}` : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 line-clamp-2 text-xs leading-snug text-muted",
					children: row.reason
				})
			]
		}, row.id))
	});
}
function Outcome({ row }) {
	const label = row.outcome === "kill" ? "Killed" : row.outcome === "reject" ? "Under 0.60" : row.outcome === "skip" ? "Skipped" : "Filled";
	const color = row.outcome === "buy" ? "text-up" : row.outcome === "kill" ? "text-down" : "text-amber";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("font-mono text-xs", color),
		children: label
	});
}
function Book() {
	const equity = useDesk((s) => s.equity);
	const opens = useDesk((s) => s.opens);
	const startCash = useDesk((s) => s.startCash);
	const stroke = (equity[equity.length - 1]?.equity ?? startCash) < startCash ? "var(--color-down)" : "var(--color-up)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-36 shrink-0 px-2 pt-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
					data: equity,
					margin: {
						top: 8,
						right: 8,
						left: 8,
						bottom: 0
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
							hide: true,
							domain: ["auto", "auto"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquityTip, {}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
							type: "monotone",
							dataKey: "equity",
							stroke,
							fill: stroke,
							fillOpacity: .16,
							strokeWidth: 1.75,
							dot: false,
							isAnimationActive: false
						})
					]
				})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "scroll min-h-0 flex-1 overflow-y-auto border-t border-line",
			children: opens.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-3 py-4 text-sm text-muted",
				children: "No risk on. The book is flat, and that is allowed."
			}) : opens.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PositionRow, { row }, row.id))
		})]
	});
}
function EquityTip({ active, payload }) {
	if (!active || !payload?.length) return null;
	const point = payload[0];
	if (point?.value === void 0 || point.payload === void 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-dim",
			children: deskClock(point.payload.t)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: money(point.value) })]
	});
}
function PositionRow({ row }) {
	const pnl = row.price / row.entryPrice - 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-line px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-mono text-sm",
					children: [row.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-xs text-dim",
						children: row.venue
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("num font-mono text-sm", pnl >= 0 ? "text-up" : "text-down"),
					children: pct(pnl)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 font-mono text-xs text-dim",
				children: [
					money(row.sizeUsd),
					" · ",
					(row.sizePct * 100).toFixed(2),
					"% · score ",
					row.score.toFixed(2),
					" · ",
					pxPrice(row.price)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PnlTrack, { pnl }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: row.trailArmed && row.trailStopPct !== null ? `Trail on. Stop ${pct(row.trailStopPct)} (peak ${pct(row.peakPnlPct)}).` : "Hard stop −6%. Trail stays off until +12%."
			})
		]
	});
}
function PnlTrack({ pnl }) {
	const min = -.1;
	const max = .26;
	const place = (value) => {
		return `${(Math.min(max, Math.max(min, value)) - min) / .36 * 100}%`;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mt-2 h-1.5 rounded-full bg-raised",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute inset-y-0 w-px bg-down",
				style: { left: place(-.06) }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute inset-y-0 w-px bg-amber",
				style: { left: place(.12) }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg",
				style: { left: place(pnl) }
			})
		]
	});
}
function LogFilters({ filter, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap justify-end gap-1",
		children: [
			{
				id: "all",
				label: "All"
			},
			{
				id: "rej",
				label: "Rejections"
			},
			{
				id: "orders",
				label: "Orders"
			},
			{
				id: "risk",
				label: "Risk"
			}
		].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => onChange(item.id),
			className: cn("min-h-11 rounded-md px-2 text-xs", filter === item.id ? "bg-raised text-fg" : "text-dim"),
			"aria-pressed": filter === item.id,
			children: item.label
		}, item.id))
	});
}
function LogList({ filter }) {
	const rows = useDesk((s) => s.logs).filter((row) => matchLog(row, filter)).slice().reverse();
	const latest = rows[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "sr-only",
		"aria-live": "polite",
		children: latest ? `${latest.agent}: ${latest.reason}` : "Log empty"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "scroll min-h-0 flex-1 overflow-y-auto",
		children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
			className: "px-3 py-4 text-sm text-muted",
			children: "No lines in this filter yet."
		}) : rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogRow, { row }, row.id))
	})] });
}
function matchLog(row, filter) {
	if (filter === "all") return true;
	if (filter === "rej") return row.kind === "kill" || row.kind === "reject" || row.kind === "skip";
	if (filter === "orders") return row.kind === "buy" || row.kind === "pass" || row.kind === "score";
	return row.kind === "arm" || row.kind === "stop" || row.kind === "trail";
}
function LogRow({ row }) {
	const name = AGENT_META.find((agent) => agent.id === row.agent)?.name ?? row.agent;
	const color = row.kind === "kill" || row.kind === "stop" ? "text-down" : row.kind === "buy" || row.kind === "pass" || row.kind === "trail" ? "text-up" : row.kind === "reject" || row.kind === "skip" || row.kind === "arm" ? "text-amber" : "text-fg";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-line px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline justify-between gap-2 font-mono text-xs text-dim",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: deskClock(row.t) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: name })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: cn("mt-0.5 text-sm leading-snug", color),
			children: row.reason
		})]
	});
}
function RecapGate() {
	if (!useDesk((s) => s.recapOpen)) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecapScreen, {});
}
function ArmGate() {
	const open = useDesk((s) => s.armOpen);
	const setArmOpen = useDesk((s) => s.setArmOpen);
	const armShadow = useDesk((s) => s.armShadow);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const onKey = (event) => {
			if (event.key === "Escape") setArmOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, setArmOpen]);
	if (!open) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 sm:items-center",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "arm-title",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-md border border-line bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs tracking-widest text-amber",
					children: "LIVE STAYS DARK"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "arm-title",
					className: "mt-2 text-xl font-medium",
					children: "This desk will not hold a key"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "KEEL will not take a seed phrase or a private key. That is the first preservation rule. Paper is the book that runs. Arming live only switches the session to shadow: the same six agents, the same hard handoffs, orders written and then withheld."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-fg",
					children: "Nothing reaches Solana."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setArmOpen(false),
						className: "inline-flex min-h-11 items-center rounded-md bg-up px-4 text-sm font-medium text-ink",
						children: "Keep paper"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: armShadow,
						className: "inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm",
						children: "Arm shadow book"
					})]
				})
			]
		})
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskApp, {});
}
//#endregion
export { Home as component };
