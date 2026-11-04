import assert from "node:assert/strict";
import test from "node:test";

import type { LivePosition } from "./live-store.ts";
import { dynamicTrailGive, dynamicTrailStop, evaluateLiveAgent, partialTokenAmount } from "./live-risk.ts";

const position: LivePosition = {
  mint: "mint",
  symbol: "TOKEN",
  venue: "raydium",
  solIn: 0.1,
  tokenRaw: "1000000",
  tokenUi: 1,
  entryPriceUsd: 1,
  priceUsd: 1,
  openedAt: 0,
  signature: "signature",
  peakPnlPct: 0,
  trailArmed: false,
  trailStopPct: null,
};

test("dynamic trail give-back tightens at configured peak tiers", () => {
  assert.equal(dynamicTrailGive(0.12), 0.06);
  assert.equal(dynamicTrailGive(0.25), 0.03);
  assert.equal(dynamicTrailGive(0.5), 0.025);
  assert.equal(dynamicTrailGive(1), 0.015);
  assert.equal(dynamicTrailGive(2), 0.01);
  assert.equal(dynamicTrailStop(0.25), 0.22);
  assert.equal(dynamicTrailStop(0.5), 0.475);
});

test("agent prioritizes liquidity and give-back flattening over scale-outs", () => {
  assert.equal(evaluateLiveAgent(position, 0.3, 2000, 10_000, 10_000)?.kind, "flatten");
  assert.equal(evaluateLiveAgent({ ...position, peakPnlPct: 0.4 }, 0.1, 10_000, 10_000, 10_000)?.kind, "flatten");
});

test("agent force-scales once and applies time pressure at 80% of the hold limit", () => {
  const forceScale = evaluateLiveAgent({ ...position, peakPnlPct: 0.4 }, 0.4, 10_000, 10_000, 1000);
  assert.deepEqual(forceScale && { kind: forceScale.kind, fraction: forceScale.kind === "scale" ? forceScale.fraction : null }, {
    kind: "scale",
    fraction: 0.4,
  });
  const timeScale = evaluateLiveAgent({ ...position, peakPnlPct: 0.1, scaled1: true }, 0.02, 10_000, 10_000, 384_000);
  assert.deepEqual(timeScale && { kind: timeScale.kind, fraction: timeScale.kind === "scale" ? timeScale.fraction : null }, {
    kind: "scale",
    fraction: 0.5,
  });
});

test("partial token amounts use integer arithmetic and reject invalid inputs", () => {
  assert.equal(partialTokenAmount("1000001", 0.4), 400000n);
  assert.equal(partialTokenAmount("1000001", 1), 1000001n);
  assert.equal(partialTokenAmount("not-raw", 0.5), 0n);
});
