import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createA2ARequest,
  parseSkillSlotBinding,
  taskDigest,
} from "./a2aProtocol";


const contract = "0x00000000000000000000000000000000000000Aa";
const requester = "0x00000000000000000000000000000000000000Bb";


function request(overrides = {}) {
  return createA2ARequest({
    contract,
    roundId: "round-1",
    requestId: "request-1",
    requester,
    text: "Summarize the verified access request.",
    messageId: "message-12345678",
    nonce: "nonce-1234567890abcdef",
    ...overrides,
  });
}


describe("bounded A2A 1.0 request", () => {
  it("canonicalizes object keys recursively without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: { y: true, b: "two" }, list: [{ z: 3, a: 2 }, 1] })).toBe(
      '{"a":{"b":"two","y":true},"list":[{"a":2,"z":3},1],"z":1}',
    );
  });

  it("binds a task to the exact SkillSlot deployment and grant", async () => {
    const body = request();

    expect(body).toEqual({
      message: {
        messageId: "message-12345678",
        role: "ROLE_USER",
        parts: [{ text: "Summarize the verified access request.", mediaType: "text/plain" }],
      },
      configuration: { returnImmediately: true },
      metadata: {
        skillslot: {
          chainId: 61999,
          contract: contract.toLowerCase(),
          roundId: "round-1",
          requestId: "request-1",
          requester: requester.toLowerCase(),
          protocolVersion: "1.0",
          nonce: "nonce-1234567890abcdef",
        },
      },
    });
    expect(parseSkillSlotBinding(body)).toMatchObject({
      chainId: 61999,
      contract: contract.toLowerCase(),
      requester: requester.toLowerCase(),
      protocolVersion: "1.0",
    });
    await expect(taskDigest(body)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same digest for semantically identical object key order", async () => {
    const body = request();
    const reordered = {
      metadata: body.metadata,
      configuration: body.configuration,
      message: body.message,
    };

    await expect(taskDigest(reordered)).resolves.toBe(await taskDigest(body));
  });

  it.each([
    [{ text: "" }, "Task text must be 1 to 600 characters"],
    [{ text: "x".repeat(601) }, "Task text must be 1 to 600 characters"],
    [{ contract: "not-a-contract" }, "Invalid contract address"],
    [{ requester: "not-a-requester" }, "Invalid requester address"],
    [{ messageId: "short" }, "Invalid A2A message ID"],
    [{ nonce: "short" }, "Invalid dispatch nonce"],
  ])("rejects an invalid bounded request %#", (overrides, message) => {
    expect(() => request(overrides)).toThrow(message);
  });

  it("rejects actor-supplied destination and protocol overrides", () => {
    const body = request() as unknown as Record<string, unknown>;
    body.destination = "https://attacker.invalid/a2a";
    expect(() => parseSkillSlotBinding(body)).toThrow("Unsupported A2A request field: destination");

    const protocolOverride = request() as unknown as { metadata: { skillslot: Record<string, unknown> } };
    protocolOverride.metadata.skillslot.protocolVersion = "0.3";
    expect(() => parseSkillSlotBinding(protocolOverride)).toThrow("Unsupported A2A protocol version");
  });
});
