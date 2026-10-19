import { test } from "node:test";
import assert from "node:assert/strict";
import { measuredProfileEntry, mergeProfileEntries, safeFeeSettlement, executionOutcome } from "../frontend/scripts/fee-evidence.mjs";

test("profile uses actual consumption, 25% headroom, and worst observed components", () => {
  const fees = { deposit: "100", userValue: "1000000000000000000", distribution: { leaderTimeunitsAllocation: "100", validatorTimeunitsAllocation: "200", rotations: ["1", "2"] }, consumed: { executionConsumed: "11", messageFeesConsumed: "5" }, node_config: { secret: "not projected" } };
  const entry = measuredProfileEntry(fees);
  assert.deepEqual(entry, { leaderTimeunitsAllocation: "125", validatorTimeunitsAllocation: "250", executionBudgetPerRound: "14", totalMessageFees: "7", rotationsPerRound: "2" });
  assert.equal(mergeProfileEntries({ ...entry, executionBudgetPerRound: "20" }, entry).executionBudgetPerRound, "20");
  assert.deepEqual(safeFeeSettlement(fees), { feeDepositWei: "100", applicationValueWei: "1000000000000000000", executionConsumedWei: "11", messageFeesConsumedWei: "5" });
});
test("missing/negative observations cannot become a fabricated zero-cost profile", () => {
  assert.throws(() => measuredProfileEntry({}));
  assert.throws(() => safeFeeSettlement({ deposit: "1", userValue: "0", consumed: { executionConsumed: "-1", messageFeesConsumed: "0" } }));
});
test("finality is not substituted for execution", () => {
  assert.deepEqual(executionOutcome({ statusName: "FINALIZED", txExecutionResultName: "ERROR" }), { status: "FINALIZED", execution: "ERROR" });
});
