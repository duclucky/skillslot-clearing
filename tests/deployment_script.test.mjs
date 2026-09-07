import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildDispatchProofRequest,
  buildExecutorPermitMessage,
  currentAttemptId,
  deploymentIdentity,
  executeDispatchProof,
  executeExecutorPermitProof,
  formatGenBalance,
  loadEnvironment,
  projectDispatchProofEvidence,
  projectExecutorPermitProofEvidence,
  rpcRetryDelayMs,
  sanitizeEvidence,
  shouldReuseDeployment,
} from "../scripts/deploy_studionet.mjs";

test("project env overrides authorized parent env and process overrides both", () => {
  const parent = mkdtempSync(path.join(tmpdir(), "skillslot-parent-"));
  const project = path.join(parent, "skillslot-clearing");
  mkdirSync(project);
  writeFileSync(path.join(parent, ".env"), "STUDIONET_PRIVATE_KEY=parent\nSHARED=parent\n", "utf8");
  writeFileSync(path.join(project, ".env"), "SHARED=project\nPROJECT_ONLY=yes\n", "utf8");

  const env = loadEnvironment(project, { PROJECT_ONLY: "process" });

  assert.equal(env.STUDIONET_PRIVATE_KEY, "parent");
  assert.equal(env.SHARED, "project");
  assert.equal(env.PROJECT_ONLY, "process");
});

test("deployment identity binds network source runner and exact contract hash", () => {
  assert.deepEqual(
    deploymentIdentity({ sourceCommit: "abc", contractSha256: "def", runner: "py-genlayer:locked" }),
    {
      network: "studionet",
      sourceCommit: "abc",
      contractSha256: "def",
      runner: "py-genlayer:locked",
    },
  );
});

test("only an exact finalized contract/API revision can be reused across later evidence commits", () => {
  const identity = deploymentIdentity({ sourceCommit: "abc", contractSha256: "def", runner: "runner" });
  const evidence = { identity, deployment: { status: "FINALIZED", contractAddress: "0x111" } };

  assert.equal(shouldReuseDeployment(evidence, identity), true);
  assert.equal(shouldReuseDeployment({ ...evidence, deployment: { status: "SUBMITTED" } }, identity), false);
  assert.equal(shouldReuseDeployment(evidence, { ...identity, contractSha256: "changed" }), false);
  assert.equal(shouldReuseDeployment(evidence, { ...identity, sourceCommit: "later-evidence-commit" }), true);
});

test("retry reads the current canonical attempt count and never hardcodes minus one", () => {
  assert.equal(currentAttemptId({ attempt_count: "7" }), 7);
  assert.equal(currentAttemptId({ attemptCount: 3 }), 3);
  assert.throws(() => currentAttemptId({}), /attempt count/i);
});

test("evidence projection drops unknown receipt validator and secret fields", () => {
  const projected = sanitizeEvidence({
    transactionHash: "0xabc",
    status: "FINALIZED",
    execution: "FINISHED_WITH_RETURN",
    finalizedAt: "2026-08-12T00:00:00Z",
    contractAddress: "0x111",
    errorCode: null,
    node_config: { private: true },
    stdout: "secret",
    trace: { private: true },
  });

  assert.deepEqual(projected, {
    transactionHash: "0xabc",
    status: "FINALIZED",
    execution: "FINISHED_WITH_RETURN",
    finalizedAt: "2026-08-12T00:00:00Z",
    contractAddress: "0x111",
    errorCode: null,
  });
});

test("Studionet rate limits honor the server retry window through nested RPC causes", () => {
  const error = {
    cause: {
      code: -32029,
      data: { retry_after_seconds: 60 },
    },
  };
  assert.equal(rpcRetryDelayMs(error), 61_000);
  assert.equal(rpcRetryDelayMs(new Error("ordinary contract failure")), null);
});

test("balance evidence is reported in GEN rather than base-unit integers", () => {
  assert.equal(formatGenBalance(2n * 10n ** 18n), "2 GEN");
  assert.equal(formatGenBalance(15n * 10n ** 17n), "1.5 GEN");
});

test("dispatch proof binds one deterministic request to the active deployment and grant", () => {
  const input = {
    contractAddress: "0x00000000000000000000000000000000000000AA",
    roundId: "round-1",
    requestId: "request-1",
    requester: "0x00000000000000000000000000000000000000BB",
  };

  assert.deepEqual(buildDispatchProofRequest(input), buildDispatchProofRequest(input));
  assert.equal(buildDispatchProofRequest(input).metadata.skillslot.chainId, 61999);
  assert.equal(buildDispatchProofRequest(input).metadata.skillslot.contract, input.contractAddress.toLowerCase());
  assert.equal("destination" in buildDispatchProofRequest(input), false);
});

