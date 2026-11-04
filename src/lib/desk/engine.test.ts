import assert from "node:assert/strict";
import test from "node:test";

import { createDesk, stepMinute } from "./engine.ts";
import type { Pair } from "./types.ts";

test("paper desk accepts more than four separately cleared positions", () => {
  const candidates: Pair[] = Array.from({ length: 8 }, (_, index) => ({
    uid: `pair-${index}`,
    mint: `mint-${index}`,
    symbol: `TOKEN${index}`,
    name: `Token ${index}`,
    venue: "raydium",
    priceUsd: 1,
    volume1hUsd: 100_000,
    liquidityUsd: 100_000,
    mcapUsd: 500_000,
    ageMin: 30,
    buys1h: 100,
    sells1h: 30,
    mintRevoked: true,
    freezeRevoked: true,
    lpLocked: true,
    top10Pct: 10,
    devWallet: `creator-${index}`,
    devPriorRugs: 0,
    source: "index",
  }));

  let desk = createDesk();
  desk.inbox = candidates;
  for (let index = 0; index < candidates.length; index += 1) {
    desk = stepMinute(desk);
  }

  assert.equal(desk.opens.length, 8);
  assert.equal(desk.stats.buys, 8);
  assert.equal(desk.stats.skips, 0);
});
