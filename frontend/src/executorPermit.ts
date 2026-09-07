import {
  STUDIONET_CHAIN_ID,
  parseSkillSlotBinding,
  taskDigest,
  type SendMessageRequest,
} from "./a2aProtocol.js";


export const EXECUTOR_PERMIT_VERSION = "skillslot-executor-permit-v1" as const;
export const EXECUTOR_EXTENSION_URI = "https://skillslot-clearing.vercel.app/extensions/delegated-executor/v1" as const;

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const signaturePattern = /^0x[0-9a-fA-F]{130}$/;

export interface ExecutorPermitInput {
  request: SendMessageRequest;
  executor: string;
  epoch: number;
  expiresAt: number;
}

export interface ExecutorPackage extends ExecutorPermitInput {
  version: typeof EXECUTOR_PERMIT_VERSION;
  taskDigest: string;
}

export interface ExecutorAuthorization {
  executor: string;
  epoch: number;
  expiresAt: number;
  signature: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedExecutor(value: unknown): string {
  const executor = String(value || "").toLowerCase();
  if (!addressPattern.test(executor) || executor === `0x${"0".repeat(40)}`) {
    throw new Error("Invalid executor address");
  }
  return executor;
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${label}`);
  return parsed;
}

export async function executorPermitMessage(input: ExecutorPermitInput): Promise<string> {
  const binding = parseSkillSlotBinding(input.request);
  const executor = normalizedExecutor(input.executor);
  const epoch = positiveInteger(input.epoch, "executor epoch");
  const expiresAt = positiveInteger(input.expiresAt, "executor expiry");
  const digest = await taskDigest(input.request);
  return [
    "SkillSlot Delegated Execution Permit",
    `version:${EXECUTOR_PERMIT_VERSION}`,
    `chainId:${STUDIONET_CHAIN_ID}`,
    `contract:${binding.contract}`,
    `roundId:${binding.roundId}`,
    `requestId:${binding.requestId}`,
    `requester:${binding.requester}`,
    `taskDigest:${digest}`,
    `executor:${executor}`,
    `epoch:${epoch}`,
    `expiresAt:${expiresAt}`,
  ].join("\n");
}

export async function createExecutorPackage(input: ExecutorPermitInput): Promise<ExecutorPackage> {
  const executor = normalizedExecutor(input.executor);
  const epoch = positiveInteger(input.epoch, "executor epoch");
  const expiresAt = positiveInteger(input.expiresAt, "executor expiry");
  return {
    version: EXECUTOR_PERMIT_VERSION,
    request: input.request,
    taskDigest: await taskDigest(input.request),
    executor,
    epoch,
    expiresAt,
  };
}

export async function parseExecutorPackage(value: string): Promise<ExecutorPackage> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid executor package JSON");
  }
  if (!isRecord(parsed) || parsed.version !== EXECUTOR_PERMIT_VERSION) {
    throw new Error("Unsupported executor package version");
  }
  if (!isRecord(parsed.request)) throw new Error("Missing executor package A2A request");
  const request = parsed.request as unknown as SendMessageRequest;
  const executor = normalizedExecutor(parsed.executor);
  const epoch = positiveInteger(parsed.epoch, "executor epoch");
  const expiresAt = positiveInteger(parsed.expiresAt, "executor expiry");
  const digest = await taskDigest(request);
  if (String(parsed.taskDigest || "") !== digest) {
    throw new Error("Package task digest does not match its A2A request");
  }
  return {
    version: EXECUTOR_PERMIT_VERSION,
    request,
    taskDigest: digest,
    executor,
    epoch,
    expiresAt,
  };
}

export function parseExecutorAuthorization(value: unknown): ExecutorAuthorization {
  if (!isRecord(value)) throw new Error("Missing delegated executor authorization");
  const executor = normalizedExecutor(value.executor);
  const epoch = positiveInteger(value.epoch, "executor epoch");
  const expiresAt = positiveInteger(value.expiresAt, "executor expiry");
  const signature = String(value.signature || "");
  if (!signaturePattern.test(signature)) throw new Error("Invalid executor signature");
  return { executor, epoch, expiresAt, signature: signature.toLowerCase() };
}

export function executorPermitHeaders(authorization: ExecutorAuthorization): Record<string, string> {
  const value = parseExecutorAuthorization(authorization);
  return {
    "A2A-Extensions": EXECUTOR_EXTENSION_URI,
    "skillslot-executor": value.executor,
    "skillslot-executor-epoch": String(value.epoch),
    "skillslot-executor-expires-at": String(value.expiresAt),
    "skillslot-executor-signature": value.signature,
  };
}
