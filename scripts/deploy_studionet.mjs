import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const CONTRACT_PATH = path.join(ROOT_DIR, "contracts", "skill_slot_clearing.py");
const EVIDENCE_DIR = path.join(ROOT_DIR, "docs", "evidence", "studionet");
const EVIDENCE_PATH = path.join(EVIDENCE_DIR, "deployment.json");
const ARCHIVE_DIR = path.join(EVIDENCE_DIR, "archive");
const EXPLORER_URL = "https://explorer-studio.genlayer.com";
const DEFAULT_RPC_URL = studionet.rpcUrls.default.http[0];
const ONE_GEN = 10n ** 18n;
const TERMINAL_FAILURES = new Set(["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);
const PRIMARY_KEYS = ["STUDIONET_PRIVATE_KEY", "GENLAYER_PRIVATE_KEY", "PRIVATE_KEY"];
const REQUESTER_KEYS = ["STUDIONET_INTEGRATOR_PRIVATE_KEY", "STUDIONET_REQUESTER_PRIVATE_KEY"];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const parsed = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

export function loadEnvironment(projectRoot = ROOT_DIR, processEnvironment = process.env) {
  const parent = parseEnvFile(path.resolve(projectRoot, "..", ".env"));
  const project = parseEnvFile(path.join(projectRoot, ".env"));
  return { ...parent, ...project, ...processEnvironment };
}

export function deploymentIdentity({ sourceCommit, contractSha256, runner }) {
  return { network: "studionet", sourceCommit, contractSha256, runner };
}

export function shouldReuseDeployment(evidence, identity) {
  return (
    evidence?.deployment?.status === "FINALIZED" &&
    Boolean(evidence?.deployment?.contractAddress) &&
    evidence?.identity?.network === identity.network &&
    evidence?.identity?.contractSha256 === identity.contractSha256 &&
    evidence?.identity?.runner === identity.runner
  );
}

export function currentAttemptId(roundView) {
  const raw = roundView?.attempt_count ?? roundView?.attemptCount;
  if (raw === undefined || raw === null || raw === "") {
    throw new Error("Canonical round attempt count is unavailable");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Canonical round attempt count is invalid");
  return value;
}

export function sanitizeEvidence(value) {
  if (!value || typeof value !== "object") return {};
  const allowed = [
    "transactionHash",
    "status",
    "execution",
    "finalizedAt",
    "submittedAt",
    "contractAddress",
    "errorCode",
  ];
  return Object.fromEntries(allowed.filter((key) => key in value).map((key) => [key, value[key]]));
}

export function rpcRetryDelayMs(error, seen = new Set()) {
  if (!error || (typeof error !== "object" && typeof error !== "string")) return null;
  if (typeof error === "object") {
    if (seen.has(error)) return null;
    seen.add(error);
    const code = Number(error.code);
    const retrySeconds = Number(error.data?.retry_after_seconds);
    if (code === -32029) {
      return Number.isFinite(retrySeconds) && retrySeconds >= 0 ? (retrySeconds + 1) * 1000 : 65_000;
    }
    for (const nested of [error.cause, error.data, error.error, error.originalError]) {
      const delay = rpcRetryDelayMs(nested, seen);
      if (delay !== null) return delay;
    }
  }
  const message = String(typeof error === "object" ? error.message ?? "" : error).toLowerCase();
  return message.includes("rate limit") ? 65_000 : null;
}

async function withRpcBackoff(operation, retries = 4) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = rpcRetryDelayMs(error);
      if (delay === null || attempt >= retries) throw error;
      console.log(JSON.stringify({ action: "rpc-backoff", status: "RETRYING", retryAfterSeconds: Math.ceil(delay / 1000) }));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function formatGenBalance(value) {
  const wei = BigInt(value);
  const whole = wei / ONE_GEN;
  const remainder = wei % ONE_GEN;
  const amount = remainder === 0n ? whole.toString() : `${whole}.${remainder.toString().padStart(18, "0").replace(/0+$/, "")}`;
  return `${amount} GEN`;
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT_DIR, encoding: "utf8" }).trim();
}

function currentIdentity() {
  const firstLine = readFileSync(CONTRACT_PATH, "utf8").split(/\r?\n/, 1)[0];
  const runner = firstLine.match(/py-genlayer:[^" ]+/)?.[0];
  if (!runner) throw new Error("Contract runner identity is missing");
  return deploymentIdentity({
    sourceCommit: git(["rev-parse", "HEAD"]),
    contractSha256: sha256File(CONTRACT_PATH),
    runner,
  });
}

function readEvidence() {
  if (!existsSync(EVIDENCE_PATH)) return {};
  return JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
}

function writeEvidence(value) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(jsonSafe(value), null, 2)}\n`, "utf8");
}

function mergeEvidence(patch) {
  writeEvidence({
    ...readEvidence(),
    network: "studionet",
    chainId: studionet.id,
    explorer: EXPLORER_URL,
    updatedAt: new Date().toISOString(),
    ...patch,
  });
}

function archiveSuperseded(evidence, reason) {
  if (!evidence?.deployment) return;
  if (!reason?.trim()) throw new Error("STUDIONET_SUPERSEDE_REASON is required to archive a deployed revision");
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archived = {
    identity: evidence.identity,
    deployment: evidence.deployment,
    demo: evidence.demo ?? null,
    archivedAt: new Date().toISOString(),
    reason: reason.trim(),
  };
  writeFileSync(path.join(ARCHIVE_DIR, `${timestamp}.json`), `${JSON.stringify(jsonSafe(archived), null, 2)}\n`, "utf8");
}

function requirePrivateKey(env, names) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value.startsWith("0x") ? value : `0x${value}`;
  }
  throw new Error(`Missing private key variable from allowed set: ${names.join(", ")}`);
}

function rpcUrl(env) {
  return env.STUDIONET_RPC_URL?.trim() || env.GENLAYER_RPC_URL?.trim() || DEFAULT_RPC_URL;
}

function signingClient(env, names) {
  const account = createAccount(requirePrivateKey(env, names));
  const client = createClient({ chain: studionet, endpoint: rpcUrl(env), account });
  return { account, client };
}

function publicClient(env) {
  return createClient({ chain: studionet, endpoint: rpcUrl(env) });
}

async function assertStudionet(client) {
  const raw = await withRpcBackoff(() => client.request({ method: "eth_chainId", params: [] }));
  const connected = Number(BigInt(raw));
  if (connected !== studionet.id) throw new Error(`Connected chain ${connected} is not Studionet ${studionet.id}`);
}

function executionName(receipt) {
  const direct = receipt?.txExecutionResultName ?? receipt?.executionResultName ?? receipt?.execution_result;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") return direct.result ?? direct.status ?? direct.name ?? "UNKNOWN";
  const leaders = receipt?.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaders) ? leaders[0] : leaders;
  const raw = leader?.execution_result;
  if (typeof raw === "string") return raw === "SUCCESS" ? "FINISHED_WITH_RETURN" : raw;
  if (raw && typeof raw === "object") return raw.result ?? raw.status ?? "UNKNOWN";
  return "UNKNOWN";
}

function contractAddressFromReceipt(receipt) {
  return (
    receipt?.txDataDecoded?.contractAddress ??
    receipt?.tx_data_decoded?.contract_address ??
    receipt?.data?.contractAddress ??
    receipt?.data?.contract_address ??
    receipt?.contract_address ??
    null
  );
}

async function waitForFinality(client, hash, retries = 240) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const status = await withRpcBackoff(() => client.request({ method: "gen_getTransactionStatus", params: [hash] }));
    if (status === "FINALIZED") return status;
    if (TERMINAL_FAILURES.has(status)) throw new Error(`Transaction ${hash} reached ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  throw new Error(`Transaction ${hash} did not finalize before timeout`);
}

async function waitForReceipt(client, hash, label) {
  const accepted = await withRpcBackoff(() =>
    client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 8000,
      retries: 120,
      fullTransaction: false,
    }),
  );
  const status = await waitForFinality(client, hash);
  const execution = executionName(accepted);
  if (status !== "FINALIZED") throw new Error(`${label} did not finalize`);
  if (!new Set(["FINISHED_WITH_RETURN", "SUCCESS"]).has(execution)) {
    throw new Error(`${label} finalized with ${execution}`);
  }
  return { receipt: accepted, record: sanitizeEvidence({ transactionHash: hash, status, execution, finalizedAt: new Date().toISOString() }) };
}

