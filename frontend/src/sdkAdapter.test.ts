import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createGenLayerAdapter, type GenLayerClientLike, ONE_GEN_WEI } from "./contractAdapter";

describe("real SDK v2 through the project adapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("submits exact value plus separate fees using a string account and EIP-1193 provider", async () => {
    const account = "0x00000000000000000000000000000000000000bb" as const;
    const address = "0x00000000000000000000000000000000000000aa" as const;
    const hash = `0x${"a".repeat(64)}`;
    const provider = { request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_sendTransaction") return hash;
      throw new Error(`Unexpected wallet method ${method}`);
    }) };
    const rpc = vi.fn(async (_url: unknown, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      const results: Record<string, unknown> = {
        eth_getTransactionCount: "0x0", eth_estimateGas: "0x30d40", eth_gasPrice: "0x3b9aca00", eth_blockNumber: "0x1",
        eth_getTransactionReceipt: { transactionHash: hash, transactionIndex: "0x0", blockHash: `0x${"b".repeat(64)}`, blockNumber: "0x1", from: account, to: address, cumulativeGasUsed: "0x5208", gasUsed: "0x5208", effectiveGasPrice: "0x3b9aca00", contractAddress: null, logs: [], logsBloom: `0x${"0".repeat(512)}`, status: "0x1", type: "0x0" },
      };
      if (!(payload.method in results)) throw new Error(`Unexpected SDK read ${payload.method}`);
      return { json: async () => ({ jsonrpc: "2.0", id: payload.id, result: results[payload.method] }) };
    });
    vi.stubGlobal("fetch", rpc);
    const writer = createClient({ chain: { ...studioDevnet }, account, provider }) as unknown as GenLayerClientLike;
    const reader = { request: vi.fn(async () => "FINALIZED") } as unknown as GenLayerClientLike;
    const fees = { feeValue: 50n, distribution: { leaderTimeunitsAllocation: 125n, validatorTimeunitsAllocation: 250n, appealRounds: 0n, executionBudgetPerRound: 1000n, totalMessageFees: 0n, rotations: [1n], maxPriceGenPerTimeUnit: 2n, storageFeeMaxGasPrice: 3n, receiptFeeMaxGasPrice: 3n } };
    const adapter = createGenLayerAdapter({ contractAddress: address, clients: () => ({ readClient: reader, writeClient: writer, account }), quoteFees: async () => fees, verifyExecution: async () => ({ status: "FINALIZED", execution: "SUCCESS" }), pollIntervalMs: 0 });
    await adapter.submitRequest({ roundId: "sdk-policy", requestId: "request-sdk", label: "Policy request", need: "Book a flight", requiredIds: "FLIGHT.BOOK", excludedIds: "", minimumReviewCount: 1, minimumAverageMilli: 4000 });
    expect(provider.request).toHaveBeenCalledTimes(1);
    const call = vi.mocked(provider.request).mock.calls[0][0] as unknown as { params: Array<Record<string, string>> };
    expect(call.params[0].from.toLowerCase()).toBe(account);
    expect(BigInt(call.params[0].value)).toBe(ONE_GEN_WEI + fees.feeValue);
    expect(call.params[0].chainId).toBe("0xf22d");
    expect(call.params[0].data).toMatch(/^0x[0-9a-f]+$/);
    expect(call.params[0].to.toLowerCase()).toBe(studioDevnet.consensusMainContract!.address.toLowerCase());
  });
});
