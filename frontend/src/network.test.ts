import { describe, expect, it } from "vitest";
import { ACTIVE_CHAIN, NETWORK_LABEL, RPC_URL, EXPLORER_URL } from "./network";
import { createA2ARequest, parseSkillSlotBinding } from "./a2aProtocol";

describe("Studio Dev network identity", () => {
  it("uses one explicit SDK network and canonical endpoint, never relabelled Studionet", () => {
    expect(ACTIVE_CHAIN.id).toBe(61997);
    expect(RPC_URL).toBe("https://studio-dev.genlayer.com/api");
    expect(EXPLORER_URL).toBe("https://explorer-studio-dev.genlayer.com");
    expect(NETWORK_LABEL).toBe("Studio Dev");
  });
  it("binds new dispatch to Studio Dev and rejects replay from the historical chain", () => {
    const request = createA2ARequest({ contract: `0x${"a".repeat(40)}`, roundId: "round-new", requestId: "request-new", requester: `0x${"b".repeat(40)}`, text: "Run a bounded task", messageId: "message-new", nonce: "nonce-1234567890abcdef" });
    expect(request.metadata.skillslot.chainId).toBe(61997);
    const legacy = structuredClone(request);
    legacy.metadata.skillslot.chainId = 61999;
    expect(() => parseSkillSlotBinding(legacy)).toThrow("Unsupported SkillSlot chain");
  });
});
