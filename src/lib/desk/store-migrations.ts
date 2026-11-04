import { createDesk } from "./engine.ts";
import type { DeskState } from "./types.ts";

function isLegacyPositionCapMessage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /(?:4|four)\s+names?\s+is\s+the\s+book\s+limit|unused capital stays unused/i.test(value);
}

export function migrateDesk(persisted: unknown): DeskState {
  const old = persisted && typeof persisted === "object" ? (persisted as Partial<DeskState>) : {};
  const fresh = createDesk();
  const executor = old.agents?.executor ?? fresh.agents.executor;
  const agents = old.agents && typeof old.agents === "object"
    ? {
        ...fresh.agents,
        ...old.agents,
        executor: isLegacyPositionCapMessage(executor.last) ? fresh.agents.executor : executor,
      }
    : fresh.agents;
  const recap = old.recap
    ? {
        ...old.recap,
        narrative: isLegacyPositionCapMessage(old.recap.narrative)
          ? "The obsolete position-count restriction has been removed. Individual sizing and available cash still apply."
          : old.recap.narrative,
        lines: Array.isArray(old.recap.lines)
          ? old.recap.lines.filter((line) => !isLegacyPositionCapMessage(line))
          : [],
      }
    : fresh.recap;

  return {
    ...fresh,
    ...old,
    recap,
    agents,
    logs: Array.isArray(old.logs) ? old.logs.filter((row) => !isLegacyPositionCapMessage(row.reason)) : fresh.logs,
    decisions: Array.isArray(old.decisions)
      ? old.decisions.filter((row) => !isLegacyPositionCapMessage(row.reason))
      : fresh.decisions,
    tape: Array.isArray(old.tape) ? old.tape.filter((row) => !isLegacyPositionCapMessage(row.reason)) : fresh.tape,
    watchAddress: typeof old.watchAddress === "string" ? old.watchAddress : "",
    watch: old.watch ?? null,
  };
}
