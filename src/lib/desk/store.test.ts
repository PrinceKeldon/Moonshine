import assert from "node:assert/strict";
import test from "node:test";

import { createDesk } from "./engine.ts";
import { migrateDesk } from "./store-migrations.ts";

test("desk migration removes stale position-cap messages without resetting the paper book", () => {
  const previous = createDesk();
  previous.agents.executor = {
    last: "No trade. 4 names is the book limit. Unused capital stays unused.",
    tone: "kill",
  };
  previous.logs.push({
    id: "legacy",
    t: previous.deskTime,
    agent: "executor",
    symbol: "TOKEN",
    kind: "skip",
    reason: previous.agents.executor.last,
  });
  previous.cash = 123;

  const migrated = migrateDesk(previous);

  assert.equal(migrated.cash, 123);
  assert.equal(migrated.logs.some((row) => row.id === "legacy"), false);
  assert.doesNotMatch(migrated.agents.executor.last, /4 names|unused capital/i);
});
