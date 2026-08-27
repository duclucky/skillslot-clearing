import { describe, expect, it } from "vitest";

import { canonicalProviderMetadataBody } from "./providerMetadata";
import { providerMetadataBodyFromQuery } from "./providerMetadataApi";

describe("provider metadata API payload", () => {
  it("returns the same canonical body that the frontend hashes", () => {
    const query = new URLSearchParams({
      provider: "0xC495ef51618D03267A1f227aFe5b27B38c748272",
      capability_ids_csv: "FLIGHT.BOOK,CALENDAR.WRITE",
      delivery_source: "a2a://agent-2/route",
      expires_at: "1800000000",
    });

    expect(providerMetadataBodyFromQuery("agent-2", query)).toBe(canonicalProviderMetadataBody({
      agentId: "agent-2",
      capabilityIdsCsv: "FLIGHT.BOOK,CALENDAR.WRITE",
      deliverySource: "a2a://agent-2/route",
      expiresAt: 1800000000,
      provider: "0xC495ef51618D03267A1f227aFe5b27B38c748272",
    }));
  });

  it("rejects malformed provider addresses before producing metadata", () => {
    expect(() => providerMetadataBodyFromQuery("agent-2", new URLSearchParams({
      provider: "not-a-wallet",
      capability_ids_csv: "FLIGHT.BOOK",
      delivery_source: "a2a://agent-2/route",
      expires_at: "1800000000",
    }))).toThrow("Invalid provider address");
  });
});
