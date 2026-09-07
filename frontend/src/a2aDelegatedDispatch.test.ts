import { describe, expect, it, vi } from "vitest";

import { createA2ARequest } from "./a2aProtocol";
import { evaluateA2ADispatch } from "./a2aDispatchApi";
import { executorPermitMessage } from "./executorPermit";


const contract = "0x00000000000000000000000000000000000000aa";
const requester = "0x00000000000000000000000000000000000000bb";
const executor = "0x00000000000000000000000000000000000000cc";
const signature = `0x${"11".repeat(65)}`;

function request(text = "Execute this validator-cleared task.") {
  return createA2ARequest({
    contract,
    roundId: "round-1",
    requestId: "request-1",
    requester,
    text,
    messageId: "message-12345678",
    nonce: "nonce-1234567890abcdef",
  });
}

function authorization() {
  return { executor, epoch: 2, expiresAt: 1_900_000_000, signature };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    contractAddress: contract,
    verifyExecutorSignature: vi.fn(async () => true),
    canExecuteDispatch: vi.fn(async () => true),
    ...overrides,
  };
}

describe("delegated A2A dispatch policy", () => {
  it("requires executor authorization before any canonical read", async () => {
    const deps = dependencies();
    const result = await evaluateA2ADispatch(request(), deps);
    expect(result).toEqual({ status: 401, body: { ok: false, error: "Missing delegated executor authorization" } });
    expect(deps.canExecuteDispatch).not.toHaveBeenCalled();
  });

  it("verifies the exact permit message and canonical state before returning a task", async () => {
    const deps = dependencies();
    const result = await evaluateA2ADispatch(request(), deps, authorization());
    expect(result.status).toBe(200);
    expect(deps.verifyExecutorSignature).toHaveBeenCalledWith(
      executor,
      await executorPermitMessage({ request: request(), executor, epoch: 2, expiresAt: 1_900_000_000 }),
      signature,
    );
    expect(deps.canExecuteDispatch).toHaveBeenCalledWith(
      "round-1", "request-1", executor, expect.stringMatching(/^[0-9a-f]{64}$/), 2, 1_900_000_000,
    );
  });

  it("rejects wrong signatures without revealing canonical permit state", async () => {
    const deps = dependencies({ verifyExecutorSignature: vi.fn(async () => false) });
    const result = await evaluateA2ADispatch(request(), deps, authorization());
    expect(result).toEqual({ status: 401, body: { ok: false, error: "Executor signature is invalid" } });
    expect(deps.canExecuteDispatch).not.toHaveBeenCalled();
  });

  it("fails closed for revoked, expired, stale-epoch, or mismatched permits", async () => {
    const deps = dependencies({ canExecuteDispatch: vi.fn(async () => false) });
    const result = await evaluateA2ADispatch(request(), deps, authorization());
    expect(result).toEqual({ status: 403, body: { ok: false, error: "Delegated executor permit is not active" } });
  });

  it("bounds malformed authorization before signature verification", async () => {
    const deps = dependencies();
    const result = await evaluateA2ADispatch(request(), deps, { ...authorization(), epoch: 0 });
    expect(result).toEqual({ status: 400, body: { ok: false, error: "Invalid executor epoch" } });
    expect(deps.verifyExecutorSignature).not.toHaveBeenCalled();
  });

  it("keeps exact retries deterministic", async () => {
    const deps = dependencies();
    const first = await evaluateA2ADispatch(request(), deps, authorization());
    const second = await evaluateA2ADispatch(request(), deps, authorization());
    expect(second.body).toEqual(first.body);
  });
});
