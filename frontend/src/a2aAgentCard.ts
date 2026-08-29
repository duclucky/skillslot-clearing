export function skillSlotAgentCard(origin: string) {
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:") throw new Error("Agent Card origin must use HTTPS");
  const base = parsed.origin;
  return {
    name: "SkillSlot Routing Agent",
    description: "Validates an onchain-bound SkillSlot grant and returns a submitted handoff receipt; this is not service completion.",
    supportedInterfaces: [{
      url: `${base}/a2a/v1`,
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    }],
    provider: {
      url: base,
      organization: "SkillSlot",
    },
    version: "1.0.0",
    documentationUrl: `${base}/`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [{
      id: "verify-skillslot-route",
      name: "Verify a SkillSlot route",
      description: "Accept one exact A2A task whose digest was committed by the matched requester for an active validator-cleared grant.",
      tags: ["genlayer", "routing", "access", "authorization"],
      examples: ["Submit a task bound to an active SkillSlot grant."],
      inputModes: ["text/plain"],
      outputModes: ["application/json"],
      securityRequirements: [],
    }],
  };
}
