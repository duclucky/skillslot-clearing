import {
  parseSkillSlotBinding,
  taskDigest,
  type SendMessageRequest,
} from "./a2aProtocol.js";

export interface A2ADispatchDependencies {
  contractAddress: string;
  canDispatch(
    roundId: string,
    requestId: string,
    requester: string,
    digest: string,
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

  let allowed = false;
  try {
    allowed = await dependencies.canDispatch(
      binding.roundId,
      binding.requestId,
      binding.requester,
      digest,
    );
  } catch {
    return error(503, "Canonical SkillSlot state is temporarily unavailable");
  }
  if (!allowed) return error(403, "Task is not authorized by an active SkillSlot grant");

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
          },
        },
      },
    },
  };
}