async function readView(client, address, functionName, args = []) {
  return jsonSafe(
    await withRpcBackoff(() =>
      client.readContract({
        address,
        functionName,
        args,
        jsonSafeReturn: true,
        stateStatus: "finalized",
      }),
    ),
  );
}

async function readBalance(client, address) {
  const raw = await withRpcBackoff(() => client.request({ method: "eth_getBalance", params: [address, "latest"] }));
  return BigInt(raw);
}

async function writeContractFinalized(client, address, functionName, args = [], value = 0n) {
  const hash = await client.writeContract({ address, functionName, args, value });
  console.log(JSON.stringify({ action: functionName, status: "SUBMITTED", transactionHash: hash }));
  const { record } = await waitForReceipt(client, hash, functionName);
  console.log(JSON.stringify({ action: functionName, status: record.status, execution: record.execution }));
  return record;
}

async function deploy(env) {
  const identity = currentIdentity();
  const existing = readEvidence();
  if (shouldReuseDeployment(existing, identity)) {
    console.log(JSON.stringify({ action: "deploy", status: "SKIPPED", contractAddress: existing.deployment.contractAddress }));
    return existing.deployment.contractAddress;
  }
  if (existing.deployment) {
    archiveSuperseded(existing, env.STUDIONET_SUPERSEDE_REASON);
  }
  const signer = signingClient(env, PRIMARY_KEYS);
  await assertStudionet(signer.client);
  const hash = await signer.client.deployContract({ code: new Uint8Array(readFileSync(CONTRACT_PATH)), args: [] });
  mergeEvidence({
    identity,
    actors: { creatorProvider: signer.account.address },
    deployment: sanitizeEvidence({ transactionHash: hash, status: "SUBMITTED", submittedAt: new Date().toISOString() }),
    status: "DEPLOY_SUBMITTED",
  });
  console.log(JSON.stringify({ action: "deploy", status: "SUBMITTED", transactionHash: hash }));
  const { receipt, record } = await waitForReceipt(signer.client, hash, "deploy");
  const address = contractAddressFromReceipt(receipt);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) throw new Error("Finalized deploy receipt did not expose a contract address");
  mergeEvidence({
    identity,
    actors: { creatorProvider: signer.account.address },
    deployment: { ...record, contractAddress: address },
    status: "DEPLOYED",
  });
  console.log(JSON.stringify({ action: "deploy", status: "FINALIZED", contractAddress: address }));
  return address;
}

