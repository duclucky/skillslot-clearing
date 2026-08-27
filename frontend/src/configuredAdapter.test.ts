import { describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({
  readContract: vi.fn(),
  request: vi.fn(),
  writeContract: vi.fn(),
})));

vi.mock("genlayer-js", () => ({ createClient: createClientMock }));
vi.mock("genlayer-js/chains", () => ({
  studionet: {
    id: 61999,
    rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
  },
}));
vi.mock("./wallet", () => ({
  connectStudionetWallet: vi.fn(),
  disconnectStudionetWallet: vi.fn(),
  getActiveWalletSession: vi.fn(() => null),
  restoreStudionetWallet: vi.fn(),
  withStudionetFeeCompatibility: vi.fn((provider) => provider),
}));

import { createConfiguredAdapter } from "./contractAdapter";

describe("configured GenLayer adapter", () => {
  it("routes canonical reads through the same-origin Studionet RPC proxy", () => {
    createConfiguredAdapter("0x00000000000000000000000000000000000000aa");

    expect(createClientMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      endpoint: "/api/studionet-rpc",
    }));
  });
});
