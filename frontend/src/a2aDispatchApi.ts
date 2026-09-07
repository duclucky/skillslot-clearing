import {
  parseSkillSlotBinding,
  taskDigest,
  type SendMessageRequest,
} from "./a2aProtocol.js";
import { executorPermitMessage, parseExecutorAuthorization } from "./executorPermit.js";
import type { ExecutorAuthorization } from "./executorPermit.js";

export interface A2ADispatchDependencies {
  contractAddress: string;
  verifyExecutorSignature(executor: string, message: string, signature: string): Promise<boolean>;
  canExecuteDispatch(
    roundId: string,
    requestId: string,
    executor: string,
    digest: string,
    epoch: number,
    expiresAt: number,
  ): Promise<boolean>;
}

export interface A2ADispatchResult {
  status: number;
  body: Record<string, unknown>;
}

function error(status: number, message: string): A2ADispatchResult {
  return { status, body: { ok: false, error: message } };
}

export async function evaluateA2ADispatch(
  body: unknown,
  dependencies: A2ADispatchDependencies,
  authorization?: unknown,
): Promise<A2ADispatchResult> {
  let binding;
  let digest;
  try {
    binding = parseSkillSlotBinding(body);
    digest = await taskDigest(body as SendMessageRequest);
  } catch (cause) {
    return error(400, cause instanceof Error ? cause.message : "Invalid A2A request");
  }
  if (binding.contract !== dependencies.contractAddress.toLowerCase()) {
    return error(403, "A2A request targets a different SkillSlot deployment");
  }

  let parsedAuthorization: ExecutorAuthorization;
  try {
    parsedAuthorization = parseExecutorAuthorization(authorization);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid delegated executor authorization";
    return error(message === "Missing delegated executor authorization" ? 401 : 400, message);
  }

  let signed = false;
  try {
    signed = await dependencies.verifyExecutorSignature(
      parsedAuthorization.executor,
      await executorPermitMessage({
        request: body as SendMessageRequest,
        executor: parsedAuthorization.executor,
        epoch: parsedAuthorization.epoch,
        expiresAt: parsedAuthorization.expiresAt,
      }),
      parsedAuthorization.signature,
    );
  } catch {
    return error(401, "Executor signature could not be verified");
  }
  if (!signed) return error(401, "Executor signature is invalid");

  let allowed = false;
  try {
    allowed = await dependencies.canExecuteDispatch(
      binding.roundId,
      binding.requestId,
      parsedAuthorization.executor,
      digest,
      parsedAuthorization.epoch,
      parsedAuthorization.expiresAt,
    );
  } catch {
    return error(503, "Canonical SkillSlot state is temporarily unavailable");
  }
  if (!allowed) return error(403, "Delegated executor permit is not active");

  const request = body as SendMessageRequest;
  return {
    status: 200,
    body: {
      task: {
        id: `skillslot-${digest.slice(0, 32)}`,
        contextId: `skillslot-${binding.roundId}`,
        status: { state: "TASK_STATE_SUBMITTED" },
        history: [request.message],
        metadata: {
          skillslot: {
            ...binding,
            taskDigest: digest,
            executor: parsedAuthorization.executor,
            executorEpoch: parsedAuthorization.epoch,
            executorExpiresAt: parsedAuthorization.expiresAt,
          },
        },
      },
    },
  };
}
