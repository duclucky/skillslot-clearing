import { describe, expect, it, vi } from "vitest";

import { createA2ARequest, taskDigest } from "./a2aProtocol";
import { evaluateA2ADispatch } from "./a2aDispatchApi";


const contract = "0x00000000000000000000000000000000000000aa";
const requester = "0x00000000000000000000000000000000000000bb";


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


describe("A2A dispatch policy", () => {
  it("returns a deterministic submitted task only after canonical authorization", async () => {
    const canDispatch = vi.fn(async () => true);
    const first = await evaluateA2ADispatch(request(), { contractAddress: contract, canDispatch });
    const second = await evaluateA2ADispatch(request(), { contractAddress: contract, canDispatch });

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
    expect(canDispatch).toHaveBeenCalledWith("round-1", "request-1", requester, await taskDigest(request()));
  });

  it("rejects a body that canonical state did not authorize", async () => {
    const authorizedDigest = await taskDigest(request());
    const canDispatch = vi.fn(async (_roundId, _requestId, _requester, digest) => digest === authorizedDigest);

    const result = await evaluateA2ADispatch(request("Altered task body."), { contractAddress: contract, canDispatch });

    expect(result).toEqual({ status: 403, body: { ok: false, error: "Task is not authorized by an active SkillSlot grant" } });
  });

  it("rejects chain and configured-contract mismatches before a canonical read", async () => {
    const wrongContract = request();
    wrongContract.metadata.skillslot.contract = "0x00000000000000000000000000000000000000cc";
    const canDispatch = vi.fn(async () => true);

    await expect(evaluateA2ADispatch(wrongContract, { contractAddress: contract, canDispatch })).resolves.toMatchObject({ status: 403 });
    expect(canDispatch).not.toHaveBeenCalled();

    const wrongChain = request();
    wrongChain.metadata.skillslot.chainId = 1;
    await expect(evaluateA2ADispatch(wrongChain, { contractAddress: contract, canDispatch })).resolves.toMatchObject({ status: 400 });
    expect(canDispatch).not.toHaveBeenCalled();
  });

  it("returns bounded errors for malformed requests and unavailable canonical reads", async () => {
    await expect(evaluateA2ADispatch({ destination: "https://attacker.invalid" }, {
      contractAddress: contract,
      canDispatch: vi.fn(async () => true),
    })).resolves.toEqual({ status: 400, body: { ok: false, error: "Unsupported A2A request field: destination" } });

    await expect(evaluateA2ADispatch(request(), {
      contractAddress: contract,
      canDispatch: vi.fn(async () => { throw new Error("RPC secret detail"); }),
    })).resolves.toEqual({ status: 503, body: { ok: false, error: "Canonical SkillSlot state is temporarily unavailable" } });
  });
});
