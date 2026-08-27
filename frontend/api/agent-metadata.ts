import { providerMetadataBodyFromQuery } from "../src/providerMetadataApi";

type VercelRequest = {
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  json(body: unknown): void;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function handler(request: VercelRequest, response: VercelResponse) {
  const agentId = first(request.query?.agentId) ?? "";
  const query = new URLSearchParams();
  for (const key of ["provider", "capability_ids_csv", "delivery_source", "expires_at"]) {
    const value = first(request.query?.[key]);
    if (value) query.set(key, value);
  }
  try {
    const body = providerMetadataBodyFromQuery(agentId, query);
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "public, max-age=300");
    response.status(200).send(body);
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid metadata request",
    });
  }
}
