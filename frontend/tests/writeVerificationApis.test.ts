import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getTransaction: vi.fn(), getCurrentFeePolicy: vi.fn(), estimateTransactionFees: vi.fn(),
}));
vi.mock("genlayer-js", () => ({ createClient: () => mocks }));
vi.mock("../fee-profile.json", () => ({ default: { version: 1, network: "studio-dev", chainId: 61997, methods: { submit_request: { leaderTimeunitsAllocation: "125", validatorTimeunitsAllocation: "250", executionBudgetPerRound: "200", totalMessageFees: "0", rotationsPerRound: "1" } } } }));
import feeHandler from "../api/fee-quote";
import outcomeHandler from "../api/transaction-outcome";

function response() {
  return { statusCode: 200, body: undefined as unknown, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; } };
}
describe("safe write verification endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentFeePolicy.mockResolvedValue({ executionBudgetFloor: 1000n });
    mocks.estimateTransactionFees.mockResolvedValue({ feeValue: 50n, distribution: { appealRounds: 1n, rotations: [1n, 1n] }, policy: { privateDiagnostic: "never publish" } });
  });
  it("quotes measured quantities with the current floor, not a stale consumed-cost budget", async () => {
    const res = response();
    await feeHandler({ method: "GET", query: { method: "submit_request" } }, res);
    expect(mocks.estimateTransactionFees).toHaveBeenCalledWith(expect.objectContaining({ executionBudgetPerRound: 1000n, leaderTimeunitsAllocation: 125n }));
    expect(res.body).toEqual(expect.objectContaining({ chainId: 61997, source: "measured-profile", feeValue: "50" }));
    expect(JSON.stringify(res.body)).not.toContain("never publish");
  });
  it("does not guess an unmeasured withdrawal message budget", async () => {
    const res = response();
    await feeHandler({ method: "GET", query: { method: "withdraw_credit" } }, res);
    expect(res.statusCode).toBe(503);
    expect(mocks.estimateTransactionFees).not.toHaveBeenCalled();
  });
  it("rejects unknown writes without querying the network", async () => {
    const res = response();
    await feeHandler({ method: "GET", query: { method: "evil" } }, res);
    expect(res.statusCode).toBe(400);
    expect(mocks.estimateTransactionFees).not.toHaveBeenCalled();
  });
  it("returns execution failure but never raw validator receipts", async () => {
    mocks.getTransaction.mockResolvedValue({ statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "ERROR", node_config: { key: "private" } }] } });
    const res = response();
    await outcomeHandler({ method: "GET", query: { hash: `0x${"a".repeat(64)}` } }, res);
    expect(res.body).toEqual({ status: "FINALIZED", execution: "ERROR" });
  });
  it("does not forward SDK exception details", async () => {
    mocks.getTransaction.mockRejectedValue(new Error("private validator diagnostics"));
    const res = response();
    await outcomeHandler({ method: "GET", query: { hash: `0x${"a".repeat(64)}` } }, res);
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("private");
  });
  it("validates the hash before any network call", async () => {
    const res = response();
    await outcomeHandler({ method: "GET", query: { hash: "not-a-hash" } }, res);
    expect(res.statusCode).toBe(400);
    expect(mocks.getTransaction).not.toHaveBeenCalled();
  });
});
