import { canonicalProviderMetadataBody } from "./providerMetadata";

const agentIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const walletPattern = /^0x[0-9a-fA-F]{40}$/;

function required(query: URLSearchParams, key: string) {
  const value = query.get(key)?.trim() ?? "";
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

export function providerMetadataBodyFromQuery(agentId: string, query: URLSearchParams) {
  if (!agentIdPattern.test(agentId)) throw new Error("Invalid agent ID");
  const provider = required(query, "provider");
  if (!walletPattern.test(provider)) throw new Error("Invalid provider address");
  const capabilityIdsCsv = required(query, "capability_ids_csv");
  const deliverySource = required(query, "delivery_source");
  const expiresAtText = required(query, "expires_at");
  if (!/^\d+$/.test(expiresAtText)) throw new Error("Invalid expiry");
  return canonicalProviderMetadataBody({
    agentId,
    capabilityIdsCsv,
    deliverySource,
    expiresAt: Number(expiresAtText),
    provider,
  });
}
