import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { loadEnvironment } from "../../scripts/deploy_studionet.mjs";
import { executionOutcome, measuredProfileEntry, mergeProfileEntries, safeFeeSettlement } from "./fee-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = path.join(root, "docs/evidence/studio-dev");
const evidencePath = path.join(evidenceDir, "ms-005-booking-policy.json");
const profilePath = path.join(root, "frontend/fee-profile.json");
const sourcePath = path.join(root, "contracts/skill_slot_clearing.py");
const one = 10n ** 18n;
const feeCap = one / 5n; // 0.2 GEN maximum deposit, not an assertion of consumed cost.
const sha = value => createHash("sha256").update(value).digest("hex");
const json = value => JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

async function main() {
  const command = process.argv[2] ?? "inspect";
  const source = readFileSync(sourcePath);
  const digest = sha(source);
  const client = createClient({ chain: { ...studioDevnet } });
  let proof = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : null;
  if (command === "inspect") {
    console.log(json({ network: "studio-dev", chainId: await client.request({ method: "eth_chainId", params: [] }), contractSha256: digest, contractAddress: proof?.contractAddress ?? null, status: proof?.status ?? "NOT_DEPLOYED" }));
    return;
  }
  assert(["deploy", "proof", "seed"].includes(command), "Use inspect, deploy, proof or seed");
  assert(sha(execFileSync("git", ["show", "HEAD:contracts/skill_slot_clearing.py"], { cwd: root })) === digest, "Commit the verified contract source before deployment");
  const env = loadEnvironment(root);
  const key = names => {
    const value = names.map(name => env[name]?.trim()).find(Boolean);
    assert(value, "Authorized ignored environment is missing an actor key");
    return value.startsWith("0x") ? value : `0x${value}`;
  };
  const primary = createAccount(key(["STUDIO_DEV_PRIVATE_KEY", "STUDIONET_PRIVATE_KEY", "GENLAYER_PRIVATE_KEY", "PRIVATE_KEY"]));
  const requester = createAccount(key(["STUDIO_DEV_REQUESTER_PRIVATE_KEY", "STUDIONET_INTEGRATOR_PRIVATE_KEY", "STUDIONET_REQUESTER_PRIVATE_KEY"]));
  assert(primary.address.toLowerCase() !== requester.address.toLowerCase(), "Provider and requester must be distinct authorized EOAs");
  const actors = { provider: primary.address, requester: requester.address };
  proof ??= { milestone: "MS-005", network: "studio-dev", chainId: 61997, sourceCommit: git(["rev-parse", "HEAD"]), contractSha256: digest, runner: source.toString().match(/py-genlayer:[a-z0-9]+/)?.[0], actors, status: "DEPLOYING", transactions: {}, canonical: {} };
  assert(proof.contractSha256 === digest && proof.chainId === 61997 && json(proof.actors) === json(actors), "Evidence identity mismatch; do not overwrite or replay");
  let profile = JSON.parse(readFileSync(profilePath, "utf8"));
  assert(!profile.contractSha256 || profile.contractSha256 === digest, "Fee profile source mismatch");
  const save = () => { mkdirSync(evidenceDir, { recursive: true }); writeFileSync(evidencePath, `${json(proof)}\n`); };
  const read = (functionName, args = []) => client.readContract({ address: proof.contractAddress, functionName, args, stateStatus: "finalized", jsonSafeReturn: true });
  const signedClient = account => createClient({ chain: { ...studioDevnet }, account });

  async function finalize(id, method) {
    const entry = proof.transactions[id];
    assert(entry?.hash, `Ambiguous submission ${id}: inspect sender nonce before any retry`);
    if (entry.status === "FINALIZED" && entry.execution === "SUCCESS" && entry.fees) return;
    let previous = "";
    for (let poll = 0; poll < 180; poll++) {
      const status = String(await client.request({ method: "gen_getTransactionStatus", params: [entry.hash] }));
      if (status !== previous) { console.log(json({ step: id, hash: entry.hash, status })); previous = status; }
      if (status === "FINALIZED") {
        const tx = await client.getTransaction({ hash: entry.hash });
        const outcome = executionOutcome(tx);
        entry.status = outcome.status;
        entry.execution = outcome.execution;
        entry.verifiedAt = new Date().toISOString();
        save();
        assert(["SUCCESS", "FINISHED_WITH_RETURN"].includes(entry.execution), `Step ${id} finalized with ${entry.execution}; no automatic replay`);
        entry.execution = "SUCCESS";
        entry.fees = safeFeeSettlement(tx.fees);
        const observation = measuredProfileEntry(tx.fees);
        profile = { ...profile, measuredAt: entry.verifiedAt, contractSha256: digest, headroom: "1.25", source: "Finalized successful Studio Dev receipts; per-component maxima; no raw receipts" };
        if (method === "__init__") {
          const address = tx.data?.contract_address ?? tx.data?.contractAddress ?? tx.contract_address ?? tx.txDataDecoded?.contractAddress;
          assert(/^0x[0-9a-fA-F]{40}$/.test(address ?? ""), "Missing deployed address");
          proof.contractAddress = address;
          profile.deploy = mergeProfileEntries(profile.deploy, observation);
        } else profile.methods[method] = mergeProfileEntries(profile.methods[method], observation);
        profile.contractAddress = proof.contractAddress;
        writeFileSync(profilePath, `${json(profile)}\n`);
        save();
        return;
      }
      assert(!["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status), `Step ${id} reached ${status}; inspect before retry`);
      await sleep(4000);
    }
    throw new Error(`Step ${id} still pending; resume without resubmission`);
  }

  async function step(id, account, method, args = [], value = 0n) {
    if (proof.transactions[id]) { await finalize(id, method); return; }
    assert(value === 0n || value === one, "Demo application value must be exactly 0 or 1 GEN");
    const signer = signedClient(account);
    const estimate = method === "__init__"
      ? await signer.estimateTransactionFees({ leaderTimeunitsAllocation: 100n, validatorTimeunitsAllocation: 200n, totalMessageFees: 0n, rotations: [1n], appealRounds: 0n })
      : await signer.estimateTransactionFeesForWrite({ address: proof.contractAddress, functionName: method, args, value, appealRounds: 0n, rotations: [1n] });
    assert(estimate.feeValue <= feeCap, `Fee quote for ${id} exceeds 0.2 GEN cap; no transaction sent`);
    const balance = await signer.getBalance({ address: account.address });
    assert(balance >= value + estimate.feeValue + one / 100n, `Insufficient bounded balance for ${id}`);
    proof.transactions[id] = { method, sender: account.address, intentAt: new Date().toISOString(), argsSha256: sha(json(args)), applicationValueWei: value.toString(), quotedFeeBudgetWei: estimate.feeValue.toString(), status: "SUBMISSION_INTENT" };
    save(); // Never silently replay an ambiguous submission.
    const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue, ...(estimate.messageAllocations ? { messageAllocations: estimate.messageAllocations } : {}) };
    const hash = method === "__init__"
      ? await signer.deployContract({ code: new Uint8Array(source), args: [], fees })
      : await signer.writeContract({ address: proof.contractAddress, functionName: method, args, value, fees });
    Object.assign(proof.transactions[id], { hash, status: "SUBMITTED", submittedAt: new Date().toISOString() });
    save();
    await finalize(id, method);
  }

  if (command === "deploy") {
    await step("deployment", primary, "__init__");
    assert(Array.isArray(await read("get_round_ids")), "Canonical view smoke failed");
    proof.status = "DEPLOYED"; save();
    console.log(json({ status: proof.status, contractAddress: proof.contractAddress, hash: proof.transactions.deployment.hash }));
    return;
  }
  assert(proof.contractAddress && proof.transactions.deployment?.execution === "SUCCESS", "Deploy and verify first");
  if (command === "proof" && proof.status === "FINALIZED_POLICY_PROOF") {
    console.log(json({ status: proof.status, contractAddress: proof.contractAddress, action: "Already complete; use verify-ms005-proof.mjs for read-only re-verification" }));
    return;
  }
  if (command === "seed") {
    for (let index = 1; index <= 6; index++) await step(`seed-${index}`, primary, "open_round", [`ms005-explore-${index}`, `Explore reputation-bound agent access ${index}`, one, one, 604800n, 1209600n]);
    proof.seededRoundIds = (await read("get_round_ids")).filter(id => id.startsWith("ms005-explore-")); save(); return;
  }
  async function market(tag, minimumCount, average) {
    const round = `ms005-${tag}`;
    await step(`${tag}-open`, primary, "open_round", [round, `MS-005 ${tag} reputation policy proof`, one, one, 86400n, 172800n]);
    const metadataPath = path.join(root, "frontend/public/agents/studionet-flight-agent.json");
    const body = readFileSync(metadataPath, "utf8");
    const metadata = JSON.parse(body);
    assert(metadata.provider.toLowerCase() === primary.address.toLowerCase(), "Static metadata provider does not match the authorized actor");
    const hash = sha(body);
    await step(`${tag}-offer`, primary, "submit_offer", [round, "offer-flight", "Authenticated flight and calendar agent", "Books flights and writes the confirmed itinerary to the requester calendar.", metadata.capability_ids_csv, metadata.agent_id, "https://skillslot-clearing.vercel.app/agents/studionet-flight-agent.json", hash, metadata.issuer, `${metadata.issuer}:v1:${hash}`, BigInt(metadata.expires_at)], one);
    await step(`${tag}-request`, requester, "submit_request", [round, "request-flight", "Flight and calendar booking", "Book flight GL-203 departing at 09:30 and add the confirmed itinerary to my calendar.", "CALENDAR.WRITE,FLIGHT.BOOK", "HOTEL.BOOK", BigInt(minimumCount), BigInt(average)], one);
    await step(`${tag}-lock`, primary, "lock_round", [round]);
    await step(`${tag}-clear`, primary, "clear_round", [round]);
    const r = await read("get_round", [round]);
    assert(r.phase === "CLEARED", `${tag} semantic clearing is not conclusive; do not replay`);
    const eligibility = await read("get_booking_eligibility", [round, "offer-flight", "request-flight"]);
    const match = await read("get_match", [round, "request-flight"]);
    proof.canonical[tag] = { round: r, request: await read("get_request", [round, "request-flight"]), offer: await read("get_offer", [round, "offer-flight"]), eligibility, match, accounting: await read("get_accounting") };
    save();
    assert(proof.canonical[tag].accounting.invariant_holds === true, "Accounting invariant failed");
    return { round, eligibility, match };
  }
  const excluded = await market("excluded", 1, 4000);
  assert(excluded.eligibility.reason === "INSUFFICIENT_REVIEWS" && !excluded.match.request_id, "Unreviewed provider was not excluded");
  const baseline = await market("unrestricted", 0, 0);
  assert(baseline.match.request_id === "request-flight", "Unrestricted compatible request did not match");
  async function deliver(tag, round) {
    await step(`${tag}-deliver`, primary, "submit_delivery", [round, "request-flight", "Confirmed delivery: flight GL-203 departs at 09:30; the confirmed itinerary was added to the requester calendar."]);
    await step(`${tag}-accept`, requester, "accept_delivery", [round, "request-flight"]);
  }
  await deliver("unrestricted", baseline.round);
  await step("review-submit", requester, "submit_reputation", [baseline.round, "request-flight", 4, "The confirmed GL-203 09:30 itinerary and calendar entry satisfied the bounded booking request; score 4/5."]);
  await step("review-challenge", primary, "challenge_reputation", [baseline.round, "request-flight", "The provider confirms the GL-203 09:30 itinerary and calendar entry; the bounded evidence supports the requester score 4/5."]);
  await step("review-resolve", primary, "resolve_reputation", [baseline.round, "request-flight"]);
  proof.canonical.reputation = await read("get_provider_reputation", [primary.address]); save();
  assert(proof.canonical.reputation.review_count === "1" && proof.canonical.reputation.average_milli === "4000", "Reputation not finalized at the required boundary; inspect without replay");
  const eligible = await market("eligible", 1, 4000);
  assert(eligible.eligibility.eligible === true && eligible.match.request_id === "request-flight", "Qualified provider did not receive the grant");
  await deliver("eligible", eligible.round);
  const frozen = await read("get_booking_eligibility", [excluded.round, "offer-flight", "request-flight"]);
  assert(frozen.reason === "INSUFFICIENT_REVIEWS", "Earlier snapshot changed after a later review");
  proof.canonical.frozenExcludedAfterReview = frozen;
  for (const [role, account] of [["provider", primary], ["requester", requester]]) {
    proof.withdrawals ??= {};
    if (!proof.withdrawals[role]) { proof.withdrawals[role] = { creditBeforeWei: await read("get_credit", [account.address]), balanceBeforeWei: (await client.getBalance({ address: account.address })).toString(), amountWei: one.toString() }; save(); }
    await step(`withdraw-${role}`, account, "withdraw_credit", [one]);
    const w = proof.withdrawals[role];
    w.creditAfterWei = await read("get_credit", [account.address]);
    for (let attempt = 0; attempt < 30; attempt++) { w.balanceAfterWei = (await client.getBalance({ address: account.address })).toString(); if (BigInt(w.balanceAfterWei) > BigInt(w.balanceBeforeWei)) break; await sleep(2000); }
    assert(BigInt(w.creditBeforeWei) - BigInt(w.creditAfterWei) === one && BigInt(w.balanceAfterWei) > BigInt(w.balanceBeforeWei), "Native withdrawal balance proof failed");
    w.nativeNetDeltaWei = (BigInt(w.balanceAfterWei) - BigInt(w.balanceBeforeWei)).toString(); save();
  }
  proof.canonical.accounting = await read("get_accounting");
  assert(proof.canonical.accounting.invariant_holds === true, "Final accounting invariant failed");
  proof.status = "FINALIZED_POLICY_PROOF"; proof.verifiedAt = new Date().toISOString(); save();
  console.log(json({ status: proof.status, contractAddress: proof.contractAddress, transactions: Object.keys(proof.transactions).length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(JSON.stringify({ error: error instanceof Error ? error.message.split("\n")[0].slice(0, 250) : "Operation failed; inspect evidence before retry" })); process.exitCode = 1; }
}
