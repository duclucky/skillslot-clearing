import { describe, expect, it } from "vitest";

import { createA2ARequest, taskDigest } from "./a2aProtocol";
import {
  EXECUTOR_PERMIT_VERSION,
  createExecutorPackage,
  executorPermitHeaders,
  executorPermitMessage,
  parseExecutorPackage,
} from "./executorPermit";


const contract = "0x00000000000000000000000000000000000000aa";
const requester = "0x00000000000000000000000000000000000000bb";
const executor = "0x00000000000000000000000000000000000000cc";


function request() {
  return createA2ARequest({
    contract,
    roundId: "round-1",
    requestId: "request-1",
    requester,
    text: "Execute this validator-cleared task.",
    messageId: "message-12345678",
    nonce: "nonce-1234567890abcdef",
  });
}


describe("delegated executor permit", () => {
  it("builds one deterministic domain-separated message", async () => {
    const digest = await taskDigest(request());
    const message = await executorPermitMessage({
      request: request(), executor, epoch: 2, expiresAt: 1_900_000_000,
    });

    expect(message).toBe([
      "SkillSlot Delegated Execution Permit",
      `version:${EXECUTOR_PERMIT_VERSION}`,
      "chainId:61999",
      `contract:${contract}`,
      "roundId:round-1",
      "requestId:request-1",
      `requester:${requester}`,
      `taskDigest:${digest}`,
      `executor:${executor}`,
      "epoch:2",
      "expiresAt:1900000000",
    ].join("\n"));
  });

  it("round-trips a public package without a signature", async () => {
    const value = await createExecutorPackage({
      request: request(), executor, epoch: 2, expiresAt: 1_900_000_000,
    });
    expect(value.version).toBe(EXECUTOR_PERMIT_VERSION);
    expect(value.taskDigest).toBe(await taskDigest(request()));
    expect(value).not.toHaveProperty("signature");
    await expect(parseExecutorPackage(JSON.stringify(value))).resolves.toEqual(value);
  });

  it("rejects altered, stale-looking, and malformed package bindings", async () => {
    const value = await createExecutorPackage({
      request: request(), executor, epoch: 2, expiresAt: 1_900_000_000,
    });
    await expect(parseExecutorPackage(JSON.stringify({ ...value, taskDigest: "a".repeat(64) })))
      .rejects.toThrow("Package task digest does not match its A2A request");
    await expect(parseExecutorPackage(JSON.stringify({ ...value, epoch: 0 })))
      .rejects.toThrow("Invalid executor epoch");
    await expect(parseExecutorPackage("not-json")).rejects.toThrow("Invalid executor package JSON");
  });

  it("creates the exact bounded HTTP authorization headers", () => {
    expect(executorPermitHeaders({
      executor,
      epoch: 2,
      expiresAt: 1_900_000_000,
      signature: `0x${"11".repeat(65)}`,
    })).toEqual({
      "A2A-Extensions": "https://skillslot-clearing.vercel.app/extensions/delegated-executor/v1",
      "skillslot-executor": executor,
      "skillslot-executor-epoch": "2",
      "skillslot-executor-expires-at": "1900000000",
      "skillslot-executor-signature": `0x${"11".repeat(65)}`,
    });
  });
});
