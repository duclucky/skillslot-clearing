import { describe, expect, it } from "vitest";
import { decodeFeeQuote } from "./fees";
const quote = () => ({ chainId: 61997, quotedAt: 10_000, feeValue: "50000000000000000", distribution: { leaderTimeunitsAllocation: "125", validatorTimeunitsAllocation: "250", appealRounds: "1", executionBudgetPerRound: "1000", totalMessageFees: "0", maxPriceGenPerTimeUnit: "2", storageFeeMaxGasPrice: "300000000", receiptFeeMaxGasPrice: "300000000", rotations: ["1", "1"] } });
describe("live fee quote", () => {
  it("keeps exact bigint precision and separate fee budget", () => {
    expect(decodeFeeQuote(quote(), 10_000).feeValue).toBe(50_000_000_000_000_000n);
    expect(decodeFeeQuote(quote(), 10_000).distribution.rotations).toEqual([1n, 1n]);
  });
  it("rejects stale, wrong-chain, excessive and malformed budgets before wallet submission", () => {
    expect(() => decodeFeeQuote(quote(), 70_001)).toThrow("expired");
    expect(() => decodeFeeQuote({ ...quote(), chainId: 61999 }, 10_000)).toThrow("network");
    expect(() => decodeFeeQuote({ ...quote(), feeValue: "200000000000000001" }, 10_000)).toThrow("safety cap");
    expect(() => decodeFeeQuote({ ...quote(), feeValue: "-1" }, 10_000)).toThrow();
    expect(() => decodeFeeQuote({ ...quote(), distribution: { ...quote().distribution, rotations: ["1"] } }, 10_000)).toThrow("rotations");
  });
});