function requireDeployment(evidence) {
  const address = evidence?.deployment?.contractAddress;
  if (evidence?.deployment?.status !== "FINALIZED" || !address) {
    throw new Error("No finalized Studionet deployment is recorded");
  }
  return address;
}

function ensureDemo(evidence, primary, requester) {
  return evidence.demo ?? {
    contractAddress: evidence.deployment.contractAddress,
    roundId: `slot-${Date.now().toString(36)}`,
    actors: { creatorProvider: primary.account.address, requester: requester.account.address },
    transactions: {},
    status: "STARTED",
  };
}

async function runStep(env, step) {
  const evidence = readEvidence();
  const address = requireDeployment(evidence);
  const primary = signingClient(env, PRIMARY_KEYS);
  const requester = signingClient(env, REQUESTER_KEYS);
  if (primary.account.address.toLowerCase() === requester.account.address.toLowerCase()) {
    throw new Error("Creator/provider and requester wallets must differ");
  }
  await assertStudionet(primary.client);
  await assertStudionet(requester.client);
  const demo = ensureDemo(evidence, primary, requester);
  if (demo.contractAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Recorded demo belongs to a different contract revision");
  }
  const persist = () => mergeEvidence({ demo });
  persist();

  if (step === "open-round") {
    const current = await readView(primary.client, address, "get_round", [demo.roundId]);
    if (!current?.round_id) {
      demo.transactions.openRound = await writeContractFinalized(
        primary.client,
        address,
        "open_round",
        [demo.roundId, "Studionet agent access window", ONE_GEN, ONE_GEN],
      );
    }
  } else if (step === "submit-demo-positions") {
    const offer = await readView(primary.client, address, "get_offer", [demo.roundId, "offer-flight"]);
    if (!offer?.offer_id) {
      demo.transactions.submitOffer = await writeContractFinalized(
        primary.client,
        address,
        "submit_offer",
        [demo.roundId, "offer-flight", "Flight scheduling agent", "Books air tickets and writes confirmed itineraries to a calendar.", "FLIGHT.BOOK,CALENDAR.WRITE"],
        ONE_GEN,
      );
    }
    const request = await readView(primary.client, address, "get_request", [demo.roundId, "request-flight"]);
    if (!request?.request_id) {
      demo.transactions.submitRequest = await writeContractFinalized(
        requester.client,
        address,
        "submit_request",
        [demo.roundId, "request-flight", "Flight reservation need", "Reserve an air ticket and add it to the calendar without hotel booking.", "FLIGHT.BOOK,CALENDAR.WRITE", "HOTEL.BOOK"],
        ONE_GEN,
      );
    }
  } else if (step === "lock") {
    const round = await readView(primary.client, address, "get_round", [demo.roundId]);
    if (round?.phase === "OPEN") demo.transactions.lock = await writeContractFinalized(primary.client, address, "lock_round", [demo.roundId]);
  } else if (step === "clear") {
    const round = await readView(primary.client, address, "get_round", [demo.roundId]);
    currentAttemptId(round);
    if (round?.phase === "LOCKED" || round?.phase === "RETRYABLE") {
      demo.transactions.clear = await writeContractFinalized(primary.client, address, "clear_round", [demo.roundId]);
      const after = await readView(primary.client, address, "get_round", [demo.roundId]);
      if (after?.phase === "RETRYABLE") {
        demo.status = "RETRYABLE_REQUIRES_DIAGNOSIS";
        demo.retryAttempt = currentAttemptId(after);
        persist();
        return demo;
      }
    }
  } else if (step === "consume") {
    const match = await readView(primary.client, address, "get_match", [demo.roundId, "request-flight"]);
    if (match?.grant_status === "ACTIVE") {
      demo.transactions.consume = await writeContractFinalized(requester.client, address, "consume_grant", [demo.roundId, "request-flight"]);
    }
  } else if (step === "withdraw") {
    const primaryCredit = BigInt(await readView(primary.client, address, "get_credit", [primary.account.address]));
    if (primaryCredit > 0n) {
      demo.transactions.withdrawPrimary = await writeContractFinalized(primary.client, address, "withdraw_credit", [primaryCredit]);
    }
    const requesterCredit = BigInt(await readView(primary.client, address, "get_credit", [requester.account.address]));
    if (requesterCredit > 0n) {
      demo.transactions.withdrawRequester = await writeContractFinalized(requester.client, address, "withdraw_credit", [requesterCredit]);
    }
  } else {
    throw new Error(`Unknown lifecycle step: ${step}`);
  }
  demo.finalReads = {
    round: await readView(primary.client, address, "get_round", [demo.roundId]),
    offer: await readView(primary.client, address, "get_offer", [demo.roundId, "offer-flight"]),
    request: await readView(primary.client, address, "get_request", [demo.roundId, "request-flight"]),
    match: await readView(primary.client, address, "get_match", [demo.roundId, "request-flight"]),
    primaryCreditWei: await readView(primary.client, address, "get_credit", [primary.account.address]),
    requesterCreditWei: await readView(primary.client, address, "get_credit", [requester.account.address]),
    accounting: await readView(primary.client, address, "get_accounting", []),
  };
  persist();
  return demo;
}

