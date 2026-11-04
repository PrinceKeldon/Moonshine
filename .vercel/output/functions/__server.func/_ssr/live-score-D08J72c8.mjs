// node_modules/.nitro/vite/services/ssr/assets/live-score-D08J72c8.js
var SOL_MINT = "So11111111111111111111111111111111111111112";
/** New-pair track floors (was $50k / $8k). */
var MIN_LIVE_VOL = 15e3;
var MIN_LIVE_LIQ = 4e3;
/** Breakout track: older names with softer bars (was $150k / $25k). */
var MAX_BREAKOUT_AGE = 10080;
var MIN_BREAKOUT_VOL = 5e4;
var MIN_BREAKOUT_LIQ = 1e4;
/** Analyst pass mark (was 0.60). */
var MIN_LIVE_SCORE = .45;
var LIVE_RESERVE_SOL = .02;
var MIN_TICKET_SOL = .01;
var MAX_PCT = .08;
var CASH_MINTS = /* @__PURE__ */ new Set([
	SOL_MINT,
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
]);
function clamp01(n) {
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}
function isCashMint(mint) {
	return CASH_MINTS.has(mint);
}
function washReason(pair) {
	const tx = pair.buys1h + pair.sells1h;
	if (tx <= 0) return null;
	if (Math.max(pair.buys1h, pair.sells1h) / tx >= .95) return "Buy/sell flow is one-sided. Treated as wash.";
	if (tx < 20 && pair.volume1hUsd > 2e5) return "Volume is large against a tiny print count. Treated as wash.";
	return null;
}
function isBreakoutCandidate(pair) {
	return pair.ageMin > 180 && pair.ageMin <= 10080 && pair.volume1hUsd >= 5e4 && pair.liquidityUsd >= 1e4;
}
function isSoftTapeBlock(reason) {
	return reason.includes("volume is under") || reason.includes("Liquidity is under") || reason.includes("Older than") || reason.includes("Breakout track needs") || reason.includes("not enough volume") || reason.includes("not enough liquidity");
}
function tapeBlock(pair) {
	if (isCashMint(pair.mint)) return "Cash mint. Not a candidate.";
	if (pair.venue !== "pump.fun" && pair.venue !== "raydium") return "Venue is outside Pump.fun and Raydium.";
	const wash = washReason(pair);
	if (wash) return wash;
	if (pair.ageMin <= 180) {
		if (pair.volume1hUsd < 15e3) return `1h volume is under $${(MIN_LIVE_VOL / 1e3).toFixed(0)},000.`;
		if (pair.liquidityUsd < 4e3) return `Liquidity is under $${(MIN_LIVE_LIQ / 1e3).toFixed(0)},000.`;
		return null;
	}
	if (pair.ageMin > 10080) return `Older than ${MAX_BREAKOUT_AGE / 1440} days and outside the new-pair window.`;
	if (pair.volume1hUsd < 5e4) return `Breakout track needs 1h volume ≥ $${(MIN_BREAKOUT_VOL / 1e3).toFixed(0)}k (have $${(pair.volume1hUsd / 1e3).toFixed(0)}k).`;
	if (pair.liquidityUsd < 1e4) return `Breakout track needs liquidity ≥ $${(MIN_BREAKOUT_LIQ / 1e3).toFixed(0)}k.`;
	return null;
}
function liveScore(pair, top10) {
	const volScore = clamp01((Math.log10(Math.max(pair.volume1hUsd, 1)) - 4.2) / 1.1);
	const liqScore = clamp01((Math.log10(Math.max(pair.liquidityUsd, 1)) - 3.6) / 1.1);
	const holderScore = top10 == null ? .45 : clamp01((16 - top10) / 12);
	const ageScore = pair.ageMin < 6 ? .2 : pair.ageMin < 15 ? .5 : pair.ageMin < 180 ? .9 : pair.ageMin < 1440 ? .7 : .55;
	const flowScore = clamp01(.5 + (pair.buys1h - pair.sells1h) / Math.max(1, pair.buys1h + pair.sells1h) * .9);
	const breakoutBoost = isBreakoutCandidate(pair) ? .04 : 0;
	const raw = .2 * volScore + .24 * liqScore + .18 * holderScore + .18 * ageScore + .2 * flowScore + breakoutBoost;
	return Math.round(clamp01(raw) * 100) / 100;
}
function ticketSol(balance, requested) {
	const cap = balance * MAX_PCT;
	const room = balance - LIVE_RESERVE_SOL;
	return Math.floor(Math.min(requested, cap, room) * 1e3) / 1e3;
}
export { MIN_LIVE_LIQ as a, MIN_TICKET_SOL as c, isSoftTapeBlock as d, liveScore as f, MIN_BREAKOUT_VOL as i, SOL_MINT as l, ticketSol as m, MAX_PCT as n, MIN_LIVE_SCORE as o, tapeBlock as p, MIN_BREAKOUT_LIQ as r, MIN_LIVE_VOL as s, LIVE_RESERVE_SOL as t, isBreakoutCandidate as u };
