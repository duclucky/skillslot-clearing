import { describe, expect, it, vi } from "vitest";

import { createGenLayerAdapter, ONE_GEN_WEI, type GenLayerClientLike } from "./contractAdapter";
import type { ContractAdapter } from "./domain";

const address = "0x00000000000000000000000000000000000000aa" as const;
const account = "0x00000000000000000000000000000000000000bb" as const;

function offerInput(overrides = {}) {
  return {
    roundId: "round-1",
    offerId: "offer-2",
    label: "Agent",
    promise: "Find sources",
    capabilityIds: "web",
    agentId: "agent-2",
    metadataUri: "https://skillslot-clearing.vercel.app/agents/agent-2",
    metadataHash: "a".repeat(64),
    metadataIssuer: "SkillSlotAgentRegistry",
    metadataSignature: `SkillSlotAgentRegistry:v1:${"a".repeat(64)}`,
    metadataExpiresAt: "1800000000",
    ...overrides,
  };
}

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
        expired: false,
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
      return {
        request_id: args?.[1],
        requester: account,
        provider: account,
        offer_id: "offer-1",
        grant_status: "ACTIVE",
        dispatch_digest: "a".repeat(64),
        dispatch_status: "AUTHORIZED",
        executor: "0x00000000000000000000000000000000000000cc",
        executor_status: "AUTHORIZED",
         executor_expires_at: "1900000000",
         executor_epoch: "2",
         delivery_status: "AWAITING_DELIVERY",
         delivery_artifact: "",
         delivery_digest: "",
         delivery_reason: "",
         delivery_deadline: "1900003600",
         delivery_recovery_at: "1900010800",
         delivery_attempt_count: "0",
      };
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
  it("retries transient canonical reads before failing the workspace load", async () => {
    const { readClient, writeClient } = clients();
    const originalRead = vi.mocked(readClient.readContract).getMockImplementation()!;
    vi.mocked(readClient.readContract)
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockImplementation(originalRead);
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      readRetryDelayMs: 0,
      maxReadAttempts: 3,
    });

    await expect(adapter.loadWorkspace()).resolves.toEqual(expect.objectContaining({
      rounds: [expect.objectContaining({ id: "round-1" })],
    }));
    expect(readClient.readContract).toHaveBeenCalledTimes(10);
  });

  it("does not retry deterministic canonical read failures", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(readClient.readContract).mockRejectedValue(new Error("Contract method not found"));
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      readRetryDelayMs: 0,
      maxReadAttempts: 3,
    });

    await expect(adapter.loadWorkspace()).rejects.toThrow("Contract method not found");
    expect(readClient.readContract).toHaveBeenCalledTimes(1);
  });

  it("reads every canonical view needed to rebuild the wallet workspace", async () => {
    const { readClient, writeClient } = clients();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
    });

    const snapshot = await adapter.loadWorkspace();

    expect(snapshot.rounds.map((round) => round.id)).toEqual(["round-1"]);
    expect(snapshot.creditGen).toBe("1");
    expect(snapshot.positions.map((item) => item.kind)).toEqual(["offer", "request", "grant", "delivery"]);
    expect(snapshot.positions.find((item) => item.kind === "grant")).toMatchObject({
      dispatchDigest: "a".repeat(64),
      dispatchStatus: "AUTHORIZED",
      executor: "0x00000000000000000000000000000000000000cc",
      executorStatus: "AUTHORIZED",
      executorExpiresAt: "1900000000",
      executorEpoch: "2",
      deliveryStatus: "AWAITING_DELIVERY",
      deliveryDeadline: "1900003600",
    });
    expect(snapshot.positions.find((item) => item.kind === "delivery")).toMatchObject({
      actorRole: "provider",
      deliveryStatus: "AWAITING_DELIVERY",
      deliveryRecoveryAt: "1900010800",
    });
    expect(readClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "can_route" }));
    expect(readClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "get_accounting" }));
  });

  it("loads every round and aggregates wallet positions across their canonical state", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(readClient.readContract).mockImplementation(async ({ functionName, args }) => {
      if (functionName === "get_round_ids") return ["round-open", "round-cleared", "round-cancelled"];
      if (functionName === "get_round") {
        const id = String(args?.[0]);
        return {
          round_id: id,
          creator: account,
          title: id,
          phase: id === "round-open" ? "OPEN" : id === "round-cleared" ? "CLEARED" : "CANCELLED",
          booking_fee_wei: ONE_GEN_WEI.toString(),
          provider_bond_wei: ONE_GEN_WEI.toString(),
          expired: false,
          offer_ids_csv: id === "round-cancelled" ? "" : `offer-${id}`,
          request_ids_csv: id === "round-cleared" ? `request-${id}` : "",
          offer_count: id === "round-cancelled" ? "0" : "1",
          request_count: id === "round-cleared" ? "1" : "0",
        };
      }
      if (functionName === "get_offer") {
        return { offer_id: args?.[1], provider: account, label: String(args?.[1]), matched_request_id: "", active: true };
      }
      if (functionName === "get_request") {
        return { request_id: args?.[1], requester: account, label: String(args?.[1]), matched_offer_id: "offer-round-cleared", outcome: "MATCHED" };
      }
      if (functionName === "get_match") {
        return { request_id: args?.[1], requester: account, provider: account, offer_id: "offer-round-cleared", grant_status: "CONSUMED" };
      }
      if (functionName === "can_route") return false;
      if (functionName === "get_credit") return "0";
      if (functionName === "get_accounting") return { invariant_holds: true };
      throw new Error(`Unexpected view ${functionName}`);
    });
    const adapter = createGenLayerAdapter({ contractAddress: address, clients: () => ({ readClient, writeClient, account }) });

    const snapshot = await adapter.loadWorkspace();

    expect(snapshot.rounds.map((round) => round.id)).toEqual(["round-open", "round-cleared", "round-cancelled"]);
    expect(snapshot.positions.map((position) => position.roundId)).toEqual([
      "round-open",
       "round-cleared",
       "round-cleared",
       "round-cleared",
       "round-cleared",
     ]);
  });

  it("maps all sixteen writes, exact GEN value, and submitted/accepted/finalized progress", async () => {
    const { readClient, writeClient } = clients();
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
    });

    await adapter.openRound({ roundId: "round-2", title: "New round" });
    await adapter.submitOffer(offerInput());
    await adapter.submitRequest({ roundId: "round-1", requestId: "request-2", label: "Need", need: "Find sources", requiredIds: "web", excludedIds: "" });
    await adapter.lockRound("round-1");
    await adapter.clearRound("round-1");
    await adapter.cancelRound("round-1");
    await adapter.recoverExpiredRound("round-1");
    await adapter.authorizeDispatch({ roundId: "round-1", requestId: "request-1", taskDigest: "a".repeat(64) });
    await adapter.authorizeExecutor({ roundId: "round-1", requestId: "request-1", executor: "0x00000000000000000000000000000000000000cc", expiresAt: "1900000000" });
    await adapter.revokeExecutor({ roundId: "round-1", requestId: "request-1" });
    await adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" });
    await adapter.submitDelivery({ roundId: "round-1", requestId: "request-1", artifact: "ipfs://delivery-proof" });
    await adapter.acceptDelivery({ roundId: "round-1", requestId: "request-1" });
    await adapter.reviewDelivery({ roundId: "round-1", requestId: "request-1" });
    await adapter.recoverDelivery({ roundId: "round-1", requestId: "request-1" });
    await adapter.withdrawCredit(ONE_GEN_WEI.toString());

    expect(writeClient.writeContract).toHaveBeenCalledTimes(16);
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "authorize_dispatch",
      args: ["round-1", "request-1", "a".repeat(64)],
      value: 0n,
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "authorize_executor",
      args: ["round-1", "request-1", "0x00000000000000000000000000000000000000cc", 1900000000n],
      value: 0n,
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "revoke_executor",
      args: ["round-1", "request-1"],
      value: 0n,
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "open_round",
      args: ["round-2", "New round", ONE_GEN_WEI, ONE_GEN_WEI, 3600n, 7200n],
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "submit_offer",
      args: [
        "round-1",
        "offer-2",
        "Agent",
        "Find sources",
        "web",
        "agent-2",
        "https://skillslot-clearing.vercel.app/agents/agent-2",
        "a".repeat(64),
        "SkillSlotAgentRegistry",
        `SkillSlotAgentRegistry:v1:${"a".repeat(64)}`,
        1800000000n,
      ],
      value: ONE_GEN_WEI,
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "submit_offer", value: ONE_GEN_WEI }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "submit_request", value: ONE_GEN_WEI }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "submit_delivery",
      args: ["round-1", "request-1", "ipfs://delivery-proof"],
      value: 0n,
    }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "accept_delivery" }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "review_delivery" }));
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "recover_delivery" }));
    expect(progress.mock.calls.slice(0, 4).map(([event]) => event.stage)).toEqual([
      "wallet",
      "submitted",
      "accepted",
      "finalized",
    ]);
  });

  it("publishes transaction progress to UI subscribers and supports cleanup", async () => {
    const { readClient, writeClient } = clients();
    const listener = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      pollIntervalMs: 0,
    });

    const unsubscribe = adapter.subscribeTransactions(listener);
    await adapter.lockRound("round-1");
    expect(listener.mock.calls.map(([event]) => event.stage)).toEqual(["wallet", "submitted", "accepted", "finalized"]);

    unsubscribe();
    await adapter.cancelRound("round-1");
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("treats wallet rejection as cancellation without polling or retrying the write", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(writeClient.writeContract).mockRejectedValue(
      Object.assign(new Error("User rejected"), { code: 4001 }),
    );
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
    });

    await expect(
      adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" }),
    ).rejects.toMatchObject({ name: "TransactionCancelledError" });
    expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
    expect(readClient.request).not.toHaveBeenCalled();
    expect(progress.mock.calls.map(([event]) => event.stage)).toEqual(["wallet", "cancelled"]);
  });

  it.each([
    ["open_round", (adapter: ContractAdapter) => adapter.openRound({ roundId: "round-2", title: "Round" })],
    ["submit_offer", (adapter: ContractAdapter) => adapter.submitOffer(offerInput())],
    ["submit_request", (adapter: ContractAdapter) => adapter.submitRequest({ roundId: "round-1", requestId: "request-2", label: "Need", need: "Find sources", requiredIds: "web", excludedIds: "" })],
    ["lock_round", (adapter: ContractAdapter) => adapter.lockRound("round-1")],
    ["clear_round", (adapter: ContractAdapter) => adapter.clearRound("round-1")],
    ["cancel_round", (adapter: ContractAdapter) => adapter.cancelRound("round-1")],
    ["recover_expired_round", (adapter: ContractAdapter) => adapter.recoverExpiredRound("round-1")],
    ["authorize_dispatch", (adapter: ContractAdapter) => adapter.authorizeDispatch({ roundId: "round-1", requestId: "request-1", taskDigest: "a".repeat(64) })],
    ["authorize_executor", (adapter: ContractAdapter) => adapter.authorizeExecutor({ roundId: "round-1", requestId: "request-1", executor: "0x00000000000000000000000000000000000000cc", expiresAt: "1900000000" })],
    ["revoke_executor", (adapter: ContractAdapter) => adapter.revokeExecutor({ roundId: "round-1", requestId: "request-1" })],
    ["consume_grant", (adapter: ContractAdapter) => adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" })],
    ["withdraw_credit", (adapter: ContractAdapter) => adapter.withdrawCredit(ONE_GEN_WEI.toString())],
  ])("routes %s through the shared cancellation policy", async (functionName, invoke) => {
    const { readClient, writeClient } = clients();
    vi.mocked(writeClient.writeContract).mockRejectedValue(
      Object.assign(new Error("User denied"), { code: 4001 }),
    );
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      pollIntervalMs: 0,
    });

    await expect(invoke(adapter)).rejects.toMatchObject({ name: "TransactionCancelledError" });
    expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName }));
    expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
  });

  it("marks a transient pre-hash write failure uncertain and never resubmits", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(writeClient.writeContract).mockRejectedValue(new Error("Failed to fetch"));
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
    });

    await expect(adapter.withdrawCredit(ONE_GEN_WEI.toString())).rejects.toMatchObject({
      name: "TransactionSubmissionUncertainError",
      kind: "submission_uncertain",
      message: expect.stringContaining("Transaction submission could not be confirmed"),
    });
    expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
    expect(readClient.request).not.toHaveBeenCalled();
    expect(progress.mock.calls.map(([event]) => [event.stage, event.reason])).toEqual([
      ["wallet", undefined],
      ["recovering", "submission_uncertain"],
    ]);
  });

  it("keeps one known hash through transient status failures", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(readClient.request)
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce("ACCEPTED")
      .mockResolvedValueOnce("FINALIZED");
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
      maxPolls: 3,
    });

    await expect(adapter.lockRound("round-1")).resolves.toEqual({ hash: "0xhash" });
    expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls.map(([event]) => event.stage)).toEqual([
      "wallet",
      "submitted",
      "recovering",
      "accepted",
      "finalized",
    ]);
  });

  it("emits accepted once while following one hash to finality", async () => {
    const { readClient, writeClient } = clients();
    vi.mocked(readClient.request)
      .mockResolvedValueOnce("ACCEPTED")
      .mockResolvedValueOnce("ACCEPTED")
      .mockResolvedValueOnce("FINALIZED");
    const progress = vi.fn();
    const adapter = createGenLayerAdapter({
      contractAddress: address,
      clients: () => ({ readClient, writeClient, account }),
      onTransaction: progress,
      pollIntervalMs: 0,
      maxPolls: 3,
    });

    await adapter.lockRound("round-1");

    expect(progress.mock.calls.filter(([event]) => event.stage === "accepted")).toHaveLength(1);
    expect(readClient.request).toHaveBeenNthCalledWith(3, {
      method: "gen_getTransactionStatus",
      params: ["0xhash"],
    });
  });

  it.each(["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"])(
    "reports terminal status %s as failure without finality",
    async (status) => {
      const { readClient, writeClient } = clients();
      vi.mocked(readClient.request).mockResolvedValue(status);
      const progress = vi.fn();
      const adapter = createGenLayerAdapter({
        contractAddress: address,
        clients: () => ({ readClient, writeClient, account }),
        onTransaction: progress,
        pollIntervalMs: 0,
      });

      await expect(adapter.lockRound("round-1")).rejects.toThrow(`Transaction reached ${status}`);
      expect(progress.mock.calls.map(([event]) => event.stage)).toEqual([
        "wallet",
        "submitted",
        "failed",
      ]);
    },
  );

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
    expect(progress.mock.calls.map(([event]) => event.stage)).toEqual([
      "wallet",
      "submitted",
      "recovering",
      "accepted",
      "finalized",
    ]);
  });
});