test("dispatch proof authorizes once, proves idempotent A2A receipt, consumes once, and resumes", async () => {
  const calls = { authorize: 0, post: 0, consume: 0 };
  const canonical = { grant_status: "ACTIVE", dispatch_status: "NONE", dispatch_digest: "" };
  const proof = { transactions: {}, endpointChecks: [] };
  const dependencies = {
    readMatch: async () => ({ ...canonical }),
    authorizeDispatch: async (digest) => {
      calls.authorize += 1;
      canonical.dispatch_status = "AUTHORIZED";
      canonical.dispatch_digest = digest;
      return { transactionHash: "0xauthorize", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" };
    },
    canDispatch: async (digest) => canonical.grant_status === "ACTIVE" && canonical.dispatch_digest === digest,
    postA2A: async (_request, expectedStatus) => {
      calls.post += 1;
      if (expectedStatus === 403) return { status: 403, body: { error: "Canonical dispatch authorization is not active" } };
      return { status: 200, body: { task: { id: "skillslot-fixed", status: { state: "TASK_STATE_SUBMITTED" } } } };
    },
    consumeGrant: async () => {
      calls.consume += 1;
      canonical.grant_status = "CONSUMED";
      return { transactionHash: "0xconsume", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" };
    },
    readAccounting: async () => ({
      invariant_holds: true,
      total_received_wei: "2",
      total_locked_wei: "0",
      total_credited_wei: "2",
      total_withdrawn_wei: "0",
      node_config: { secret: true },
    }),
    persist: () => {},
  };
  const context = {
    contractAddress: "0x00000000000000000000000000000000000000AA",
    roundId: "round-1",
    requestId: "request-1",
    requester: "0x00000000000000000000000000000000000000BB",
  };

  const first = await executeDispatchProof(proof, context, dependencies);
  assert.equal(first.status, "FINALIZED_A2A_DISPATCH_PROOF");
  assert.deepEqual(calls, { authorize: 1, post: 3, consume: 1 });
  assert.equal(first.endpointChecks[0].taskId, first.endpointChecks[1].taskId);
  assert.equal(first.endpointChecks[2].httpStatus, 403);

  await executeDispatchProof(first, context, dependencies);
  assert.deepEqual(calls, { authorize: 1, post: 3, consume: 1 });
});

test("dispatch proof evidence projection excludes task text and raw network material", () => {
  const projected = projectDispatchProofEvidence({
    chainId: 61999,
    contractAddress: "0x111",
    sourceCommit: "abc",
    contractSha256: "def",
    roundId: "round-1",
    requestId: "request-1",
    messageId: "message-1",
    taskDigest: "a".repeat(64),
    taskText: "private task body",
    transactions: {
      authorizeDispatch: { transactionHash: "0xaaa", status: "FINALIZED", execution: "FINISHED_WITH_RETURN", trace: "secret" },
    },
    endpointChecks: [{ phase: "authorized-1", httpStatus: 200, taskId: "skillslot-a", rawBody: { secret: true } }],
    accounting: { invariant_holds: true, total_locked_wei: "0", node_config: { secret: true } },
    rawReceipt: { secret: true },
    status: "FINALIZED_A2A_DISPATCH_PROOF",
  });

  assert.equal(JSON.stringify(projected).includes("private task body"), false);
  assert.equal(JSON.stringify(projected).includes("secret"), false);
  assert.deepEqual(projected.transactions.authorizeDispatch, {
    transactionHash: "0xaaa",
    status: "FINALIZED",
    execution: "FINISHED_WITH_RETURN",
  });
  assert.deepEqual(projected.endpointChecks, [{ phase: "authorized-1", httpStatus: 200, taskId: "skillslot-a" }]);
  assert.deepEqual(projected.accounting, { invariant_holds: true, total_locked_wei: "0" });
});

test("dispatch-proof is exposed as a resumable deployment command", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = readFileSync(path.join(root, "scripts", "deploy_studionet.mjs"), "utf8");
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  assert.match(source, /command === "dispatch-proof"/);
  assert.equal(packageJson.scripts["dispatch:studionet"], "node scripts/deploy_studionet.mjs dispatch-proof");
});

test("executor permit proof binds the exact canonical task and authorization epoch", async () => {
  const calls = { authorizeDispatch: 0, authorizeExecutor: 0, sign: 0, post: 0, revoke: 0 };
  const canonical = {
    request_id: "request-1",
    grant_status: "ACTIVE",
    dispatch_status: "NONE",
    dispatch_digest: "",
    executor: "",
    executor_status: "NONE",
    executor_expires_at: "0",
    executor_epoch: "0",
  };
  const context = {
    contractAddress: "0x00000000000000000000000000000000000000AA",
    roundId: "round-1",
    requestId: "request-1",
    requester: "0x00000000000000000000000000000000000000BB",
    executor: "0x00000000000000000000000000000000000000CC",
  };
  const dependencies = {
    now: () => 1_800_000_000,
    readMatch: async () => ({ ...canonical }),
    authorizeDispatch: async (digest) => {
      calls.authorizeDispatch += 1;
      canonical.dispatch_status = "AUTHORIZED";
      canonical.dispatch_digest = digest;
      return { transactionHash: "0xdispatch", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" };
    },
    authorizeExecutor: async (executor, expiresAt) => {
      calls.authorizeExecutor += 1;
      canonical.executor = executor.toLowerCase();
      canonical.executor_status = "AUTHORIZED";
      canonical.executor_expires_at = String(expiresAt);
      canonical.executor_epoch = "1";
      return { transactionHash: "0xpermit", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" };
    },
    canExecute: async (_executor, digest, epoch, expiresAt) =>
      canonical.executor_status === "AUTHORIZED" &&
      canonical.dispatch_digest === digest &&
      canonical.executor_epoch === String(epoch) &&
      canonical.executor_expires_at === String(expiresAt),
    signPermit: async (message, wrongSigner = false) => {
      calls.sign += 1;
      assert.match(message, /SkillSlot Delegated Execution Permit/);
      return wrongSigner ? `0x${"22".repeat(65)}` : `0x${"11".repeat(65)}`;
    },
    postA2A: async (_request, authorization, expectedStatus) => {
      calls.post += 1;
      assert.equal(authorization.epoch, 1);
      if (expectedStatus === 401) return { status: 401, body: { error: "signature" } };
      if (expectedStatus === 403) return { status: 403, body: { error: "revoked" } };
      return { status: 200, body: { task: { id: "skillslot-executor-fixed", status: { state: "TASK_STATE_SUBMITTED" } } } };
    },
    revokeExecutor: async () => {
      calls.revoke += 1;
      canonical.executor_status = "REVOKED";
      return { transactionHash: "0xrevoke", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" };
    },
    readAccounting: async () => ({ invariant_holds: true, total_locked_wei: "2", total_credited_wei: "0" }),
    persist: () => {},
  };

  const proof = await executeExecutorPermitProof({}, context, dependencies);
  assert.equal(proof.status, "FINALIZED_EXECUTOR_PERMIT_PROOF");
  assert.equal(proof.epoch, 1);
  assert.equal(proof.endpointChecks[0].taskId, proof.endpointChecks[1].taskId);
  assert.deepEqual(calls, { authorizeDispatch: 1, authorizeExecutor: 1, sign: 2, post: 4, revoke: 1 });

  await executeExecutorPermitProof(proof, context, dependencies);
  assert.deepEqual(calls, { authorizeDispatch: 1, authorizeExecutor: 1, sign: 2, post: 4, revoke: 1 });
});

test("executor permit proof evidence excludes signatures and private task content", () => {
  const projected = projectExecutorPermitProofEvidence({
    network: "studionet",
    executor: "0x111",
    epoch: 2,
    expiresAt: 1_800_003_600,
    signature: `0x${"11".repeat(65)}`,
    taskText: "private",
    endpointChecks: [{ phase: "authorized-1", httpStatus: 200, taskId: "task-1", rawBody: { secret: true } }],
    transactions: { authorizeExecutor: { transactionHash: "0xaaa", status: "FINALIZED", trace: "secret" } },
    accounting: { before: { invariant_holds: true }, after: { invariant_holds: true }, invariantUnchanged: true },
    status: "FINALIZED_EXECUTOR_PERMIT_PROOF",
  });
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes("signature"), false);
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("secret"), false);
});

test("executor-proof is exposed as a resumable deployment command", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = readFileSync(path.join(root, "scripts", "deploy_studionet.mjs"), "utf8");
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  assert.match(source, /command === "executor-proof"/);
  assert.equal(packageJson.scripts["executor:studionet"], "node scripts/deploy_studionet.mjs executor-proof");
});
