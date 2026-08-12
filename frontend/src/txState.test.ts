import { describe, expect, it } from "vitest";

import { advanceTransaction, initialTransaction } from "./txState";

describe("transaction lifecycle", () => {
  it("tracks the user-visible finality path", () => {
    const awaiting = advanceTransaction(initialTransaction, { type: "SIGNATURE_REQUESTED" });
    const submitted = advanceTransaction(awaiting, { type: "SUBMITTED", hash: "0xabc" });
    const accepted = advanceTransaction(submitted, { type: "ACCEPTED" });
    const finalized = advanceTransaction(accepted, { type: "FINALIZED" });

    expect(finalized).toEqual({ status: "finalized", hash: "0xabc", message: null });
  });

  it("preserves a recovery message for retryable and failed writes", () => {
    const awaiting = advanceTransaction(initialTransaction, { type: "SIGNATURE_REQUESTED" });

    expect(
      advanceTransaction(awaiting, { type: "RETRYABLE", message: "Evidence source is temporarily unavailable." }),
    ).toMatchObject({ status: "retryable", message: expect.stringContaining("temporarily") });
    expect(
      advanceTransaction(awaiting, { type: "FAILED", message: "Wallet rejected the signature." }),
    ).toMatchObject({ status: "failed", message: expect.stringContaining("Wallet") });
  });

  it("rejects an impossible finalization before submission", () => {
    expect(() => advanceTransaction(initialTransaction, { type: "FINALIZED" })).toThrow(
      "Invalid transaction transition",
    );
  });
});
