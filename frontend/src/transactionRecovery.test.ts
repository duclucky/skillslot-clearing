import { describe, expect, it } from "vitest";

import {
  classifyTransactionError,
  isTransactionCancelled,
  isTransientReadError,
  isTransientStatusError,
  TransactionCancelledError,
} from "./transactionRecovery";

describe("transaction recovery classification", () => {
  it.each([
    Object.assign(new Error("User rejected the request"), { code: 4001 }),
    { cause: { code: 4001, message: "denied" } },
    { data: { cause: new Error("Request Signature: User denied request signature") } },
  ])("maps wallet rejection to cancellation", (error) => {
    expect(classifyTransactionError(error)).toBe("wallet_cancelled");
    expect(isTransactionCancelled(new TransactionCancelledError(error))).toBe(true);
  });

  it.each([
    new Error("Failed to fetch"),
    new Error("429 Too Many Requests"),
    new Error("503 Service Unavailable"),
    { cause: new Error("network timeout") },
  ])("maps transient read failures", (error) => {
    expect(isTransientReadError(error)).toBe(true);
  });

  it("treats indexing misses as status-only transient failures", () => {
    const error = new Error("transaction not found while indexing");
    expect(isTransientStatusError(error)).toBe(true);
    expect(isTransientReadError(error)).toBe(false);
  });

  it("does not retry deterministic contract failures", () => {
    const error = new Error("Contract method not found");
    expect(classifyTransactionError(error)).toBe("deterministic_failure");
    expect(isTransientReadError(error)).toBe(false);
    expect(isTransientStatusError(error)).toBe(false);
  });
});
