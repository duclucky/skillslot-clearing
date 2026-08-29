export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const STUDIONET_CHAIN_ID = 61999;
export const A2A_PROTOCOL_VERSION = "1.0";
export const MAX_A2A_TASK_LENGTH = 600;

export interface SkillSlotBinding {
  chainId: number;
  contract: string;
  roundId: string;
  requestId: string;
  requester: string;
  protocolVersion: "1.0";
  nonce: string;
}

export interface SendMessageRequest {
  message: {
    messageId: string;
    role: "ROLE_USER";
    parts: Array<{ text: string; mediaType: "text/plain" }>;
  };
  configuration: { returnImmediately: true };
  metadata: { skillslot: SkillSlotBinding };
}

export interface A2ARequestInput {
  contract: string;
  roundId: string;
  requestId: string;
  requester: string;
  text: string;
  messageId: string;
  nonce: string;
}

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const entityPattern = /^[A-Za-z0-9._-]{3,80}$/;
const messagePattern = /^[A-Za-z0-9._-]{8,80}$/;
const noncePattern = /^[A-Za-z0-9._-]{16,80}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalValue(value: JsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON requires finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
}

export function canonicalJson(value: JsonValue): string {
  return canonicalValue(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createA2ARequest(input: A2ARequestInput): SendMessageRequest {
  const text = input.text.trim();
  if (!addressPattern.test(input.contract)) throw new Error("Invalid contract address");
  if (!addressPattern.test(input.requester)) throw new Error("Invalid requester address");
  if (!entityPattern.test(input.roundId)) throw new Error("Invalid round ID");
  if (!entityPattern.test(input.requestId)) throw new Error("Invalid request ID");
  if (!messagePattern.test(input.messageId)) throw new Error("Invalid A2A message ID");
  if (!noncePattern.test(input.nonce)) throw new Error("Invalid dispatch nonce");
  if (text.length < 1 || text.length > MAX_A2A_TASK_LENGTH) {
    throw new Error("Task text must be 1 to 600 characters");
  }
  return {
    message: {
      messageId: input.messageId,
      role: "ROLE_USER",
      parts: [{ text, mediaType: "text/plain" }],
    },
    configuration: { returnImmediately: true },
    metadata: {
      skillslot: {
        chainId: STUDIONET_CHAIN_ID,
        contract: input.contract.toLowerCase(),
        roundId: input.roundId,
        requestId: input.requestId,
        requester: input.requester.toLowerCase(),
        protocolVersion: A2A_PROTOCOL_VERSION,
        nonce: input.nonce,
      },
    },
  };
}

export function parseSkillSlotBinding(value: unknown): SkillSlotBinding {
  if (!isRecord(value)) throw new Error("Invalid A2A request");
  const allowedTopLevel = new Set(["message", "configuration", "metadata"]);
  const unsupported = Object.keys(value).find((key) => !allowedTopLevel.has(key));
  if (unsupported) throw new Error(`Unsupported A2A request field: ${unsupported}`);
  if (!isRecord(value.message) || value.message.role !== "ROLE_USER") throw new Error("Invalid A2A message role");
  if (!messagePattern.test(String(value.message.messageId || ""))) throw new Error("Invalid A2A message ID");
  if (!Array.isArray(value.message.parts) || value.message.parts.length !== 1 || !isRecord(value.message.parts[0])) {
    throw new Error("A2A request must contain one text part");
  }
  const part = value.message.parts[0];
  if (part.mediaType !== "text/plain" || typeof part.text !== "string" || part.text.trim().length < 1 || part.text.trim().length > MAX_A2A_TASK_LENGTH) {
    throw new Error("Task text must be 1 to 600 characters");
  }
  if (!isRecord(value.configuration) || value.configuration.returnImmediately !== true) {
    throw new Error("A2A request must return immediately");
  }
  if (!isRecord(value.metadata) || !isRecord(value.metadata.skillslot)) throw new Error("Missing SkillSlot binding");
  const binding = value.metadata.skillslot;
  if (binding.chainId !== STUDIONET_CHAIN_ID) throw new Error("Unsupported SkillSlot chain");
  if (binding.protocolVersion !== A2A_PROTOCOL_VERSION) throw new Error("Unsupported A2A protocol version");
  if (!addressPattern.test(String(binding.contract || ""))) throw new Error("Invalid contract address");
  if (!addressPattern.test(String(binding.requester || ""))) throw new Error("Invalid requester address");
  if (!entityPattern.test(String(binding.roundId || ""))) throw new Error("Invalid round ID");
  if (!entityPattern.test(String(binding.requestId || ""))) throw new Error("Invalid request ID");
  if (!noncePattern.test(String(binding.nonce || ""))) throw new Error("Invalid dispatch nonce");
  return {
    chainId: STUDIONET_CHAIN_ID,
    contract: String(binding.contract).toLowerCase(),
    roundId: String(binding.roundId),
    requestId: String(binding.requestId),
    requester: String(binding.requester).toLowerCase(),
    protocolVersion: A2A_PROTOCOL_VERSION,
    nonce: String(binding.nonce),
  };
}

export async function taskDigest(request: SendMessageRequest | Record<string, unknown>): Promise<string> {
  parseSkillSlotBinding(request);
  return sha256Hex(canonicalJson(request as JsonValue));
}
