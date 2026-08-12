import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  currentAttemptId,
  deploymentIdentity,
  formatGenBalance,
  loadEnvironment,
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
