import { describe, expect, it, vi } from "vitest";

import { createA2ARequest, taskDigest } from "./a2aProtocol";
import { evaluateA2ADispatch } from "./a2aDispatchApi";


const contract = "0x00000000000000000000000000000000000000aa";
const requester = "0x00000000000000000000000000000000000000bb";
const executor = "0x00000000000000000000000000000000000000cc";
const signature = `0x${"11".repeat(65)}`;


function request(text = "Summarize the verified access request.") {
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
  return { executor, epoch: 1, expiresAt: 1_900_000_000, signature };
}

function dependencies(canExecuteDispatch: (...args: unknown[]) => Promise<boolean> = vi.fn(async () => true)) {
  return {
    contractAddress: contract,
    verifyExecutorSignature: vi.fn(async () => true),
    canExecuteDispatch,
  };
}


describe("A2A dispatch policy", () => {
  it("returns a deterministic submitted task only after canonical authorization", async () => {
    const canExecuteDispatch = vi.fn(async () => true);
    const deps = dependencies(canExecuteDispatch);
    const first = await evaluateA2ADispatch(request(), deps, authorization());
    const second = await evaluateA2ADispatch(request(), deps, authorization());

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      task: {
        id: expect.stringMatching(/^skillslot-[0-9a-f]{32}$/),
        contextId: "skillslot-round-1",
        status: { state: "TASK_STATE_SUBMITTED" },
        metadata: { skillslot: { roundId: "round-1", requestId: "request-1" } },
      },
    });
    expect(second.body).toEqual(first.body);
    expect(canExecuteDispatch).toHaveBeenCalledWith(
      "round-1", "request-1", executor, await taskDigest(request()), 1, 1_900_000_000,
    );
  });

  it("rejects a body that canonical state did not authorize", async () => {
    const authorizedDigest = await taskDigest(request());
    const canExecuteDispatch = vi.fn(async (_roundId, _requestId, _executor, digest) => digest === authorizedDigest);

    const result = await evaluateA2ADispatch(request("Altered task body."), dependencies(canExecuteDispatch), authorization());

    expect(result).toEqual({ status: 403, body: { ok: false, error: "Delegated executor permit is not active" } });
  });

  it("rejects chain and configured-contract mismatches before a canonical read", async () => {
    const wrongContract = request();
    wrongContract.metadata.skillslot.contract = "0x00000000000000000000000000000000000000cc";
    const canExecuteDispatch = vi.fn(async () => true);

    await expect(evaluateA2ADispatch(wrongContract, dependencies(canExecuteDispatch), authorization())).resolves.toMatchObject({ status: 403 });
    expect(canExecuteDispatch).not.toHaveBeenCalled();

    const wrongChain = request();
    wrongChain.metadata.skillslot.chainId = 1;
    await expect(evaluateA2ADispatch(wrongChain, dependencies(canExecuteDispatch), authorization())).resolves.toMatchObject({ status: 400 });
    expect(canExecuteDispatch).not.toHaveBeenCalled();
  });

  it("returns bounded errors for malformed requests and unavailable canonical reads", async () => {
    await expect(evaluateA2ADispatch({ destination: "https://attacker.invalid" }, {
      ...dependencies(),
    })).resolves.toEqual({ status: 400, body: { ok: false, error: "Unsupported A2A request field: destination" } });

    await expect(evaluateA2ADispatch(
      request(),
      dependencies(vi.fn(async () => { throw new Error("RPC secret detail"); })),
      authorization(),
    )).resolves.toEqual({ status: 503, body: { ok: false, error: "Canonical SkillSlot state is temporarily unavailable" } });
  });
});
