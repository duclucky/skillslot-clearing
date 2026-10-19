import { describe, expect, it } from "vitest";
import { assertSuccessfulExecution, projectTransactionOutcome } from "./transactionOutcome";

describe("safe execution verification", () => {
  it("projects only allowlisted fields, never validator configuration", () => {
    const outcome = projectTransactionOutcome({ statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", node_config: { secret: "never publish" }, stdout: "private" }] } });
    expect(outcome).toEqual({ status: "FINALIZED", execution: "SUCCESS" });
    expect(() => assertSuccessfulExecution(outcome)).not.toThrow();
  });
  it.each(["ERROR", "UNKNOWN", "TIMEOUT", ""])('rejects finalized execution %s', (execution) => {
    expect(() => assertSuccessfulExecution({ status: "FINALIZED", execution })).toThrow("Execution not successful");
  });
  it("does not substitute finality for execution success", () => {
    expect(() => assertSuccessfulExecution(projectTransactionOutcome({ statusName: "FINALIZED" }))).toThrow();
    expect(() => assertSuccessfulExecution({ status: "ACCEPTED", execution: "SUCCESS" })).toThrow();
  });
});
