import { describe, expect, it } from "vitest";

import { createUnconfiguredAdapter } from "./contractAdapter";

describe("unconfigured contract adapter", () => {
  it("returns an explicit unavailable workspace without canonical fixtures", async () => {
    const adapter = createUnconfiguredAdapter();

    await expect(adapter.loadWorkspace()).resolves.toEqual({
      availability: "unconfigured",
      account: null,
      networkName: null,
      contractAddress: null,
      round: null,
      positions: [],
      creditGen: "0",
    });
  });

  it("rejects writes instead of simulating a transaction", async () => {
    const adapter = createUnconfiguredAdapter();

    await expect(adapter.connectWallet()).rejects.toThrow("Contract not configured");
  });
});
