import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const defaultRpcUrl = "https://studio-dev.genlayer.com/api";
  const studionet = {
    id: 61997,
    rpcUrls: { default: { http: [defaultRpcUrl] } },
  };
  const getActiveWalletSession = vi.fn<() => unknown>(() => null);
  const createClient = vi.fn((args) => {
    if (args?.endpoint) {
      args.chain.rpcUrls.default.http = [args.endpoint];
    }
    return {
      readContract: vi.fn(),
      request: vi.fn(async () => "FINALIZED"),
      writeContract: vi.fn(async () => "0xhash"),
    };
  });
  return { createClient, defaultRpcUrl, getActiveWalletSession, studionet };
});

vi.mock("genlayer-js", () => ({ createClient: mocks.createClient }));
vi.mock("genlayer-js/chains", () => ({
  studioDevnet: mocks.studionet,
}));
vi.mock("./wallet", () => ({
  connectStudionetWallet: vi.fn(),
  disconnectStudionetWallet: vi.fn(),
  getActiveWalletSession: mocks.getActiveWalletSession,
  restoreStudionetWallet: vi.fn(),
  signActiveWalletMessage: vi.fn(),
  withStudionetFeeCompatibility: vi.fn((provider) => provider),
}));

import { createConfiguredAdapter } from "./contractAdapter";

describe("configured GenLayer adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("fee-quote") ? ({ chainId: 61997, quotedAt: Date.now(), feeValue: "50", distribution: { leaderTimeunitsAllocation: "125", validatorTimeunitsAllocation: "250", appealRounds: "0", executionBudgetPerRound: "1000", totalMessageFees: "0", maxPriceGenPerTimeUnit: "2", storageFeeMaxGasPrice: "3", receiptFeeMaxGasPrice: "3", rotations: ["1"] } }) : ({ status: "FINALIZED", execution: "SUCCESS" }) })));
    mocks.createClient.mockClear();
    mocks.getActiveWalletSession.mockReset();
    mocks.getActiveWalletSession.mockReturnValue(null);
    mocks.studionet.rpcUrls.default.http = [mocks.defaultRpcUrl];
  });

  it("routes canonical reads through the same-origin Studio Dev RPC proxy", () => {
    createConfiguredAdapter("0x00000000000000000000000000000000000000aa");

    expect(mocks.createClient).toHaveBeenNthCalledWith(1, expect.objectContaining({
      endpoint: "/api/studionet-rpc",
    }));
  });

  it("does not let the read proxy mutate the wallet write client RPC chain", async () => {
    mocks.getActiveWalletSession.mockReturnValue({
      account: "0x0000000000000000000000000000000000000001",
      walletId: "rabby",
      walletName: "Rabby",
      provider: { request: vi.fn() },
      onStudionet: true,
    });
    const adapter = createConfiguredAdapter("0x00000000000000000000000000000000000000aa");

    await adapter.openRound({ roundId: "round-1", title: "Round 1" });

    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(mocks.createClient.mock.calls[0][0].chain.rpcUrls.default.http).toEqual(["/api/studionet-rpc"]);
    expect(mocks.createClient.mock.calls[1][0].chain.rpcUrls.default.http).toEqual([mocks.defaultRpcUrl]);
  });
});
