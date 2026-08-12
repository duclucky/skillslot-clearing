import { describe, expect, it, vi } from "vitest";

import { createGenLayerAdapter, ONE_GEN_WEI, type GenLayerClientLike } from "./contractAdapter";

const address = "0x00000000000000000000000000000000000000aa" as const;
const account = "0x00000000000000000000000000000000000000bb" as const;

function clients() {
  const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
    if (functionName === "get_round_ids") return ["round-1"];
    if (functionName === "get_round") {
      return {
        round_id: "round-1",
        creator: account,
        title: "Research access",
        phase: "CLEARED",
        booking_fee_wei: ONE_GEN_WEI.toString(),
        provider_bond_wei: ONE_GEN_WEI.toString(),
        offer_ids_csv: "offer-1",
        request_ids_csv: "request-1",
        offer_count: "1",
        request_count: "1",
      };
    }
    if (functionName === "get_offer") {
      return { offer_id: args?.[1], provider: account, label: "Search agent", matched_request_id: "request-1", active: false };
    }
    if (functionName === "get_request") {
      return { request_id: args?.[1], requester: account, label: "Need sources", matched_offer_id: "offer-1", outcome: "MATCHED" };
    }
    if (functionName === "get_match") {
      return { request_id: args?.[1], requester: account, provider: account, offer_id: "offer-1", grant_status: "ACTIVE" };
    }
    if (functionName === "can_route") return true;
    if (functionName === "get_credit") return ONE_GEN_WEI.toString();
    if (functionName === "get_accounting") return { invariant_holds: true };
    throw new Error(`Unexpected view ${functionName}`);
  });
  const request = vi.fn(async () => "FINALIZED");
  const readClient = { readContract, request } as unknown as GenLayerClientLike;
  const writeClient = {
    writeContract: vi.fn(async () => "0xhash"),
  } as unknown as GenLayerClientLike;
  return { readClient, writeClient };
}

describe("GenLayer contract adapter", () => {
  it("reads every canonical view needed to rebuild the wallet workspace", async () => {
    const { readClient, writeClient } = clients();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
    });

    const snapshot = await adapter.loadWorkspace();

    expect(snapshot.round?.id).toBe("round-1");
    expect(snapshot.creditGen).toBe("1");
    expect(snapshot.positions.map((item) => item.kind)).toEqual(["offer", "request", "grant"]);
    expect(readClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "can_route" }));
    expect(readClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "get_accounting" }));
  });

  it("maps all eight writes, exact GEN value, and submitted/accepted/finalized progress", async () => {
    const { readClient, writeClient } = clients();
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
    });

    await adapter.openRound({ roundId: "round-2", title: "New round" });
    await adapter.submitOffer({ roundId: "round-1", offerId: "offer-2", label: "Agent", promise: "Find sources", capabilityIds: "web" });
    await adapter.submitRequest({ roundId: "round-1", requestId: "request-2", label: "Need", need: "Find sources", requiredIds: "web", excludedIds: "" });
    await adapter.lockRound("round-1");
    await adapter.clearRound("round-1");
    await adapter.cancelRound("round-1");
    await adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" });
    await adapter.withdrawCredit(ONE_GEN_WEI.toString());

    expect(writeClient.writeContract).toHaveBeenCalledTimes(8);
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "submit_offer", value: ONE_GEN_WEI }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "submit_request", value: ONE_GEN_WEI }));
    expect(progress.mock.calls.map(([event]) => event.stage)).toContain("submitted");
    expect(progress.mock.calls.map(([event]) => event.stage)).toContain("accepted");
    expect(progress.mock.calls.map(([event]) => event.stage)).toContain("finalized");
  });

  it("retries a transient indexing miss without inventing finality", async () => {
    const { readClient, writeClient } = clients();
    const progress = vi.fn();
    vi.mocked(readClient.request)
      .mockRejectedValueOnce(new Error("transaction not found while indexing"))
      .mockResolvedValueOnce("FINALIZED");
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
      maxPolls: 2,
    });

    await expect(adapter.lockRound("round-1")).resolves.toEqual({ hash: "0xhash" });
    expect(progress.mock.calls.map(([event]) => event.stage)).toEqual(["submitted", "accepted", "finalized"]);
  });
});
