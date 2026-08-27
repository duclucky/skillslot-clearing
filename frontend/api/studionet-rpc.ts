type VercelRequest = {
  body?: unknown;
  method?: string;
};

type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  json(body: unknown): void;
};

declare const process: {
  env: Record<string, string | undefined>;
};

const DEFAULT_STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
const ALLOWED_METHODS = new Set(["eth_chainId", "gen_call", "gen_getTransactionStatus"]);

function rpcUrl() {
  return process.env.STUDIONET_RPC_URL?.trim() || process.env.GENLAYER_RPC_URL?.trim() || DEFAULT_STUDIONET_RPC_URL;
}

function entries(payload: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(payload)) {
    return payload.every((item) => item && typeof item === "object") ? payload as Array<Record<string, unknown>> : null;
  }
  return payload && typeof payload === "object" ? [payload as Record<string, unknown>] : null;
}

function parseBody(body: unknown) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isAllowedPayload(payload: unknown) {
  const calls = entries(payload);
  return Boolean(calls?.length) && calls.every((call) => typeof call.method === "string" && ALLOWED_METHODS.has(call.method));
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("access-control-allow-origin", "https://skillslot-clearing.vercel.app");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");

  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Use POST for Studionet RPC reads" });
    return;
  }
  const payload = parseBody(request.body);
  if (!isAllowedPayload(payload)) {
    response.status(403).json({ ok: false, error: "RPC method is not allowed through the read proxy" });
    return;
  }

  try {
    const upstream = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await upstream.text();
    response.setHeader("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    response.status(upstream.status).send(body);
  } catch {
    response.status(502).json({ ok: false, error: "Studionet RPC proxy could not reach upstream" });
  }
}