async function demo(env) {
  await deploy(env);
  for (const step of ["open-round", "submit-demo-positions", "lock", "clear"]) {
    const state = await runStep(env, step);
    if (state.status === "RETRYABLE_REQUIRES_DIAGNOSIS") {
      console.log(JSON.stringify({ action: "demo", status: state.status, retryAttempt: state.retryAttempt }));
      return;
    }
  }
  await runStep(env, "consume");
  const state = await runStep(env, "withdraw");
  const accounting = state.finalReads.accounting;
  state.status =
    state.finalReads.round?.phase === "CLEARED" &&
    state.finalReads.match?.grant_status === "CONSUMED" &&
    accounting?.total_locked_wei === "0" &&
    state.finalReads.primaryCreditWei === "0" &&
    state.finalReads.requesterCreditWei === "0"
      ? "FINALIZED_LIFECYCLE"
      : "FINALIZED_INCOMPLETE";
  mergeEvidence({ demo: state });
  console.log(JSON.stringify({ action: "demo", status: state.status, finalReads: state.finalReads }, null, 2));
}

async function balanceProof(env) {
  const evidence = readEvidence();
  const address = requireDeployment(evidence);
  const primary = signingClient(env, PRIMARY_KEYS);
  await assertStudionet(primary.client);
  const proof = evidence.balanceProof ?? {
    roundId: `${evidence.demo?.roundId ?? "skillslot"}-refund`,
    actor: primary.account.address,
    transactions: {},
    status: "STARTED",
  };
  const persist = () => mergeEvidence({ balanceProof: proof });
  persist();

  let round = await readView(primary.client, address, "get_round", [proof.roundId]);
  if (!round?.round_id) {
    proof.beforeDeposit = formatGenBalance(await readBalance(primary.client, primary.account.address));
    proof.transactions.openRound = await writeContractFinalized(
      primary.client,
      address,
      "open_round",
      [proof.roundId, "Balance recovery proof", ONE_GEN, ONE_GEN],
    );
    persist();
    round = await readView(primary.client, address, "get_round", [proof.roundId]);
  }

  const offer = await readView(primary.client, address, "get_offer", [proof.roundId, "offer-refund"]);
  if (!offer?.offer_id && round?.phase === "OPEN") {
    proof.transactions.submitOffer = await writeContractFinalized(
      primary.client,
      address,
      "submit_offer",
      [proof.roundId, "offer-refund", "Refund proof agent", "Provides one bounded diagnostic access slot.", "DIAGNOSTIC.ACCESS"],
      ONE_GEN,
    );
    persist();
  }
  if (!proof.afterDeposit) {
    proof.afterDeposit = formatGenBalance(await readBalance(primary.client, primary.account.address));
    persist();
  }

  round = await readView(primary.client, address, "get_round", [proof.roundId]);
  if (round?.phase === "OPEN") {
    proof.transactions.cancelRound = await writeContractFinalized(primary.client, address, "cancel_round", [proof.roundId]);
    persist();
  }
  const credit = BigInt(await readView(primary.client, address, "get_credit", [primary.account.address]));
  if (credit > 0n) {
    proof.beforeWithdraw = formatGenBalance(await readBalance(primary.client, primary.account.address));
    proof.transactions.withdrawCredit = await writeContractFinalized(primary.client, address, "withdraw_credit", [credit]);
    proof.afterWithdraw = formatGenBalance(await readBalance(primary.client, primary.account.address));
    persist();
  }
  proof.finalRound = await readView(primary.client, address, "get_round", [proof.roundId]);
  proof.finalAccounting = await readView(primary.client, address, "get_accounting", []);
  proof.status =
    proof.finalRound?.phase === "CANCELLED" &&
    proof.finalAccounting?.total_locked_wei === "0" &&
    proof.finalAccounting?.total_credited_wei === "0"
      ? "FINALIZED_BALANCE_PROOF"
      : "FINALIZED_INCOMPLETE";
  persist();
  console.log(JSON.stringify({ action: "balance-proof", status: proof.status, beforeDeposit: proof.beforeDeposit, afterDeposit: proof.afterDeposit, beforeWithdraw: proof.beforeWithdraw, afterWithdraw: proof.afterWithdraw }, null, 2));
}

async function inspect(env) {
  const evidence = readEvidence();
  const report = {
    network: "studionet",
    chainId: studionet.id,
    identity: evidence.identity ?? currentIdentity(),
    deployment: evidence.deployment ?? { status: "PENDING_REAL_EVIDENCE" },
    demoStatus: evidence.demo?.status ?? "PENDING_REAL_EVIDENCE",
    reads: {},
  };
  if (evidence.deployment?.contractAddress) {
    const client = publicClient(env);
    await assertStudionet(client);
    if (evidence.demo?.roundId) {
      report.reads.round = await readView(client, evidence.deployment.contractAddress, "get_round", [evidence.demo.roundId]);
      report.reads.accounting = await readView(client, evidence.deployment.contractAddress, "get_accounting", []);
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const env = loadEnvironment();
  const command = process.argv[2] ?? "inspect";
  if (command === "inspect") await inspect(env);
  else if (command === "deploy") await deploy(env);
  else if (command === "demo") await demo(env);
  else if (command === "balance-proof") await balanceProof(env);
  else if (["open-round", "submit-demo-positions", "lock", "clear", "consume", "withdraw"].includes(command)) {
    await runStep(env, command);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  await main();
}
