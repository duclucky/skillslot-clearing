import { describe, expect, it } from "vitest";

import {
  canonicalProviderMetadataBody,
  generatedMetadataUri,
  generateProviderMetadata,
  metadataSignature,
} from "./providerMetadata";

describe("generated provider metadata", () => {
  it("serializes canonical metadata in the contract-verified field order", () => {
    expect(canonicalProviderMetadataBody({
      agentId: "agent-2",
      capabilityIdsCsv: "FLIGHT.BOOK,CALENDAR.WRITE",
      deliverySource: "a2a://agent-2/route",
      expiresAt: 1800000000,
      provider: "0xC495ef51618D03267A1f227aFe5b27B38c748272",
    })).toBe('{"agent_id":"agent-2","capability_ids_csv":"FLIGHT.BOOK,CALENDAR.WRITE","delivery_source":"a2a://agent-2/route","expires_at":1800000000,"issuer":"SkillSlotAgentRegistry","policy_version":"skillslot-agent-metadata-v1","provider":"0xc495ef51618d03267a1f227afe5b27b38c748272"}');
  });

  it("builds an authorized production metadata URI under /agents/", () => {
    const uri = generatedMetadataUri({
      agentId: "agent-2",
      capabilityIdsCsv: "FLIGHT.BOOK,CALENDAR.WRITE",
      deliverySource: "a2a://agent-2/route",
      expiresAt: 1800000000,
      provider: "0xC495ef51618D03267A1f227aFe5b27B38c748272",
    });

    expect(uri.startsWith("https://skillslot-clearing.vercel.app/agents/")).toBe(true);
    expect(uri).toContain("/agents/generated/agent-2.json?");
    expect(uri).toContain("provider=0xc495ef51618d03267a1f227afe5b27b38c748272");
  });

  it("computes the SHA-256 hash and registry signature used by submit_offer", async () => {
    const metadata = await generateProviderMetadata({
      agentId: "agent-2",
      capabilityIdsCsv: "FLIGHT.BOOK,CALENDAR.WRITE",
      deliverySource: "a2a://agent-2/route",
      expiresAt: 1800000000,
      provider: "0xC495ef51618D03267A1f227aFe5b27B38c748272",
    });

    expect(metadata.metadataHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.metadataSignature).toBe(metadataSignature(metadata.metadataHash));
    expect(metadata.metadataIssuer).toBe("SkillSlotAgentRegistry");
    expect(metadata.metadataExpiresAt).toBe("1800000000");
    expect(metadata.body).toContain('"policy_version":"skillslot-agent-metadata-v1"');
  });
});
