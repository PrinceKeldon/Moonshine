import { o as __toESM } from "../_runtime.mjs";
import { W as require_react, y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { n as fetchWallet, r as isSolanaAddress, t as createSsrRpc } from "./wallet-QdX2ufqE.mjs";
import { a as MIN_LIVE_LIQ, c as MIN_TICKET_SOL, d as isSoftTapeBlock, f as liveScore, i as MIN_BREAKOUT_VOL, l as SOL_MINT, m as ticketSol, n as MAX_PCT$1, o as MIN_LIVE_SCORE, p as tapeBlock, r as MIN_BREAKOUT_LIQ, s as MIN_LIVE_VOL, t as LIVE_RESERVE_SOL, u as isBreakoutCandidate } from "./live-score-D08J72c8.mjs";
import { _ as Crosshair, a as Shield, c as Scale, d as Play, f as Pause, g as Funnel, h as KeyRound, i as Sunrise, l as RefreshCw, m as LoaderCircle, n as Wallet, o as Search, p as Moon, s as ScrollText, t as X, u as Radar, v as Copy, y as Check } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { a as Tooltip, i as ResponsiveContainer, n as YAxis, r as Area, t as AreaChart } from "../_libs/recharts+[...].mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
// node_modules/.nitro/vite/services/ssr/assets/routes-BO5uym6e.js
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
var PAPER_MIN_SCORE = .35;
var TRAIL_GIVE$1 = .06;
var PAPER_MIN_VOL = 1e4;
var REVENGE_MS = 30 * NIGHT;
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
		duty: "Paper ≥0.35 · live ≥0.45"
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
		warmed: true,
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
		marketCandidates: [],
		scanState: "idle",
		marketUpdatedAt: null,
		marketScanned: 0,
		marketDropped: 0,
		seenMints: [],
		checkedMints: [],
		rugDevs: [],
		reissue: [],
		revengeUntil: {},
		agents: idleAgents(),
		stats: emptyStats(),
		breaches: [],
		publicTape: "idle",
		tapeNote: "Waiting for live Pump.fun and Raydium listings. Paper trades use public market prices.",
		watchAddress: "",
		watch: null
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
		checkedMints: input.checkedMints.slice(),
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
function filterPair(pair) {
	if (pair.venue !== "pump.fun" && pair.venue !== "raydium") return {
		ok: false,
		code: "venue",
		reason: "Venue is outside Pump.fun and Raydium. Rejected."
	};
	if (pair.source === "public" && pair.safetyReason) return {
		ok: false,
		code: "unverified",
		reason: `RugCheck blocked this paper candidate: ${pair.safetyReason}`
	};
	if (pair.source === "public" && pair.devWallet && pair.devPriorRugs === null) return {
		ok: false,
		code: "unverified",
		reason: `Creator ${pair.devWallet} has no indexed Scorp history or the lookup failed. Unknown is not clean; rejected.`
	};
	if (pair.mintRevoked === null || pair.freezeRevoked === null || pair.lpLocked === null || pair.top10Pct === null || pair.devWallet === null || pair.devPriorRugs === null) return {
		ok: false,
		code: "unverified",
		reason: "RugCheck or creator history is incomplete. Mint/freeze authority, LP lock, holder concentration, and developer rug history must be verified. Rejected."
	};
	if (!pair.mintRevoked) return {
		ok: false,
		code: "mint",
		reason: "Mint authority is still live. Rejected."
	};
	if (!pair.freezeRevoked) return {
		ok: false,
		code: "mint",
		reason: "Freeze authority is still live. Rejected."
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
	if (pair.volume1hUsd < 1e4) return {
		ok: false,
		code: "volume",
		reason: `1h volume is ${compactUsd(pair.volume1hUsd)} (under ${compactUsd(PAPER_MIN_VOL)} paper minimum). Rejected.`
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
		reason: `All gates clear. Mint and freeze authority revoked, LP locked, top 10 at ${pair.top10Pct.toFixed(1)}%, 1h volume ${compactUsd(pair.volume1hUsd)}, Scorp tracked ${pair.devHistoryTokens ?? "indexed"} creator launches with 0 reported rugs.`
	};
}
function analyze(pair) {
	const volScore = clamp01((Math.log10(Math.max(pair.volume1hUsd, 1)) - 4) / 1.1);
	const liqScore = clamp01((Math.log10(Math.max(pair.liquidityUsd, 1)) - 3.6) / 1.1);
	const holderScore = clamp01((16 - (pair.top10Pct ?? 20)) / 12);
	const ageScore = pair.ageMin < 6 ? .2 : pair.ageMin < 15 ? .5 : pair.ageMin < 180 ? .9 : .62;
	const flowScore = clamp01(.5 + (pair.buys1h - pair.sells1h) / Math.max(1, pair.buys1h + pair.sells1h) * .9);
	const raw = .2 * volScore + .24 * liqScore + .18 * holderScore + .18 * ageScore + .2 * flowScore;
	const score = Math.round(clamp01(raw) * 100) / 100;
	return {
		score,
		reason: `Score ${score.toFixed(2)}. Liquidity ${liqScore.toFixed(2)}, volume ${volScore.toFixed(2)}, holders ${holderScore.toFixed(2)}, age ${ageScore.toFixed(2)}, flow ${flowScore.toFixed(2)}. Paper line is ${PAPER_MIN_SCORE.toFixed(2)}.`
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
	if (view.score < .35) {
		s.stats.scoreRejected += 1;
		const reason = `No paper trade. ${view.reason} Under ${PAPER_MIN_SCORE.toFixed(2)}.`;
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
		freezeRevoked: pair.freezeRevoked === true,
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
function markBook(s) {
	const still = [];
	for (const pos of s.opens) {
		const price = Math.max(1e-12, pos.price);
		const pnl = price / pos.entryPrice - 1;
		const peak = Math.max(pos.peakPnlPct, pnl);
		let trailArmed = pos.trailArmed;
		let trailStop = pos.trailStopPct;
		if (!trailArmed && peak >= .12) {
			trailArmed = true;
			trailStop = peak - TRAIL_GIVE$1;
			say(s, "risk", "arm", pos.symbol, `Trail armed on ${pos.symbol}. Peak ${pct(peak)} cleared +12%. Stop ratchets to ${pct(trailStop)} (peak minus 6 points).`, "work");
		} else if (trailArmed && trailStop !== null) {
			const ratcheted = peak - TRAIL_GIVE$1;
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
	s.deskTime += MINUTE;
	const batch = [];
	if (s.inbox.length > 0) {
		const pub = s.inbox[0];
		if (pub) batch.push(pub);
		s.inbox = s.inbox.slice(1);
	}
	for (const pair of batch) runPipeline(s, pair);
	markBook(s);
	const equity = cents(equityOf(s));
	s.equity.push({
		t: s.deskTime,
		equity
	});
	if (s.equity.length > 1200) s.equity.splice(0, s.equity.length - 1200);
	const found = auditBook(s);
	for (const item of found) if (!s.breaches.includes(item)) s.breaches.push(item);
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
		if (fill.score < .35) problems.push(`${fill.symbol} entered at ${fill.score.toFixed(2)}.`);
		if (!fill.gates.mintRevoked) problems.push(`${fill.symbol} entered with a live mint.`);
		if (!fill.gates.freezeRevoked) problems.push(`${fill.symbol} entered with a live freeze authority.`);
		if (!fill.gates.lpLocked) problems.push(`${fill.symbol} entered with LP unlocked.`);
		if (fill.gates.top10Pct > 20) problems.push(`${fill.symbol} entered with top 10 at ${fill.gates.top10Pct}.`);
		if (fill.gates.volume1hUsd < 1e4) problems.push(`${fill.symbol} entered under the paper volume floor.`);
		if (fill.gates.devPriorRugs > 0) problems.push(`${fill.symbol} entered on a rug-linked dev.`);
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
		`Scout put ${r.scanned} names through the handoff. Filter killed ${r.killed}. Analyst refused ${r.scoreRejected} under ${PAPER_MIN_SCORE.toFixed(2)}. Executor filled ${r.buys}.`,
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
var memory$1 = /* @__PURE__ */ new Map();
var safeStorage$1 = {
	getItem: (key) => {
		if (typeof window === "undefined") return memory$1.get(key) ?? null;
		return window.localStorage.getItem(key);
	},
	setItem: (key, value) => {
		if (typeof window === "undefined") {
			memory$1.set(key, value);
			return;
		}
		window.localStorage.setItem(key, value);
	},
	removeItem: (key) => {
		if (typeof window === "undefined") {
			memory$1.delete(key);
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
		priceUsd: row.priceUsd,
		volume1hUsd: row.volume1hUsd,
		liquidityUsd: row.liquidityUsd,
		mcapUsd: row.mcapUsd,
		ageMin: row.ageMin,
		buys1h: row.buys1h,
		sells1h: row.sells1h,
		mintRevoked: row.mintRevoked ?? null,
		freezeRevoked: row.freezeRevoked ?? null,
		lpLocked: row.lpLocked ?? null,
		top10Pct: row.top10Pct ?? null,
		devWallet: row.creator ?? null,
		devPriorRugs: row.devPriorRugs ?? null,
		devHistoryTokens: row.creatorTokenCount ?? null,
		safetyReason: row.safetyReason ?? null,
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
	stagePublicCandidates: (payload) => set((cur) => ({
		...cur,
		scanState: "screening",
		marketUpdatedAt: Date.now(),
		marketScanned: payload.scanned,
		marketDropped: payload.dropped,
		marketCandidates: payload.pairs.map((pair) => ({
			...pair,
			safetyState: "checking"
		}))
	})),
	setScanState: (scanState) => set({ scanState }),
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
	reset: () => set((cur) => ({
		...createDesk((Date.now() ^ 2654435769) >>> 0),
		watchAddress: cur.watchAddress ?? "",
		watch: cur.watch ?? null
	})),
	liveEvent: (agent, kind, symbol, reason, tone, decision) => set((cur) => {
		const seq = cur.seq + 1;
		const row = {
			id: `L${seq}`,
			t: cur.deskTime,
			agent,
			symbol,
			kind,
			reason
		};
		const logs = [...cur.logs, row];
		if (logs.length > 180) logs.splice(0, logs.length - 180);
		const agents = {
			...cur.agents,
			[agent]: {
				last: reason,
				tone
			}
		};
		let decisions = cur.decisions;
		if (decision && symbol) {
			decisions = [...cur.decisions, {
				t: cur.deskTime,
				symbol,
				mint: decision.mint,
				outcome: decision.outcome,
				reason
			}];
			if (decisions.length > 3e3) decisions = decisions.slice(decisions.length - 3e3);
		}
		return {
			...cur,
			seq,
			logs,
			agents,
			decisions
		};
	}),
	ingestPublic: (payload) => set((cur) => {
		if (!payload.ok) return {
			...cur,
			publicTape: "offline",
			scanState: "offline",
			tapeNote: "Public tape offline. Paper trading is paused until live market data returns."
		};
		const seen = new Set(cur.seenMints);
		const checkedMints = new Set(cur.checkedMints ?? []);
		const inbox = cur.inbox.slice();
		let added = 0;
		let newlyChecked = 0;
		const latestByMint = new Map(payload.pairs.map((row) => toPublicPair(row)).filter((pair) => pair.priceUsd > 0).map((pair) => [pair.mint, pair]));
		for (const pair of latestByMint.values()) {
			const queued = inbox.findIndex((item) => item.mint === pair.mint);
			if (queued >= 0) inbox[queued] = pair;
			const wasChecked = checkedMints.has(pair.mint);
			const checkedNow = payload.pairs.find((row) => row.mint === pair.mint)?.safetyChecked === true;
			if (checkedNow) checkedMints.add(pair.mint);
			const isNew = !seen.has(pair.mint);
			const isNewlyChecked = checkedNow && !wasChecked && queued < 0 && !isNew;
			if (isNew || isNewlyChecked) {
				seen.add(pair.mint);
				inbox.push(pair);
				if (isNewlyChecked) newlyChecked += 1;
				if (isNew) added += 1;
			}
		}
		const opens = cur.opens.map((position) => {
			const latest = latestByMint.get(position.mint);
			return latest ? {
				...position,
				price: latest.priceUsd,
				template: latest
			} : position;
		});
		const note = added > 0 || newlyChecked > 0 ? `Live market data. ${added} new listings and ${newlyChecked} RugCheck retries queued. Scorp creator history is checked when indexed; unknown remains blocked.` : `Live market data refreshed. RugCheck screens candidates; Scorp creator history is required for paper fills. Unknown remains blocked.`;
		return {
			...cur,
			opens,
			publicTape: "live",
			scanState: "live",
			marketUpdatedAt: Date.now(),
			marketScanned: payload.scanned,
			marketDropped: payload.dropped,
			marketCandidates: payload.pairs,
			tapeNote: note,
			inbox: inbox.slice(0, 30),
			seenMints: [...seen].slice(-400),
			checkedMints: [...checkedMints].slice(-400)
		};
	}),
	markPaperPrices: (prices) => set((cur) => ({ opens: cur.opens.map((position) => {
		const price = prices[position.mint];
		return Number.isFinite(price) && price > 0 ? {
			...position,
			price
		} : position;
	}) })),
	saveWatch: (address, snapshot) => set({
		watchAddress: address,
		watch: snapshot
	}),
	clearWatch: () => set({
		watchAddress: "",
		watch: null
	})
}), {
	name: "keel-desk-v1",
	version: 3,
	migrate: (persisted) => {
		const old = persisted && typeof persisted === "object" ? persisted : {};
		return {
			...createDesk(),
			watchAddress: typeof old.watchAddress === "string" ? old.watchAddress : "",
			watch: old.watch ?? null
		};
	},
	skipHydration: true,
	storage: createJSONStorage(() => safeStorage$1),
	partialize: (state) => {
		const { tick: _tick, toggleRun: _toggleRun, startNight: _startNight, openRecap: _openRecap, closeRecap: _closeRecap, setArmOpen: _setArmOpen, armShadow: _armShadow, setPaper: _setPaper, reset: _reset, ingestPublic: _ingestPublic, stagePublicCandidates: _stagePublicCandidates, setScanState: _setScanState, markPaperPrices: _markPaperPrices, saveWatch: _saveWatch, clearWatch: _clearWatch, liveEvent: _liveEvent, ...data } = state;
		return data;
	}
}));
function bootDesk() {
	const current = useDesk.getState();
	if (typeof current.watchAddress !== "string") useDesk.setState({
		watchAddress: "",
		watch: current.watch ?? null
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var KILL_LABEL = {
	unverified: "Public print, gates unproven",
	mint: "Mint authority still live",
	lp: "LP not locked",
	holders: "Top 10 over 20%",
	volume: `1h volume under ${PAPER_MIN_VOL / 1e3}k`,
	dev: "Dev tied to a prior rug",
	venue: "Outside Pump.fun / Raydium"
};
var AUDIT = [
	"Mint revoked before every fill",
	"LP locked before every fill",
	"Top 10 at or under 20%",
	`1h volume at least $${PAPER_MIN_VOL / 1e3}k`,
	"Dev wallet clean of prior rugs",
	`Paper score at least ${PAPER_MIN_SCORE.toFixed(2)}`,
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
					" scored under ",
					PAPER_MIN_SCORE.toFixed(2),
					" · ",
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
function short$1(value) {
	if (value.length <= 12) return value;
	return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
function qty(n) {
	const abs = Math.abs(n);
	if (abs >= 0xe8d4a51000) return `${(n / 0xe8d4a51000).toFixed(2)}T`;
	if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
	if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
	if (abs >= 1) return n.toFixed(2);
	if (abs === 0) return "0";
	return n.toPrecision(2);
}
function ago(t) {
	const seconds = Math.max(0, Math.round((Date.now() - t) / 1e3));
	if (seconds < 15) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	return `${Math.round(seconds / 60)}m ago`;
}
function markValue(fill) {
	return fill.qty * fill.price;
}
function pnlOf(fill) {
	return markValue(fill) * .997 - fill.sizeUsd;
}
function WalletButton() {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => setOpen(true),
		className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, {
			className: "size-4",
			"aria-hidden": "true"
		}), "Wallet"]
	}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletSheet, { onClose: () => setOpen(false) }) : null] });
}
function WalletSheet({ onClose }) {
	const cash = useDesk((s) => s.cash);
	const opens = useDesk((s) => s.opens);
	const closed = useDesk((s) => s.closed);
	const startCash = useDesk((s) => s.startCash);
	const watchAddress = useDesk((s) => s.watchAddress) ?? "";
	const watch = useDesk((s) => s.watch) ?? null;
	const saveWatch = useDesk((s) => s.saveWatch);
	const clearWatch = useDesk((s) => s.clearWatch);
	const [draft, setDraft] = (0, import_react.useState)(watchAddress);
	const [pending, setPending] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const equity = equityOf({
		cash,
		opens
	});
	const delta = startCash ? (equity - startCash) / startCash : 0;
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	async function load(address) {
		const next = address.trim();
		if (!isSolanaAddress(next)) {
			setError("That is not a Solana address.");
			return;
		}
		setPending(true);
		setError(null);
		try {
			const result = await fetchWallet({ data: { address: next } });
			if (!result.ok || !result.snapshot) {
				setError(result.error ?? "The chain did not answer.");
				return;
			}
			saveWatch(next, result.snapshot);
			setDraft(next);
		} catch {
			setError("The chain did not answer.");
		} finally {
			setPending(false);
		}
	}
	const moves = [...opens.map((fill) => ({
		id: fill.id,
		t: fill.openedAt,
		symbol: fill.symbol,
		side: "Buy",
		usd: fill.sizeUsd
	})), ...closed.map((fill) => ({
		id: `${fill.id}-out`,
		t: fill.closedAt ?? fill.openedAt,
		symbol: fill.symbol,
		side: "Sell",
		usd: fill.pnlUsd ?? 0
	}))].sort((a, b) => b.t - a.t).slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-bg/80 sm:items-center sm:p-4",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "wallet-title",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex max-h-svh w-full max-w-lg flex-col overflow-hidden border border-line bg-surface sm:max-h-[85svh] sm:rounded-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-amber",
						children: "WALLET"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "wallet-title",
						className: "text-lg font-medium",
						children: "Paper book, public watch"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "This book is simulated. Chain autotrade is under Live."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: "inline-flex size-11 items-center justify-center rounded-md border border-line",
					"aria-label": "Close wallet",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
						className: "size-4",
						"aria-hidden": "true"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "scroll min-h-0 flex-1 overflow-y-auto px-4 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium",
						children: "Paper book"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-dim",
						children: "Cash and names the agents already hold. Not an on-chain wallet. Do not send funds here."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-line bg-bg px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "Balance"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "num font-mono text-lg",
									children: money(equity)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: cn("num font-mono text-xs", delta >= 0 ? "text-up" : "text-down"),
									children: [pct(delta), " session"]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-line bg-bg px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "Cash"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "num font-mono text-lg",
									children: money(cash)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "Undeployed"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3",
						children: opens.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "border-t border-line py-3 text-sm text-muted",
							children: "Flat. Cash is the whole book."
						}) : opens.map((fill) => {
							const pnl = pnlOf(fill);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-baseline justify-between gap-3 border-t border-line py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-mono text-sm",
										children: [fill.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-2 text-xs text-dim",
											children: fill.venue
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted",
										children: [
											qty(fill.qty),
											" · ",
											pxPrice(fill.price)
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "num font-mono text-sm",
										children: money(markValue(fill))
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: cn("num font-mono text-xs", pnl >= 0 ? "text-up" : "text-down"),
										children: money(pnl)
									})]
								})]
							}, fill.id);
						})
					}),
					moves.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Recent paper fills"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: moves.map((move) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-baseline justify-between gap-3 border-t border-line py-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: move.side === "Buy" ? "text-up" : "text-down",
								children: move.side
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 font-mono",
								children: move.symbol
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num font-mono text-muted",
								children: money(move.usd)
							})]
						}, move.id)) })]
					}) : null
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-6 border-t border-line pt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Watch a public address"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-dim",
							children: "Paste a Solana address. Balances are read from the chain. No connect, no signature."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "mt-3 flex flex-col gap-2 sm:flex-row",
							onSubmit: (event) => {
								event.preventDefault();
								load(draft);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sr-only",
									children: "Solana address"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: draft,
									onChange: (event) => setDraft(event.target.value),
									placeholder: "Public address",
									spellCheck: false,
									autoCapitalize: "off",
									autoCorrect: "off",
									className: "w-full min-h-11 rounded-md border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: pending,
								className: "inline-flex min-h-11 items-center justify-center rounded-md bg-up px-4 text-sm font-medium text-ink disabled:opacity-60",
								children: pending ? "Reading" : "Watch"
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-down",
							children: error
						}) : null,
						watch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchView, {
							snapshot: watch,
							pending,
							onRefresh: () => void load(watch.address),
							onClear: clearWatch
						}) : null
					]
				})]
			})]
		})
	});
}
function WatchView({ snapshot, pending, onRefresh, onClear }) {
	const priced = snapshot.tokens.filter((row) => row.usd !== null && row.usd >= .01);
	const rows = priced.length > 0 ? priced.slice(0, 8) : snapshot.tokens.slice(0, 8);
	const hidden = snapshot.tokens.length - rows.length;
	const total = (snapshot.solUsd ?? 0) + rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
	const hasMark = snapshot.solUsd !== null || rows.some((row) => row.usd !== null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate font-mono text-sm",
						title: snapshot.address,
						children: short$1(snapshot.address)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-dim",
						children: ["Read ", ago(snapshot.fetchedAt)]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onRefresh,
						disabled: pending,
						className: "inline-flex size-11 items-center justify-center rounded-md border border-line disabled:opacity-60",
						"aria-label": "Refresh balances",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
							className: cn("size-4", pending && "keel-pulse"),
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClear,
						className: "inline-flex min-h-11 items-center rounded-md px-2 text-sm text-dim",
						children: "Clear"
					})]
				})]
			}),
			hasMark ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "num mt-2 font-mono text-lg",
				children: [money(total), " marked"]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline justify-between gap-3 border-t border-line py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-sm",
							children: "SOL"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: qty(snapshot.sol)
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "num font-mono text-sm",
							children: snapshot.solUsd === null ? "—" : money(snapshot.solUsd)
						})]
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "border-t border-line py-3 text-sm text-muted",
						children: "No token balances on this address."
					}) : rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline justify-between gap-3 border-t border-line py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-sm",
								children: row.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-xs text-muted",
								children: qty(row.amount)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "num font-mono text-sm",
							children: row.usd === null ? "—" : money(row.usd)
						})]
					}, row.mint)),
					hidden > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "border-t border-line py-2 text-xs text-dim",
						children: [hidden, " unmarked tokens left off the list."]
					}) : null
				]
			})
		]
	});
}
var fetchPublicTape = createServerFn({ method: "GET" }).handler(createSsrRpc("1c636824bf6aa89498ed10efb134f011b2de42d34dcbdd2c82d81397403c4021"));
var fetchMintPair = createServerFn({ method: "POST" }).validator((input) => {
	const mint = input.mint.trim();
	if (!isSolanaAddress(mint)) throw new Error("Enter a valid Solana token mint.");
	return { mint };
}).handler(createSsrRpc("95b83212ba7cd0bdc4228835993334a11869eea06f17da257208de2c40d33e68"));
createServerFn({ method: "GET" }).handler(createSsrRpc("9015dfc2b42a77dfa0e991bd53867dd5da5cc59e5ba3b0308534bd7af6983b5f"));
var screenMint = createServerFn({ method: "POST" }).validator((input) => {
	const mint = input.mint.trim();
	if (!isSolanaAddress(mint)) throw new Error("Bad mint.");
	return {
		mint,
		venue: input.venue === "raydium" ? "raydium" : "pump.fun",
		includeCreatorHistory: input.includeCreatorHistory === true
	};
}).handler(createSsrRpc("9bdd83570495a606c75c52654410c30d3765b8a71b83eb441dafa59c5287409f"));
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
}).handler(createSsrRpc("b844cec9e490ad7e10c5ec7cd3578e30da109cb9b6d16b08c74637a8c5555432"));
var tokenHolding = createServerFn({ method: "POST" }).validator((input) => {
	const owner = input.owner.trim();
	const mint = input.mint.trim();
	if (!isSolanaAddress(owner) || !isSolanaAddress(mint)) throw new Error("Bad address.");
	return {
		owner,
		mint
	};
}).handler(createSsrRpc("47caa6a4c74078c749027d978275dc04f3f822091deb09dbb78c900f65d02a31"));
var markPrices = createServerFn({ method: "POST" }).validator((input) => {
	const mints = input.mints.map((mint) => mint.trim()).filter((mint) => isSolanaAddress(mint)).slice(0, 20);
	return { mints: [.../* @__PURE__ */ new Set([SOL_MINT, ...mints])] };
}).handler(createSsrRpc("170417f8ce0740f3ba0c5618827e32f2b773af9ddff0765a041d6402e1129f41"));
var latestBlockhash = createServerFn({ method: "GET" }).handler(createSsrRpc("ebfb502f5fe75170e615efb1db080b9eaac1a69207a0acc8bf63af57550dd7f5"));
var confirmSig = createServerFn({ method: "POST" }).validator((input) => {
	const signature = input.signature.trim();
	if (!/^[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(signature)) throw new Error("Bad signature.");
	return { signature };
}).handler(createSsrRpc("ab91eb722dd2569fbc33afec2afcf489587017b3e6cd3ccaec1fcbcc356dfe06"));
var sendRaw = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input.raw.trim();
	if (raw.length < 32 || raw.length > 8e3) throw new Error("Bad transaction.");
	return { raw };
}).handler(createSsrRpc("fa8dcb9292572793e25f4bcdc29fd37cc2f90ac65fd625f41294f8f87bec147b"));
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
function today() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function initial() {
	return {
		armed: false,
		signer: "desk",
		phantom: "",
		deskPubkey: "",
		solPerTrade: .05,
		slippageBps: 150,
		maxPositions: 2,
		dailyLossSol: .2,
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
		exitMints: []
	};
}
var useLive = create()(persist((set) => ({
	...initial(),
	patch: (partial) => set(partial),
	pushOrder: (order) => set((state) => ({ orders: [order, ...state.orders].slice(0, 40) })),
	remember: (mint) => set((state) => ({ seen: state.seen.includes(mint) ? state.seen : [...state.seen, mint].slice(-400) }))
}), {
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
		solUsd: state.solUsd
	})
}));
function activeAddress(state) {
	return state.signer === "desk" ? state.deskPubkey : state.phantom;
}
function dayStamp() {
	return today();
}
var SECRET_KEY = "keel-live-secret";
function browserWindow() {
	if (typeof window === "undefined") return null;
	return window;
}
function getProvider() {
	const w = browserWindow();
	if (!w) return null;
	if (w.solana?.isPhantom) return w.solana;
	if (w.solflare?.connect) return w.solflare;
	if (w.solana?.connect) return w.solana;
	return null;
}
function readSecret() {
	if (typeof window === "undefined") return null;
	const value = window.localStorage.getItem(SECRET_KEY);
	return value && value.length > 20 ? value : null;
}
function writeSecret(value) {
	if (typeof window === "undefined") return;
	if (value) window.localStorage.setItem(SECRET_KEY, value);
	else window.localStorage.removeItem(SECRET_KEY);
}
function bytesToBase64(bytes) {
	let binary = "";
	const chunk = 32768;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(binary);
}
function b64ToBytes(value) {
	const binary = atob(value);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
	return out;
}
function sigOf(result) {
	if (typeof result === "string" && result.length > 20) return result;
	if (result && typeof result === "object" && "signature" in result) return String(result.signature);
	throw new Error("The wallet did not return a signature.");
}
async function keypairFromSecret(secret) {
	const { Keypair } = await import("../_libs/@solana/web3.js.mjs").then((n) => n.t);
	const bytes = (await import("../_libs/bs58.mjs").then((n) => n.t)).default.decode(secret.trim());
	if (bytes.length === 64) return Keypair.fromSecretKey(Uint8Array.from(bytes));
	if (bytes.length === 32) return Keypair.fromSeed(Uint8Array.from(bytes));
	throw new Error("That is not a Solana secret key.");
}
async function createDeskKey() {
	const { Keypair } = await import("../_libs/@solana/web3.js.mjs").then((n) => n.t);
	const bs58 = (await import("../_libs/bs58.mjs").then((n) => n.t)).default;
	const kp = Keypair.generate();
	writeSecret(bs58.encode(Uint8Array.from(kp.secretKey)));
	const pub = kp.publicKey.toBase58();
	useLive.getState().patch({
		deskPubkey: pub,
		signer: "desk"
	});
	return pub;
}
async function importDeskKey(secret) {
	const kp = await keypairFromSecret(secret);
	const bs58 = (await import("../_libs/bs58.mjs").then((n) => n.t)).default;
	writeSecret(bs58.encode(Uint8Array.from(kp.secretKey)));
	const pub = kp.publicKey.toBase58();
	useLive.getState().patch({
		deskPubkey: pub,
		signer: "desk"
	});
	return pub;
}
function forgetDeskKey() {
	writeSecret(null);
	const state = useLive.getState();
	state.patch({
		deskPubkey: "",
		armed: state.signer === "desk" ? false : state.armed,
		status: state.signer === "desk" ? "Desk key removed. Live is off." : state.status
	});
}
async function bootLive() {
	if (useLive.persist.hasHydrated()) {} else await useLive.persist.rehydrate();
	const secret = readSecret();
	if (!secret) {
		const state = useLive.getState();
		state.patch({
			deskPubkey: "",
			armed: state.signer === "desk" ? false : state.armed
		});
		return;
	}
	try {
		const kp = await keypairFromSecret(secret);
		useLive.getState().patch({ deskPubkey: kp.publicKey.toBase58() });
	} catch {
		forgetDeskKey();
	}
}
async function connectPhantom() {
	const provider = getProvider();
	if (!provider) throw new Error("No Solana wallet in this browser. Use a desk key, or open KEEL in Phantom's browser.");
	const pub = (await provider.connect()).publicKey?.toString() || provider.publicKey?.toString() || "";
	if (!pub) throw new Error("The wallet did not share an address.");
	useLive.getState().patch({ phantom: pub });
	return pub;
}
async function reconnectPhantom() {
	const provider = getProvider();
	if (!provider) return;
	try {
		const pub = (await provider.connect({ onlyIfTrusted: true })).publicKey?.toString() || provider.publicKey?.toString() || "";
		if (pub) useLive.getState().patch({ phantom: pub });
	} catch {}
}
async function signAndSend(txB64) {
	const state = useLive.getState();
	if (state.signer === "phantom") {
		const provider = getProvider();
		if (!provider || !state.phantom) return {
			ok: false,
			signature: null,
			error: "Connect a wallet before live signs."
		};
		const { VersionedTransaction } = await import("../_libs/@solana/web3.js.mjs").then((n) => n.t);
		const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
		try {
			if (provider.signAndSendTransaction) return confirmSig({ data: { signature: sigOf(await provider.signAndSendTransaction(tx)) } });
			if (provider.signTransaction) return sendRaw({ data: { raw: bytesToBase64((await provider.signTransaction(tx)).serialize()) } });
			return {
				ok: false,
				signature: null,
				error: "This wallet cannot sign a swap."
			};
		} catch (error) {
			return {
				ok: false,
				signature: null,
				error: (error instanceof Error ? error.message : "The wallet refused the swap.").slice(0, 180)
			};
		}
	}
	const secret = readSecret();
	if (!secret) return {
		ok: false,
		signature: null,
		error: "Desk key is missing."
	};
	try {
		const kp = await keypairFromSecret(secret);
		if (kp.publicKey.toBase58() !== state.deskPubkey) return {
			ok: false,
			signature: null,
			error: "Desk key does not match the address on screen."
		};
		const { VersionedTransaction } = await import("../_libs/@solana/web3.js.mjs").then((n) => n.t);
		const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
		tx.sign([kp]);
		return sendRaw({ data: { raw: bytesToBase64(tx.serialize()) } });
	} catch (error) {
		return {
			ok: false,
			signature: null,
			error: (error instanceof Error ? error.message : "Could not sign with the desk key.").slice(0, 180)
		};
	}
}
async function fundDesk(sol) {
	const provider = getProvider();
	const state = useLive.getState();
	if (!provider || !state.phantom) return {
		ok: false,
		signature: null,
		error: "Connect a wallet to fund the desk key."
	};
	if (!state.deskPubkey) return {
		ok: false,
		signature: null,
		error: "Create a desk key first."
	};
	if (!(sol >= .02) || sol > 50) return {
		ok: false,
		signature: null,
		error: "Fund between 0.02 and 50 SOL."
	};
	const hash = await latestBlockhash();
	if (!hash.ok || !hash.blockhash) return {
		ok: false,
		signature: null,
		error: hash.error ?? "No blockhash."
	};
	try {
		const { Transaction, SystemProgram, PublicKey } = await import("../_libs/@solana/web3.js.mjs").then((n) => n.t);
		const from = new PublicKey(state.phantom);
		const to = new PublicKey(state.deskPubkey);
		const tx = new Transaction({
			feePayer: from,
			recentBlockhash: hash.blockhash
		});
		tx.add(SystemProgram.transfer({
			fromPubkey: from,
			toPubkey: to,
			lamports: Math.round(sol * 1e9)
		}));
		if (provider.signAndSendTransaction) return confirmSig({ data: { signature: sigOf(await provider.signAndSendTransaction(tx)) } });
		if (!provider.signTransaction) return {
			ok: false,
			signature: null,
			error: "This wallet cannot send SOL."
		};
		return sendRaw({ data: { raw: bytesToBase64((await provider.signTransaction(tx)).serialize()) } });
	} catch (error) {
		return {
			ok: false,
			signature: null,
			error: (error instanceof Error ? error.message : "Funding was refused.").slice(0, 180)
		};
	}
}
var HARD_STOP = -.06;
var TRAIL_ARM = .12;
var TRAIL_GIVE = .06;
var LOCK_MS = 432e5;
var inflight = null;
function order(partial) {
	return {
		id: `L${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
		t: Date.now(),
		...partial
	};
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function liveSay(agent, kind, symbol, reason, tone, decision) {
	try {
		useDesk.getState().liveEvent(agent, kind, symbol, reason, tone, decision);
	} catch {}
}
async function waitHold(owner, mint, fallbackRaw) {
	for (let i = 0; i < 3; i += 1) {
		const hold = await tokenHolding({ data: {
			owner,
			mint
		} });
		if (hold.ok && hold.raw !== "0") return hold;
		await sleep(1200);
	}
	if (fallbackRaw && fallbackRaw !== "0") return {
		ok: true,
		raw: fallbackRaw,
		ui: 0,
		error: null
	};
	return {
		ok: false,
		raw: "0",
		ui: 0,
		error: "Token balance did not show."
	};
}
async function sell(pos, reason) {
	const state = useLive.getState();
	const owner = activeAddress(state);
	if (!owner) {
		state.pushOrder(order({
			side: "sell",
			symbol: pos.symbol,
			mint: pos.mint,
			signature: null,
			status: "failed",
			reason: "No signer for the sell."
		}));
		return;
	}
	const hold = await tokenHolding({ data: {
		owner,
		mint: pos.mint
	} });
	const raw = hold.ok && hold.raw !== "0" ? hold.raw : pos.tokenRaw;
	if (!raw || raw === "0") {
		useLive.setState((current) => ({ positions: current.positions.filter((row) => row.mint !== pos.mint) }));
		useLive.getState().pushOrder(order({
			side: "sell",
			symbol: pos.symbol,
			mint: pos.mint,
			signature: null,
			status: "skipped",
			reason: "No token balance left."
		}));
		return;
	}
	const built = await buildSwap({ data: {
		user: owner,
		inputMint: pos.mint,
		outputMint: SOL_MINT,
		amount: raw,
		slippageBps: useLive.getState().slippageBps
	} });
	if (!built.ok || !built.tx) {
		useLive.getState().pushOrder(order({
			side: "sell",
			symbol: pos.symbol,
			mint: pos.mint,
			signature: null,
			status: "failed",
			reason: built.error ?? "No sell route."
		}));
		return;
	}
	const sent = await signAndSend(built.tx);
	if (!sent.ok || !sent.signature) {
		useLive.getState().pushOrder(order({
			side: "sell",
			symbol: pos.symbol,
			mint: pos.mint,
			signature: sent.signature,
			status: "failed",
			reason: sent.error ?? "Sell did not land."
		}));
		return;
	}
	const solOut = built.outAmount ? Number(built.outAmount) / 1e9 : 0;
	const pnlSol = Number.isFinite(solOut) ? solOut - pos.solIn : 0;
	useLive.setState((current) => {
		const dayKey = dayStamp();
		const dayPnlSol = (current.dayKey === dayKey ? current.dayPnlSol : 0) + pnlSol;
		const halted = dayPnlSol <= -current.dailyLossSol ? `Halted. Day loss ${dayPnlSol.toFixed(3)} SOL hit the ${current.dailyLossSol} SOL stop. Exits still run.` : current.halted;
		const locks = pnlSol < 0 ? {
			...current.locks,
			[pos.mint]: Date.now() + LOCK_MS
		} : current.locks;
		return {
			positions: current.positions.filter((row) => row.mint !== pos.mint),
			dayKey,
			dayPnlSol,
			halted,
			locks
		};
	});
	useLive.getState().pushOrder(order({
		side: "sell",
		symbol: pos.symbol,
		mint: pos.mint,
		signature: sent.signature,
		status: "filled",
		reason
	}));
	const isStop = reason.toLowerCase().includes("hard stop");
	const isTrail = reason.toLowerCase().includes("trail");
	liveSay("risk", isStop ? "stop" : isTrail ? "trail" : "note", pos.symbol, `[live] ${reason}`, isStop ? "kill" : "pass", {
		mint: pos.mint,
		outcome: isStop ? "stop" : isTrail ? "trail" : "skip"
	});
	liveSay("logger", "note", pos.symbol, `[live] Logged exit. ${pos.symbol}: ${reason}`, "work");
}
async function buy(pair, sol, note) {
	const state = useLive.getState();
	const owner = activeAddress(state);
	const lamports = Math.floor(sol * 1e9);
	const built = await buildSwap({ data: {
		user: owner,
		inputMint: SOL_MINT,
		outputMint: pair.mint,
		amount: String(lamports),
		slippageBps: state.slippageBps
	} });
	if (!built.ok || !built.tx) {
		state.remember(pair.mint);
		state.pushOrder(order({
			side: "buy",
			symbol: pair.symbol,
			mint: pair.mint,
			signature: null,
			status: "failed",
			reason: built.error ?? "No buy route."
		}));
		liveSay("executor", "skip", pair.symbol, `[live] No buy route for ${pair.symbol}.`, "kill", {
			mint: pair.mint,
			outcome: "skip"
		});
		return;
	}
	const sent = await signAndSend(built.tx);
	if (!sent.ok || !sent.signature) {
		state.remember(pair.mint);
		useLive.getState().pushOrder(order({
			side: "buy",
			symbol: pair.symbol,
			mint: pair.mint,
			signature: sent.signature,
			status: "failed",
			reason: sent.error ?? "Buy did not land."
		}));
		liveSay("executor", "skip", pair.symbol, `[live] Buy did not land for ${pair.symbol}.`, "kill", {
			mint: pair.mint,
			outcome: "skip"
		});
		return;
	}
	const hold = await waitHold(owner, pair.mint, built.outAmount);
	const position = {
		mint: pair.mint,
		symbol: pair.symbol,
		venue: pair.venue,
		solIn: sol,
		tokenRaw: hold.raw,
		tokenUi: hold.ui,
		entryPriceUsd: pair.priceUsd,
		priceUsd: pair.priceUsd,
		openedAt: Date.now(),
		signature: sent.signature,
		peakPnlPct: 0,
		trailArmed: false,
		trailStopPct: null
	};
	useLive.setState((current) => ({ positions: [...current.positions.filter((row) => row.mint !== pair.mint), position] }));
	useLive.getState().remember(pair.mint);
	useLive.getState().pushOrder(order({
		side: "buy",
		symbol: pair.symbol,
		mint: pair.mint,
		signature: sent.signature,
		status: "filled",
		reason: note
	}));
	liveSay("executor", "buy", pair.symbol, `[live] ${note}`, "pass", {
		mint: pair.mint,
		outcome: "buy"
	});
	liveSay("risk", "note", pair.symbol, `[live] Risk armed on ${pair.symbol}. Hard stop −6%. Trail after +12%.`, "work");
	liveSay("logger", "note", pair.symbol, `[live] Logged entry. ${note}`, "pass");
}
async function cycle() {
	const start = useLive.getState();
	if (start.busy) return;
	const owner = activeAddress(start);
	if (!(start.armed || start.positions.length > 0 || start.flatten)) return;
	useLive.getState().patch({ busy: true });
	try {
		if (owner) try {
			const bag = await fetchWallet({ data: { address: owner } });
			if (bag.ok && bag.snapshot) useLive.getState().patch({
				sol: bag.snapshot.sol,
				solUsd: bag.snapshot.solUsd
			});
		} catch {}
		const dayKey = dayStamp();
		if (useLive.getState().dayKey !== dayKey) useLive.getState().patch({
			dayKey,
			dayPnlSol: 0,
			halted: null
		});
		let positions = useLive.getState().positions;
		if (positions.length > 0) {
			const marks = await markPrices({ data: { mints: positions.map((row) => row.mint) } });
			if (marks.ok) {
				if (marks.solUsd !== null) useLive.getState().patch({ solUsd: marks.solUsd });
				positions = positions.map((pos) => {
					const price = marks.prices[pos.mint];
					if (!price || !pos.entryPriceUsd) return pos;
					const pnl = price / pos.entryPriceUsd - 1;
					const peak = Math.max(pos.peakPnlPct, pnl);
					let trailArmed = pos.trailArmed;
					let trailStop = pos.trailStopPct;
					if (!trailArmed && peak >= TRAIL_ARM) {
						trailArmed = true;
						trailStop = peak - TRAIL_GIVE;
						liveSay("risk", "arm", pos.symbol, `[live] Trail armed on ${pos.symbol}. Peak ${(peak * 100).toFixed(1)}%.`, "work");
					} else if (trailArmed && trailStop !== null) {
						const ratcheted = peak - TRAIL_GIVE;
						if (ratcheted > trailStop + .01) trailStop = ratcheted;
					}
					return {
						...pos,
						priceUsd: price,
						peakPnlPct: peak,
						trailArmed,
						trailStopPct: trailStop
					};
				});
				useLive.getState().patch({ positions });
			}
		}
		const forced = new Set(useLive.getState().exitMints);
		const flatten = useLive.getState().flatten;
		useLive.getState().patch({
			exitMints: [],
			flatten: false
		});
		for (const pos of useLive.getState().positions) {
			const pnl = pos.entryPriceUsd > 0 ? pos.priceUsd / pos.entryPriceUsd - 1 : 0;
			const trailHit = pos.trailArmed && pos.trailStopPct !== null && pnl <= pos.trailStopPct;
			const stopHit = pnl <= HARD_STOP;
			if (flatten || forced.has(pos.mint) || stopHit || trailHit) await sell(pos, flatten || forced.has(pos.mint) ? `Flat ${pos.symbol}. Sold back to SOL.` : stopHit ? `Hard stop. ${pos.symbol} marked ${(pnl * 100).toFixed(1)}%.` : `Trail stop. ${pos.symbol} marked ${(pnl * 100).toFixed(1)}%.`);
		}
		const now = useLive.getState();
		if (!now.armed || now.halted || !owner) {
			now.patch({ status: !owner ? "No signer address." : now.halted ? now.halted : now.positions.length ? `Disarmed. Still watching ${now.positions.length} chain name${now.positions.length === 1 ? "" : "s"} for stops.` : "Disarmed. Paper still runs." });
			return;
		}
		const tape = await fetchPublicTape();
		if (!tape.ok) {
			useLive.getState().patch({ status: "Public tape offline. No new buys." });
			liveSay("scout", "note", null, "[live] Public tape offline. No new buys.", "kill");
			return;
		}
		liveSay("scout", "scan", null, `[live] Scout watching public tape. ${tape.pairs.length} candidates.`, "work");
		const openMints = new Set(useLive.getState().positions.map((row) => row.mint));
		const seen = new Set(useLive.getState().seen);
		const locks = useLive.getState().locks;
		let held = 0;
		let scanned = 0;
		for (const pair of tape.pairs) {
			scanned += 1;
			if (openMints.has(pair.mint) || seen.has(pair.mint)) continue;
			if ((locks[pair.mint] ?? 0) > Date.now()) {
				held += 1;
				continue;
			}
			const track = isBreakoutCandidate(pair) ? "breakout" : "new";
			liveSay("scout", "scan", pair.symbol, `[live] Saw ${pair.symbol} on ${pair.venue} (${track} track, age ${pair.ageMin.toFixed(0)}m). Handing to Filter.`, "work");
			const block = tapeBlock(pair);
			if (block) {
				if (!isSoftTapeBlock(block)) useLive.getState().remember(pair.mint);
				liveSay("filter", "kill", pair.symbol, `[live] ${block}`, "kill", {
					mint: pair.mint,
					outcome: "kill"
				});
				liveSay("logger", "note", pair.symbol, `[live] Logged rejection. ${block}`, "work");
				continue;
			}
			if (useLive.getState().positions.length >= useLive.getState().maxPositions) {
				useLive.getState().patch({ status: `Book is full (${useLive.getState().maxPositions}). No new buys.` });
				return;
			}
			const screen = await screenMint({ data: {
				mint: pair.mint,
				venue: pair.venue,
				includeCreatorHistory: true
			} });
			if (!screen.ok) {
				if (!screen.reason.includes("rate")) useLive.getState().remember(pair.mint);
				useLive.getState().pushOrder(order({
					side: "buy",
					symbol: pair.symbol,
					mint: pair.mint,
					signature: null,
					status: "skipped",
					reason: screen.reason
				}));
				liveSay("filter", "kill", pair.symbol, `[live] ${screen.reason}`, "kill", {
					mint: pair.mint,
					outcome: "kill"
				});
				liveSay("logger", "note", pair.symbol, `[live] Logged rejection. ${screen.reason}`, "work");
				continue;
			}
			if (!screen.creator || !screen.creatorHistoryAvailable || screen.devPriorRugs === null) {
				const reason = screen.creator ? `Creator ${screen.creator} has no indexed Scorp history or the lookup failed. Unknown is not clean; rejected.` : "Creator address is missing. Rejected.";
				useLive.getState().remember(pair.mint);
				useLive.getState().pushOrder(order({
					side: "buy",
					symbol: pair.symbol,
					mint: pair.mint,
					signature: null,
					status: "skipped",
					reason
				}));
				liveSay("filter", "kill", pair.symbol, `[live] ${reason}`, "kill", {
					mint: pair.mint,
					outcome: "kill"
				});
				liveSay("logger", "note", pair.symbol, `[live] Logged rejection. ${reason}`, "work");
				continue;
			}
			if (screen.devPriorRugs > 0) {
				const noun = screen.devPriorRugs === 1 ? "rug" : "rugs";
				const reason = `Dev ${screen.creator} is connected to ${screen.devPriorRugs} prior ${noun}. Rejected.`;
				useLive.getState().remember(pair.mint);
				useLive.getState().pushOrder(order({
					side: "buy",
					symbol: pair.symbol,
					mint: pair.mint,
					signature: null,
					status: "skipped",
					reason
				}));
				liveSay("filter", "kill", pair.symbol, `[live] ${reason}`, "kill", {
					mint: pair.mint,
					outcome: "kill"
				});
				liveSay("logger", "note", pair.symbol, `[live] Logged rejection. ${reason}`, "work");
				continue;
			}
			if (pair.venue === "raydium" && screen.lpLockedPct !== null && screen.lpLockedPct < 80) {
				const reason = `LP lock is ${screen.lpLockedPct.toFixed(0)}% (need 80%). Rejected.`;
				useLive.getState().remember(pair.mint);
				useLive.getState().pushOrder(order({
					side: "buy",
					symbol: pair.symbol,
					mint: pair.mint,
					signature: null,
					status: "skipped",
					reason
				}));
				liveSay("filter", "kill", pair.symbol, `[live] ${reason}`, "kill", {
					mint: pair.mint,
					outcome: "kill"
				});
				continue;
			}
			const trackNote = isBreakoutCandidate(pair) ? "Breakout track cleared (age > 180m, elevated vol/liq)." : "New-pair track cleared.";
			liveSay("filter", "pass", pair.symbol, `[live] ${trackNote} Scorp creator history clean. Handing to Analyst.`, "pass");
			const score = liveScore(pair, screen.top10);
			if (score < .45) {
				const scoreMsg = `Score ${score.toFixed(2)} under ${MIN_LIVE_SCORE.toFixed(2)}.`;
				useLive.getState().pushOrder(order({
					side: "buy",
					symbol: pair.symbol,
					mint: pair.mint,
					signature: null,
					status: "skipped",
					reason: scoreMsg
				}));
				liveSay("analyst", "reject", pair.symbol, `[live] ${scoreMsg} (soft — may revisit).`, "kill", {
					mint: pair.mint,
					outcome: "reject"
				});
				liveSay("logger", "note", pair.symbol, `[live] Logged rejection. ${scoreMsg}`, "work");
				continue;
			}
			liveSay("analyst", "score", pair.symbol, `[live] Score ${score.toFixed(2)}. Cleared. Handing to Executor.`, "pass");
			const balance = useLive.getState().sol ?? 0;
			const size = ticketSol(balance, useLive.getState().solPerTrade);
			if (size < .01) {
				useLive.getState().patch({ status: `Balance ${balance.toFixed(3)} SOL cannot fund a ticket inside the 8% cap and 0.02 SOL reserve.` });
				return;
			}
			const note = `Bought ${size.toFixed(3)} SOL of ${pair.symbol} (${track}). Score ${score.toFixed(2)}. Cap ${(MAX_PCT$1 * 100).toFixed(0)}%. ${screen.reason}`;
			await buy(pair, size, note);
			useLive.getState().patch({ status: note });
			return;
		}
		useLive.getState().patch({ status: `Watching. Scanned ${scanned}. ${held} revenge-locked. Nothing cleared.` });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Live cycle failed.";
		useLive.getState().patch({ status: message.slice(0, 180) });
	} finally {
		useLive.getState().patch({ busy: false });
	}
}
function runLiveCycle() {
	if (inflight) return inflight;
	inflight = cycle().finally(() => {
		inflight = null;
	});
	return inflight;
}
function requestFlatten() {
	useLive.getState().patch({ flatten: true });
	runLiveCycle();
}
function requestSell(mint) {
	const state = useLive.getState();
	if (!state.exitMints.includes(mint)) state.patch({ exitMints: [...state.exitMints, mint] });
	runLiveCycle();
}
var field = "w-full min-h-11 rounded-md border border-line bg-bg px-3 font-mono text-sm text-fg placeholder:text-dim";
var USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function short(value) {
	if (value.length <= 12) return value;
	return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
function clock(t) {
	return new Date(t).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function LiveButton() {
	const [open, setOpen] = (0, import_react.useState)(false);
	const armed = useLive((s) => s.armed);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => setOpen(true),
		className: cn("inline-flex min-h-11 items-center rounded-md px-3 text-sm", armed ? "bg-amber font-medium text-ink" : "border border-line text-muted"),
		children: armed ? "Live on" : "Live"
	}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveSheet, { onClose: () => setOpen(false) }) : null] });
}
function LiveSheet({ onClose }) {
	const armed = useLive((s) => s.armed);
	const signer = useLive((s) => s.signer);
	const phantom = useLive((s) => s.phantom);
	const deskPubkey = useLive((s) => s.deskPubkey);
	const solPerTrade = useLive((s) => s.solPerTrade);
	const slippageBps = useLive((s) => s.slippageBps);
	const maxPositions = useLive((s) => s.maxPositions);
	const dailyLossSol = useLive((s) => s.dailyLossSol);
	const sol = useLive((s) => s.sol);
	const dayPnlSol = useLive((s) => s.dayPnlSol);
	const halted = useLive((s) => s.halted);
	const status = useLive((s) => s.status);
	const busy = useLive((s) => s.busy);
	const positions = useLive((s) => s.positions);
	const orders = useLive((s) => s.orders);
	const patch = useLive((s) => s.patch);
	const armShadow = useDesk((s) => s.armShadow);
	const [phrase, setPhrase] = (0, import_react.useState)("");
	const [secretDraft, setSecretDraft] = (0, import_react.useState)("");
	const [fund, setFund] = (0, import_react.useState)("0.1");
	const [ticket, setTicket] = (0, import_react.useState)(String(solPerTrade));
	const [slip, setSlip] = (0, import_react.useState)(String(slippageBps));
	const [names, setNames] = (0, import_react.useState)(String(maxPositions));
	const [loss, setLoss] = (0, import_react.useState)(String(dailyLossSol));
	const [revealed, setRevealed] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [pending, setPending] = (0, import_react.useState)(false);
	const [previewMint, setPreviewMint] = (0, import_react.useState)(USDC_MINT);
	const [previewSol, setPreviewSol] = (0, import_react.useState)("0.01");
	const [previewBusy, setPreviewBusy] = (0, import_react.useState)(false);
	const [previewError, setPreviewError] = (0, import_react.useState)(null);
	const [previewResult, setPreviewResult] = (0, import_react.useState)(null);
	const hasExtension = typeof window !== "undefined" && getProvider() !== null;
	const address = activeAddress({
		signer,
		phantom,
		deskPubkey
	});
	const nextTicket = sol === null ? null : ticketSol(sol, solPerTrade);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	async function run(task) {
		setPending(true);
		setError(null);
		setNotice(null);
		try {
			await task();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "That did not complete.");
		} finally {
			setPending(false);
		}
	}
	async function copy(value) {
		try {
			await navigator.clipboard.writeText(value);
			setNotice("Copied.");
		} catch {
			setError("Copy failed. Select the address instead.");
		}
	}
	async function buildPreview(event) {
		event.preventDefault();
		setPreviewError(null);
		setPreviewResult(null);
		if (armed || positions.length > 0 || busy) {
			setPreviewError("Disarm Live and close any chain positions before previewing; live position management can submit swaps.");
			return;
		}
		const amountSol = Number(previewSol);
		const outputMint = previewMint.trim();
		if (!phantom) {
			setPreviewError("Connect a wallet first. The preview uses its public address only.");
			return;
		}
		if (outputMint.length < 32 || outputMint.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(outputMint)) {
			setPreviewError("Enter a valid Solana token mint.");
			return;
		}
		if (outputMint === "So11111111111111111111111111111111111111112") {
			setPreviewError("Choose a token mint different from wrapped SOL.");
			return;
		}
		if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > .1) {
			setPreviewError("Use an amount greater than 0 and no more than 0.1 SOL.");
			return;
		}
		setPreviewBusy(true);
		try {
			const built = await buildSwap({ data: {
				user: phantom,
				inputMint: SOL_MINT,
				outputMint,
				amount: String(Math.floor(amountSol * 1e9)),
				slippageBps
			} });
			if (!built.ok || !built.tx || !built.outAmount) {
				setPreviewError(built.error ?? "Jupiter did not build an unsigned transaction.");
				return;
			}
			setPreviewResult({
				wallet: phantom,
				outputMint,
				solIn: amountSol,
				outAmount: built.outAmount,
				impact: built.impact,
				builtAt: Date.now()
			});
			built.tx = null;
		} catch (caught) {
			setPreviewError(caught instanceof Error ? caught.message : "The preview could not be built.");
		} finally {
			setPreviewBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/80 sm:items-center sm:p-4",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "live-title",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex max-h-svh w-full max-w-lg flex-col overflow-hidden border border-line bg-surface sm:max-h-[85svh] sm:rounded-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-amber",
						children: "LIVE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "live-title",
						className: "text-lg font-medium",
						children: "Autotrade on Solana"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Paper keeps its own book. Live signs Jupiter swaps only after you arm it."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: "inline-flex size-11 items-center justify-center rounded-md border border-line",
					"aria-label": "Close live",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
						className: "size-4",
						"aria-hidden": "true"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "scroll min-h-0 flex-1 overflow-y-auto px-4 py-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Signer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-dim",
							children: "Desk key stays in this browser and signs without a popup. A connected wallet signs each swap unless that wallet auto-approves KEEL. Never fund more than you can lose."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => patch({ signer: "desk" }),
								className: cn("min-h-11 rounded-md border px-3 text-sm", signer === "desk" ? "border-amber text-amber" : "border-line text-muted"),
								children: "Desk key"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => patch({ signer: "phantom" }),
								className: cn("min-h-11 rounded-md border px-3 text-sm", signer === "phantom" ? "border-amber text-amber" : "border-line text-muted"),
								children: "Connected wallet"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-md border border-line bg-bg px-3 py-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
										className: "size-4 text-amber",
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Desk key" })]
								}),
								deskPubkey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 break-all font-mono text-xs",
									children: deskPubkey
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: "No desk key yet."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-wrap gap-2",
									children: [
										deskPubkey ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => void copy(deskPubkey),
											className: "inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
												className: "size-4",
												"aria-hidden": "true"
											}), "Copy"]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: pending,
											onClick: () => void run(async () => void await createDeskKey()),
											className: "inline-flex min-h-11 items-center rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60",
											children: "Create desk key"
										}),
										deskPubkey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setRevealed(revealed ? null : readSecret()),
											className: "inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm",
											children: revealed ? "Hide secret" : "Reveal secret"
										}) : null,
										deskPubkey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												forgetDeskKey();
												setRevealed(null);
											},
											className: "inline-flex min-h-11 items-center rounded-md px-3 text-sm text-down",
											children: "Forget key"
										}) : null
									]
								}),
								revealed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 break-all font-mono text-xs text-amber",
									children: revealed
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-3 flex flex-col gap-2",
									onSubmit: (event) => {
										event.preventDefault();
										run(async () => {
											await importDeskKey(secretDraft);
											setSecretDraft("");
											setNotice("Desk key imported. It stays in this browser.");
										});
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "text-xs text-muted",
										children: ["Import a trading secret (base58). It is not sent to a server.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											value: secretDraft,
											onChange: (event) => setSecretDraft(event.target.value),
											spellCheck: false,
											rows: 2,
											className: cn(field, "mt-1"),
											placeholder: "Base58 secret"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: pending || secretDraft.trim().length < 32,
										className: "inline-flex min-h-11 items-center justify-center rounded-md border border-line px-3 text-sm disabled:opacity-60",
										children: "Import"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-md border border-line bg-bg px-3 py-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, {
										className: "size-4",
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Connected wallet" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 font-mono text-xs",
									children: phantom ? phantom : hasExtension ? "Not connected." : "No wallet extension in this window."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 flex flex-wrap gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: pending,
										onClick: () => void run(async () => void await connectPhantom()),
										className: "inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm disabled:opacity-60",
										children: phantom ? "Reconnect" : "Connect"
									})
								}),
								deskPubkey ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-3 flex flex-col gap-2 sm:flex-row",
									onSubmit: (event) => {
										event.preventDefault();
										run(async () => {
											const sent = await fundDesk(Number(fund));
											if (!sent.ok) throw new Error(sent.error ?? "Funding failed.");
											setNotice(sent.signature ? `Funded. ${sent.signature.slice(0, 8)}…` : "Funded.");
											runLiveCycle();
										});
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "min-w-0 flex-1 text-xs text-muted",
										children: ["Send SOL from the connected wallet", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: fund,
											onChange: (event) => setFund(event.target.value),
											inputMode: "decimal",
											className: cn(field, "mt-1")
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: pending || !phantom,
										className: "inline-flex min-h-11 items-center justify-center rounded-md bg-up px-3 text-sm font-medium text-ink disabled:opacity-60 sm:self-end",
										children: "Fund desk"
									})]
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-md border border-line bg-bg px-3 py-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-medium",
									children: "Build-only swap preview"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-dim",
									children: "Uses the connected wallet address to build an unsigned Jupiter transaction, then discards it. No signature or transaction submission occurs here."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-3 flex flex-col gap-2",
									onSubmit: (event) => void buildPreview(event),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs text-muted",
											children: ["Output token mint", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: previewMint,
												onChange: (event) => setPreviewMint(event.target.value),
												spellCheck: false,
												autoCapitalize: "off",
												autoCorrect: "off",
												className: cn(field, "mt-1")
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs text-muted",
											children: ["Input amount (SOL, max 0.1)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: previewSol,
												onChange: (event) => setPreviewSol(event.target.value),
												inputMode: "decimal",
												className: cn(field, "mt-1")
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "submit",
											disabled: !phantom || previewBusy || armed || positions.length > 0 || busy,
											className: "inline-flex min-h-11 items-center justify-center rounded-md border border-line px-3 text-sm disabled:opacity-60",
											children: previewBusy ? "Building preview…" : "Build unsigned preview"
										})
									]
								}),
								!phantom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted",
									children: "Connect a wallet above to enable the wallet-specific preview."
								}) : null,
								armed || positions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-amber",
									children: "Disarm Live and close chain positions before previewing."
								}) : null,
								previewError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-down",
									children: previewError
								}) : null,
								previewResult ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 rounded-md border border-up/40 px-3 py-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "font-medium text-up",
											children: ["Unsigned transaction built and discarded · ", clock(previewResult.builtAt)]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 font-mono text-dim",
											children: ["Wallet ", short(previewResult.wallet)]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 font-mono text-dim",
											children: [
												previewResult.solIn,
												" SOL → ",
												previewResult.outAmount,
												" raw token units"
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 text-dim",
											children: ["Price impact ", previewResult.impact === null ? "unknown" : `${(previewResult.impact * 100).toFixed(3)}%`]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 break-all font-mono text-dim",
											children: ["Mint ", previewResult.outputMint]
										})
									]
								}) : null
							]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-6 border-t border-line pt-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-medium",
								children: "Limits"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-dim",
								children: "Size is the smaller of your ticket and 8% of the signer balance, leaving 0.02 SOL for fees. Hard stop −6%. Trail after +12%."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid grid-cols-2 gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "text-xs text-muted",
										children: ["SOL per trade", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: ticket,
											onChange: (event) => setTicket(event.target.value),
											onBlur: () => {
												const next = clampNum(ticket, .01, 2, solPerTrade);
												patch({ solPerTrade: next });
												setTicket(String(next));
											},
											inputMode: "decimal",
											className: cn(field, "mt-1")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "text-xs text-muted",
										children: ["Slippage bps", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: slip,
											onChange: (event) => setSlip(event.target.value),
											onBlur: () => {
												const next = Math.round(clampNum(slip, 30, 500, slippageBps));
												patch({ slippageBps: next });
												setSlip(String(next));
											},
											inputMode: "numeric",
											className: cn(field, "mt-1")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "text-xs text-muted",
										children: ["Max names", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: names,
											onChange: (event) => setNames(event.target.value),
											onBlur: () => {
												const next = Math.round(clampNum(names, 1, 4, maxPositions));
												patch({ maxPositions: next });
												setNames(String(next));
											},
											inputMode: "numeric",
											className: cn(field, "mt-1")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "text-xs text-muted",
										children: ["Day-loss halt, SOL", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: loss,
											onChange: (event) => setLoss(event.target.value),
											onBlur: () => {
												const next = clampNum(loss, .05, 5, dailyLossSol);
												patch({ dailyLossSol: next });
												setLoss(String(next));
											},
											inputMode: "decimal",
											className: cn(field, "mt-1")
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-md border border-line px-3 py-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-muted",
											children: "Signer balance"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "num font-mono text-lg",
											children: sol === null ? "—" : `${sol.toFixed(3)} SOL`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "truncate font-mono text-xs text-dim",
											children: address ? short(address) : "No signer"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-md border border-line px-3 py-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-muted",
											children: "Next ticket"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "num font-mono text-lg",
											children: nextTicket === null ? "—" : `${nextTicket.toFixed(3)} SOL`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: cn("num font-mono text-xs", dayPnlSol >= 0 ? "text-up" : "text-down"),
											children: [
												"Day ",
												dayPnlSol >= 0 ? "+" : "",
												dayPnlSol.toFixed(3),
												" SOL"
											]
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-6 border-t border-line pt-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-medium",
								children: armed ? "Armed" : "Arm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-fg",
								children: status
							}),
							halted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-down",
								children: halted
							}) : null,
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-down",
								children: error
							}) : null,
							notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-up",
								children: notice
							}) : null,
							armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => patch({
											armed: false,
											status: "Disarmed. Open names stay watched for stops."
										}),
										className: "inline-flex min-h-11 items-center rounded-md border border-amber px-4 text-sm text-amber",
										children: "Disarm"
									}),
									halted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => patch({ halted: null }),
										className: "inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm",
										children: "Clear halt"
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: busy || positions.length === 0,
										onClick: () => requestFlatten(),
										className: "inline-flex min-h-11 items-center rounded-md border border-down px-3 text-sm text-down disabled:opacity-60",
										children: "Flatten"
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "mt-3 flex flex-col gap-2",
								onSubmit: (event) => {
									event.preventDefault();
									if (phrase.trim().toUpperCase() !== "TRADE") {
										setError("Type TRADE to arm.");
										return;
									}
									if (!address) {
										setError("Choose a signer that has an address.");
										return;
									}
									setError(null);
									patch({
										armed: true,
										halted: null,
										status: "Armed. Scanning the public tape."
									});
									runLiveCycle();
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-xs text-muted",
									children: ["Type TRADE to arm live swaps", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: phrase,
										onChange: (event) => setPhrase(event.target.value),
										className: cn(field, "mt-1"),
										autoCapitalize: "characters"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: !address,
									className: "inline-flex min-h-11 items-center justify-center rounded-md bg-amber px-4 text-sm font-medium text-ink disabled:opacity-60",
									children: "Arm live"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									armShadow();
									onClose();
								},
								className: "mt-3 inline-flex min-h-11 items-center text-sm text-dim",
								children: "Rehearse on the shadow book instead"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-6 border-t border-line pt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Chain book"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2",
							children: positions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "border-t border-line py-3 text-sm text-muted",
								children: "Flat on-chain."
							}) : positions.map((pos) => {
								const pnl = pos.entryPriceUsd > 0 ? pos.priceUsd / pos.entryPriceUsd - 1 : 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-3 border-t border-line py-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "font-mono text-sm",
											children: [pos.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-2 text-xs text-dim",
												children: pos.venue
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: cn("num font-mono text-xs", pnl >= 0 ? "text-up" : "text-down"),
											children: [
												pct(pnl),
												" · ",
												pos.solIn.toFixed(3),
												" SOL in"
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => requestSell(pos.mint),
										className: "inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm",
										children: "Sell"
									})]
								}, pos.mint);
							})
						})]
					}),
					orders.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "mt-6 border-t border-line pt-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium",
							children: "Chain log"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: orders.slice(0, 8).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "border-t border-line py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-2 text-xs text-dim",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										clock(row.t),
										" · ",
										row.side,
										" ",
										row.symbol
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: row.status === "filled" ? "text-up" : row.status === "failed" ? "text-down" : "text-amber",
										children: row.status
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-sm text-fg",
									children: row.reason
								}),
								row.signature ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "font-mono text-xs text-amber",
									href: `https://solscan.io/tx/${row.signature}`,
									target: "_blank",
									rel: "noreferrer",
									children: short(row.signature)
								}) : null
							]
						}, row.id)) })]
					}) : null
				]
			})]
		})
	});
}
function clampNum(value, min, max, fallback) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	if (n < min) return min;
	if (n > max) return max;
	return n;
}
var RULES = [
	"Public listings only",
	"Live new: $15k vol / $4k liq",
	"Live breakout: $50k / $10k",
	"Live score ≥ 0.45",
	"RugCheck gates required",
	"Indexed creator history required",
	"Paper fills only",
	"Prices refresh every 20s",
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
		let pulling = false;
		const safetyCache = /* @__PURE__ */ new Map();
		const safetyAttemptAt = /* @__PURE__ */ new Map();
		const pull = async () => {
			if (pulling) return;
			pulling = true;
			useDesk.getState().setScanState("fetching");
			try {
				const res = await fetchPublicTape();
				if (stop) return;
				if (!res.ok) useDesk.getState().ingestPublic(res);
				else {
					useDesk.getState().stagePublicCandidates(res);
					const pairs = [];
					for (let index = 0; index < res.pairs.length; index += 2) {
						const batch = await Promise.all(res.pairs.slice(index, index + 2).map(async (pair) => {
							let safety = safetyCache.get(pair.mint);
							const attemptedAt = safetyAttemptAt.get(pair.mint) ?? 0;
							const retryDue = safety !== void 0 && Date.now() - attemptedAt >= 6e4 && (!safety.reportAvailable || Boolean(safety.creator) && !safety.creatorHistoryAvailable);
							if (!safety || retryDue) {
								safetyAttemptAt.set(pair.mint, Date.now());
								try {
									safety = await screenMint({ data: {
										mint: pair.mint,
										venue: pair.venue,
										includeCreatorHistory: true
									} });
								} catch {
									safety = {
										ok: false,
										reportAvailable: false,
										reason: "RugCheck request failed.",
										mintRevoked: null,
										freezeRevoked: null,
										lpLocked: null,
										top10: null,
										lpLockedPct: null,
										creator: null,
										creatorHistoryAvailable: false,
										creatorTokenCount: null,
										devPriorRugs: null
									};
								}
								safetyCache.set(pair.mint, safety);
							}
							return {
								...pair,
								safetyState: safety?.reportAvailable ? "checked" : safety ? "unavailable" : "checking",
								safetyChecked: safety?.reportAvailable ?? false,
								mintRevoked: safety?.mintRevoked ?? null,
								freezeRevoked: safety?.freezeRevoked ?? null,
								lpLocked: safety?.lpLocked ?? null,
								top10Pct: safety?.top10 ?? null,
								creator: safety?.creator ?? null,
								devPriorRugs: safety?.devPriorRugs ?? null,
								creatorHistoryAvailable: safety?.creatorHistoryAvailable ?? false,
								creatorTokenCount: safety?.creatorTokenCount ?? null,
								safetyReason: safety?.ok ? null : safety?.reason ?? "RugCheck report unavailable."
							};
						}));
						pairs.push(...batch);
						if (stop) return;
					}
					useDesk.getState().ingestPublic({
						...res,
						pairs
					});
				}
			} catch {
				if (!stop) useDesk.getState().ingestPublic({
					ok: false,
					pairs: [],
					scanned: 0,
					dropped: 0
				});
			} finally {
				pulling = false;
			}
			const mints = useDesk.getState().opens.map((position) => position.mint);
			if (!stop && mints.length > 0) try {
				const marks = await markPrices({ data: { mints } });
				if (!stop && marks.ok) useDesk.getState().markPaperPrices(marks.prices);
			} catch {}
		};
		pull();
		const id = window.setInterval(() => void pull(), 2e4);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [ready]);
	const liveWatch = useLive((s) => s.armed || s.positions.length > 0);
	(0, import_react.useEffect)(() => {
		let stop = false;
		bootLive().then(() => {
			if (!stop) reconnectPhantom();
		});
		return () => {
			stop = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!liveWatch) return;
		let stop = false;
		const pull = () => {
			if (!stop) runLiveCycle();
		};
		pull();
		const id = window.setInterval(pull, 2e4);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [liveWatch]);
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecapGate, {})
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
	const scanState = useDesk((s) => s.scanState);
	const toggleRun = useDesk((s) => s.toggleRun);
	const startNight = useDesk((s) => s.startNight);
	const openRecap = useDesk((s) => s.openRecap);
	const setPaper = useDesk((s) => s.setPaper);
	const reset = useDesk((s) => s.reset);
	const liveOn = useLive((s) => s.armed);
	const livePositions = useLive((s) => s.positions.length);
	const liveStatus = useLive((s) => s.status);
	const [confirmReset, setConfirmReset] = (0, import_react.useState)(false);
	const tapeLabel = scanState === "fetching" ? "Fetching public market" : scanState === "screening" ? "Screening live candidates" : publicTape === "live" ? "Live market · paper trades" : publicTape === "offline" ? "Live market offline" : "Live market connecting";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "w-full min-w-0 shrink-0 border-b border-line",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
							className: cn("rounded-md px-2 py-1 font-mono text-xs", liveOn ? "bg-amber text-ink" : mode === "shadow" ? "bg-amber text-ink" : "bg-raised text-up"),
							children: liveOn ? "LIVE" : mode === "shadow" ? "SHADOW" : "PAPER"
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
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletButton, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveButton, {}),
							mode === "paper" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
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
			}),
			liveOn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-t border-line px-3 py-1.5 text-xs text-amber",
				children: ["Live. ", liveStatus]
			}) : livePositions > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-t border-line px-3 py-1.5 text-xs text-amber",
				children: [
					"Disarmed. ",
					livePositions,
					" chain name",
					livePositions === 1 ? "" : "s",
					" still watched for stops."
				]
			}) : null,
			mode === "shadow" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "border-t border-line px-3 py-1.5 text-xs text-amber",
				children: "Shadow arm. The agents still write orders. Nothing is signed or broadcast."
			}) : null
		]
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
							children: agent.id === "scout" ? tapeNote : agent.id === "analyst" ? `Paper ≥${PAPER_MIN_SCORE.toFixed(2)} · live ≥0.45` : agent.duty
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
					title: "Scanner",
					hint: "Live candidates · agent decisions",
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
	const candidates = useDesk((s) => s.marketCandidates);
	const inbox = useDesk((s) => s.inbox);
	const scanState = useDesk((s) => s.scanState);
	const marketUpdatedAt = useDesk((s) => s.marketUpdatedAt);
	const marketScanned = useDesk((s) => s.marketScanned);
	const marketDropped = useDesk((s) => s.marketDropped);
	const scanLabel = scanState === "screening" ? "Checking RugCheck and creator history" : scanState === "offline" ? "Feed offline · last snapshot shown" : scanState === "fetching" ? "Fetching public market" : scanState === "live" ? "Public feed live · refreshes every 20s" : "Waiting for the public feed";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "scroll min-h-0 flex-1 overflow-y-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManualScan, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-line px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-xs font-medium uppercase tracking-wide text-fg",
						children: "Live candidates"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-xs text-muted",
						children: [
							candidates.length,
							" · ",
							inbox.length,
							" queued"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-dim",
					children: [
						scanLabel,
						marketUpdatedAt ? ` · ${new Date(marketUpdatedAt).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
							second: "2-digit"
						})}` : "",
						marketScanned > 0 ? ` · ${marketScanned} mints scanned` : "",
						marketDropped > 0 ? ` · ${marketDropped} other venues skipped` : ""
					]
				})]
			}),
			candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 py-3 text-sm text-muted",
				children: scanState === "offline" ? "No current snapshot. The scanner will resume when public data returns." : "No Pump.fun or Raydium candidates in this feed snapshot."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: candidates.map((pair) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CandidateRow, { pair }, pair.mint)) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-y border-line bg-bg/40 px-3 py-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-xs font-medium uppercase tracking-wide text-fg",
						children: "Agent decisions"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs text-muted",
						children: tape.length
					})]
				})
			}),
			tape.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-3 py-3 text-sm text-muted",
				children: "Candidates are queued for the scan pipeline. Decisions will appear here."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: tape.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
						className: "mt-1 line-clamp-3 text-xs leading-snug text-muted",
						children: row.reason
					})
				]
			}, `${row.id}-${row.t}`)) })
		]
	});
}
function screenIssues(pair, screen) {
	const issues = [];
	if (!screen.reportAvailable) issues.push(screen.reason);
	else if (!screen.ok) issues.push(screen.reason);
	if (!screen.creator) issues.push("Creator address is missing.");
	if (!screen.creatorHistoryAvailable || screen.devPriorRugs === null) issues.push("Creator history is not indexed; unknown remains blocked.");
	else if (screen.devPriorRugs > 0) issues.push(`Creator has ${screen.devPriorRugs} prior rug${screen.devPriorRugs === 1 ? "" : "s"}.`);
	if (pair.venue === "raydium" && screen.lpLockedPct !== null && screen.lpLockedPct < 80) issues.push(`Raydium LP lock is ${screen.lpLockedPct.toFixed(0)}%; at least 80% is required.`);
	return [...new Set(issues)];
}
function ManualScan() {
	const [mint, setMint] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	const armed = useLive((state) => state.armed);
	const signer = useLive((state) => state.signer);
	const phantom = useLive((state) => state.phantom);
	const deskPubkey = useLive((state) => state.deskPubkey);
	const sol = useLive((state) => state.sol);
	const halted = useLive((state) => state.halted);
	const positions = useLive((state) => state.positions);
	const maxPositions = useLive((state) => state.maxPositions);
	const solPerTrade = useLive((state) => state.solPerTrade);
	const locks = useLive((state) => state.locks);
	async function scan(event) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		setResult(null);
		const address = mint.trim();
		try {
			const market = await fetchMintPair({ data: { mint: address } });
			if (!market.ok || !market.pair) {
				setError(market.error ?? "No supported market pair was found.");
				return;
			}
			const pair = market.pair;
			const screen = await screenMint({ data: {
				mint: pair.mint,
				venue: pair.venue,
				includeCreatorHistory: true
			} });
			const filterIssues = [tapeBlock(pair), ...screenIssues(pair, screen)].filter((issue) => Boolean(issue));
			const filterPassed = filterIssues.length === 0;
			const score = liveScore(pair, screen.top10);
			const analystPassed = score >= MIN_LIVE_SCORE;
			const owner = activeAddress({
				signer,
				phantom,
				deskPubkey
			});
			const ticket = sol === null ? null : ticketSol(sol, solPerTrade);
			const executorIssues = [];
			if (halted) executorIssues.push(halted);
			if (positions.some((position) => position.mint === pair.mint)) executorIssues.push("This mint is already open.");
			if ((locks[pair.mint] ?? 0) > Date.now()) executorIssues.push("This mint is in the revenge lock.");
			if (positions.length >= maxPositions) executorIssues.push(`Live book is full (${maxPositions} positions).`);
			if (!owner) executorIssues.push("No signer address is configured.");
			if (!armed) executorIssues.push("Live is disarmed.");
			if (ticket === null) executorIssues.push("Wallet balance has not been refreshed.");
			else if (ticket < .01) executorIssues.push(`Ticket is below ${MIN_TICKET_SOL} SOL after the cap and reserve.`);
			const executorPassed = filterPassed && analystPassed && executorIssues.length === 0;
			const riskIssues = [
				...halted ? [halted] : [],
				...positions.some((position) => position.mint === pair.mint) ? ["This mint is already open."] : [],
				...(locks[pair.mint] ?? 0) > Date.now() ? ["This mint is in the revenge lock."] : [],
				...positions.length >= maxPositions ? [`Position limit reached (${maxPositions}).`] : [],
				...ticket !== null && ticket < .01 ? [`Risk-sized ticket is below ${MIN_TICKET_SOL} SOL.`] : []
			];
			setResult({
				pair,
				screen,
				score,
				stages: [
					{
						name: "Scout",
						state: "pass",
						reason: "Mint found on DexScreener; selected the deepest supported Solana pair."
					},
					{
						name: "Filter",
						state: filterPassed ? "pass" : "blocked",
						reason: filterPassed ? "Market and safety gates passed." : filterIssues.join(" ")
					},
					{
						name: "Analyst",
						state: "diagnostic",
						reason: `Analysis completed. Diagnostic score ${score.toFixed(2)}; live minimum ${MIN_LIVE_SCORE.toFixed(2)} is ${analystPassed ? "met" : "not met"}. Live Filter results do not stop this read-only analysis.`
					},
					{
						name: "Executor",
						state: executorPassed ? "pass" : "blocked",
						reason: `${!filterPassed ? `Live Filter blocked: ${filterIssues.join(" ")} ` : ""}${!analystPassed ? `Analyst score is below ${MIN_LIVE_SCORE.toFixed(2)}. ` : ""}${executorPassed ? `Live preflight clear for ${ticket?.toFixed(3)} SOL; manual scans still never submit swaps.` : `Live preflight blocked: ${executorIssues.join(" ")}`}`
					},
					{
						name: "Risk",
						state: "diagnostic",
						reason: `Read-only risk preflight; not trade approval. ${!filterPassed ? `Live Filter blocked: ${filterIssues.join(" ")} ` : ""}${!analystPassed ? `Analyst score is below ${MIN_LIVE_SCORE.toFixed(2)}. ` : ""}${riskIssues.length ? riskIssues.join(" ") + " " : "Risk checks are clear. "}Hard stop −6%; trail arms +12%; max ${(MAX_PCT$1 * 100).toFixed(0)}% of balance, with ${LIVE_RESERVE_SOL} SOL reserve; daily loss halt ${useLive.getState().dailyLossSol} SOL.`
					}
				]
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Manual scan could not complete.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "border-b border-line bg-bg/40 px-3 py-3",
		"aria-labelledby": "manual-scan-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
					className: "size-4 text-amber",
					"aria-hidden": "true"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					id: "manual-scan-title",
					className: "text-xs font-medium uppercase tracking-wide text-fg",
					children: "Manual mint scan"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs leading-snug text-dim",
				children: "Read-only diagnostics report live gates without stopping analysis. No order is signed or submitted."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-2 flex gap-2",
				onSubmit: scan,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "sr-only",
						htmlFor: "manual-mint",
						children: "Solana token mint"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "manual-mint",
						value: mint,
						onChange: (event) => setMint(event.target.value),
						autoComplete: "off",
						spellCheck: false,
						maxLength: 44,
						placeholder: "Paste Solana contract address",
						className: "min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-xs text-fg placeholder:text-dim"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "submit",
						disabled: busy || !mint.trim(),
						className: "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-up px-3 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50",
						children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
							className: "size-3.5 animate-spin",
							"aria-hidden": "true"
						}) : null, busy ? "Scanning" : "Scan"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-[10px] leading-snug text-dim",
				children: [
					"Intake: new pairs ≥ ",
					compactUsd(MIN_LIVE_VOL),
					" 1h volume / ",
					compactUsd(MIN_LIVE_LIQ),
					" liquidity; breakouts ≥ ",
					compactUsd(MIN_BREAKOUT_VOL),
					" / ",
					compactUsd(MIN_BREAKOUT_LIQ),
					"; score ≥ ",
					MIN_LIVE_SCORE.toFixed(2),
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-[10px] leading-snug text-amber",
				children: [
					"Paper simulation: no age cutoff, ≥ ",
					compactUsd(PAPER_MIN_VOL),
					" 1h volume, score ≥ ",
					PAPER_MIN_SCORE.toFixed(2),
					". Rug, authority, LP-lock, holder, and creator-history safety checks still apply."
				]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-down",
				role: "alert",
				children: error
			}) : null,
			result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 border-t border-line pt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate font-mono text-sm",
								children: [
									result.pair.symbol,
									" · ",
									result.pair.venue
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-mono text-[10px] text-dim",
								children: result.pair.mint
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "min-h-11 shrink-0 py-2 text-xs text-up underline-offset-2 hover:underline",
							href: `https://dexscreener.com/solana/${result.pair.mint}`,
							target: "_blank",
							rel: "noreferrer",
							children: "Chart"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted",
						children: [
							compactUsd(result.pair.liquidityUsd),
							" liquidity · ",
							compactUsd(result.pair.volume1hUsd),
							" 1h volume · age ",
							Math.floor(result.pair.ageMin / 1440),
							"d"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-2 space-y-1.5",
						children: result.stages.map((stage) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex gap-2 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageIcon, { state: stage.state }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-medium",
									children: [stage.name, ": "]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: stage.state === "blocked" ? "text-down" : stage.state === "pass" ? "text-up" : stage.state === "diagnostic" ? "text-amber" : "text-dim",
									children: stage.reason
								})]
							})]
						}, stage.name))
					})
				]
			}) : null
		]
	});
}
function StageIcon({ state }) {
	if (state === "pass") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
		className: "mt-0.5 size-3.5 shrink-0 text-up",
		"aria-label": "Passed"
	});
	if (state === "blocked") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
		className: "mt-0.5 size-3.5 shrink-0 text-down",
		"aria-label": "Blocked"
	});
	if (state === "diagnostic") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
		className: "mt-0.5 size-3.5 shrink-0 text-amber",
		"aria-label": "Diagnostic only"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "mt-1 size-2.5 shrink-0 rounded-full border border-dim",
		"aria-label": "Not run"
	});
}
function CandidateRow({ pair }) {
	const creator = pair.creator ? `${pair.creator.slice(0, 5)}…${pair.creator.slice(-5)}` : null;
	let gateLabel = "Screening";
	let gateClass = "text-amber";
	let detail = "RugCheck and creator history are being checked.";
	if (pair.safetyState === "unavailable") {
		gateLabel = "Safety data unavailable";
		gateClass = "text-down";
		detail = pair.safetyReason ?? "RugCheck did not return a report. Candidate is blocked.";
	} else if (pair.safetyState === "checked" && pair.safetyReason) {
		gateLabel = "RugCheck blocked";
		gateClass = "text-down";
		detail = pair.safetyReason;
	} else if (pair.safetyState === "checked" && !creator) {
		gateLabel = "Creator unknown";
		gateClass = "text-down";
		detail = "RugCheck did not identify a creator; candidate is blocked.";
	} else if (pair.safetyState === "checked" && pair.devPriorRugs === null) {
		gateLabel = "Creator history unknown";
		gateClass = "text-down";
		detail = "No indexed Scorp record or lookup failed. Unknown stays blocked.";
	} else if (pair.devPriorRugs && pair.devPriorRugs > 0) {
		gateLabel = `${pair.devPriorRugs} prior rugs reported`;
		gateClass = "text-down";
		detail = `Scorp tracked ${pair.creatorTokenCount ?? "some"} creator launches.`;
	} else if (pair.safetyState === "checked" && pair.devPriorRugs === 0) {
		gateLabel = "Safety gates clear";
		gateClass = "text-up";
		detail = `Scorp tracked ${pair.creatorTokenCount ?? 0} launches with 0 reported rugs; volume and score still gate entry.`;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-line px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 truncate font-mono text-sm",
					children: [pair.symbol, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-xs text-dim",
						children: pair.venue
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "num shrink-0 font-mono text-sm",
					children: pxPrice(pair.priceUsd)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 truncate text-xs text-dim",
				children: [
					pair.name,
					" · ",
					Math.floor(pair.ageMin),
					"m old · liquidity ",
					compactUsd(pair.liquidityUsd)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 font-mono text-xs text-dim",
				children: [
					"1h volume ",
					compactUsd(pair.volume1hUsd),
					" · mcap ",
					compactUsd(pair.mcapUsd)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 font-mono text-[10px] text-dim",
				children: [
					"Mint ",
					authorityState(pair.mintRevoked),
					" · freeze ",
					authorityState(pair.freezeRevoked),
					" · LP ",
					pair.lpLocked === null || pair.lpLocked === void 0 ? "unknown" : pair.lpLocked ? "locked" : "unlocked",
					" · top 10 ",
					pair.top10Pct == null ? "unknown" : `${pair.top10Pct.toFixed(1)}%`
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 text-xs font-medium", gateClass),
				children: gateLabel
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "line-clamp-2 text-xs leading-snug text-muted",
				children: detail
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "truncate font-mono text-[10px] text-dim",
					children: ["Creator ", creator ?? "not identified"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "shrink-0 text-xs text-up underline-offset-2 hover:underline",
					href: `https://dexscreener.com/solana/${pair.mint}`,
					target: "_blank",
					rel: "noreferrer",
					children: "Chart"
				})]
			})
		]
	});
}
function authorityState(revoked) {
	if (revoked === true) return "revoked";
	if (revoked === false) return "live";
	return "unknown";
}
function Outcome({ row }) {
	const label = row.outcome === "kill" ? "Killed" : row.outcome === "reject" ? "Score rejected" : row.outcome === "skip" ? "Skipped" : "Filled";
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
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskApp, {});
}
export { Home as component };
