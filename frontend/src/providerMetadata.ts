export const METADATA_ISSUER = "SkillSlotAgentRegistry";
export const METADATA_POLICY_VERSION = "skillslot-agent-metadata-v1";
export const METADATA_PUBLIC_BASE_URL = "https://skillslot-clearing.vercel.app";
export const DEFAULT_METADATA_EXPIRES_AT = 1_800_000_000;

export interface ProviderMetadataInput {
  agentId: string;
  capabilityIdsCsv: string;
  deliverySource: string;
  expiresAt?: number;
  provider: string;
}

export interface GeneratedProviderMetadata {
  body: string;
  metadataUri: string;
  metadataHash: string;
  metadataIssuer: string;
  metadataSignature: string;
  metadataExpiresAt: string;
}

function normalizedProvider(provider: string) {
  return provider.trim().toLowerCase();
}

function expiry(input: ProviderMetadataInput) {
  return input.expiresAt ?? DEFAULT_METADATA_EXPIRES_AT;
}

export function canonicalProviderMetadataBody(input: ProviderMetadataInput) {
  return JSON.stringify({
    agent_id: input.agentId.trim(),
    capability_ids_csv: input.capabilityIdsCsv.trim(),
    delivery_source: input.deliverySource.trim(),
    expires_at: expiry(input),
    issuer: METADATA_ISSUER,
    policy_version: METADATA_POLICY_VERSION,
    provider: normalizedProvider(input.provider),
  });
}

export function generatedMetadataUri(input: ProviderMetadataInput) {
  const params = new URLSearchParams({
    provider: normalizedProvider(input.provider),
    capability_ids_csv: input.capabilityIdsCsv.trim(),
    delivery_source: input.deliverySource.trim(),
    expires_at: String(expiry(input)),
  });
  return `${METADATA_PUBLIC_BASE_URL}/agents/generated/${encodeURIComponent(input.agentId.trim())}.json?${params.toString()}`;
}

export function metadataSignature(hash: string) {
  return `${METADATA_ISSUER}:v1:${hash.toLowerCase()}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateProviderMetadata(input: ProviderMetadataInput): Promise<GeneratedProviderMetadata> {
  const body = canonicalProviderMetadataBody(input);
  const metadataHash = await sha256Hex(body);
  return {
    body,
    metadataUri: generatedMetadataUri(input),
    metadataHash,
    metadataIssuer: METADATA_ISSUER,
    metadataSignature: metadataSignature(metadataHash),
    metadataExpiresAt: String(expiry(input)),
  };
}
