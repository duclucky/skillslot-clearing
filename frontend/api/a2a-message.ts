import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { evaluateA2ADispatch } from "../src/a2aDispatchApi.js";

type VercelRequest = { body?: unknown; method?: string };
type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  json(body: unknown): void;
};

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_STUDIONET_RPC_URL = "https://studio.genlayer.com/api";

function parseBody(body: unknown) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function contractAddress() {
  const value = (process.env.SKILLSLOT_CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? value as `0x${string}` : null;
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
    response.status(405).json({ ok: false, error: "Use POST for A2A message:send" });
    return;
  }
  const address = contractAddress();
  if (!address) {
    response.status(503).json({ ok: false, error: "SkillSlot contract is not configured" });
    return;
  }
  const endpoint = (process.env.STUDIONET_RPC_URL || process.env.GENLAYER_RPC_URL || DEFAULT_STUDIONET_RPC_URL).trim();
  const client = createClient({ chain: studionet, endpoint });
  const result = await evaluateA2ADispatch(parseBody(request.body), {
    contractAddress: address,
    canDispatch: async (roundId, requestId, requester, digest) => {
      const canonicalAllowed = await client.readContract({
        address,
        functionName: "can_dispatch",
        args: [roundId, requestId, requester, digest],
        jsonSafeReturn: true,
      });
      return canonicalAllowed === true;
    },
  });
  response.status(result.status).json(result.body);
}
