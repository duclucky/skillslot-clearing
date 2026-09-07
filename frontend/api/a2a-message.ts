import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { verifyMessage } from "viem";

import { evaluateA2ADispatch } from "../src/a2aDispatchApi.js";
import { EXECUTOR_EXTENSION_URI } from "../src/executorPermit.js";

type VercelRequest = {
  body?: unknown;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
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

function header(request: VercelRequest, name: string): string | undefined {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("access-control-allow-origin", "https://skillslot-clearing.vercel.app");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    "content-type, a2a-extensions, skillslot-executor, skillslot-executor-epoch, skillslot-executor-expires-at, skillslot-executor-signature",
  );
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Use POST for A2A message:send" });
    return;
  }
  const requestedExtensions = (header(request, "a2a-extensions") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requestedExtensions.includes(EXECUTOR_EXTENSION_URI)) {
    response.status(400).json({ ok: false, error: "Required delegated executor extension is missing" });
    return;
  }
  const address = contractAddress();
  if (!address) {
    response.status(503).json({ ok: false, error: "SkillSlot contract is not configured" });
    return;
  }
  const endpoint = (process.env.STUDIONET_RPC_URL || process.env.GENLAYER_RPC_URL || DEFAULT_STUDIONET_RPC_URL).trim();
  const client = createClient({ chain: studionet, endpoint });
  const executor = header(request, "skillslot-executor");
  const epoch = header(request, "skillslot-executor-epoch");
  const expiresAt = header(request, "skillslot-executor-expires-at");
  const signature = header(request, "skillslot-executor-signature");
  const authorization = executor || epoch || expiresAt || signature
    ? { executor, epoch, expiresAt, signature }
    : undefined;
  const result = await evaluateA2ADispatch(parseBody(request.body), {
    contractAddress: address,
    verifyExecutorSignature: async (claimedExecutor, message, claimedSignature) => verifyMessage({
      address: claimedExecutor as `0x${string}`,
      message,
      signature: claimedSignature as `0x${string}`,
    }),
    canExecuteDispatch: async (roundId, requestId, claimedExecutor, digest, executorEpoch, executorExpiresAt) => {
      const canonicalAllowed = await client.readContract({
        address,
        functionName: "can_execute_dispatch",
        args: [roundId, requestId, claimedExecutor, digest, executorEpoch, executorExpiresAt],
        jsonSafeReturn: true,
      });
      return canonicalAllowed === true;
    },
  }, authorization);
  response.status(result.status).json(result.body);
}
