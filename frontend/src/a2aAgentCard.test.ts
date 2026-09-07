import { describe, expect, it } from "vitest";

import { skillSlotAgentCard } from "./a2aAgentCard";


describe("SkillSlot reference Agent Card", () => {
  it("advertises one bounded HTTP+JSON 1.0 routing skill", () => {
    const card = skillSlotAgentCard("https://skillslot-clearing.vercel.app");

    expect(card.supportedInterfaces).toEqual([{
      url: "https://skillslot-clearing.vercel.app/a2a/v1",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    }]);
    expect(card.skills).toEqual([expect.objectContaining({ id: "verify-skillslot-route" })]);
    expect(card.capabilities.extensions).toEqual([expect.objectContaining({
      uri: "https://skillslot-clearing.vercel.app/extensions/delegated-executor/v1",
      required: true,
    })]);
    expect("signatures" in card).toBe(false);
    expect(card.description).toContain("submitted handoff receipt");
    expect(card.description).toContain("not service completion");
    expect(card.description).toContain("delegated executor");
  });

  it("rejects a non-HTTPS production origin", () => {
    expect(() => skillSlotAgentCard("http://skillslot-clearing.vercel.app")).toThrow("Agent Card origin must use HTTPS");
  });
});
