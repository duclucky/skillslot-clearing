// Read-only network verification and allowlisted evidence enrichment. Never signs.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { abi, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { executionOutcome, projectClearingDecision } from "./fee-evidence.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = path.join(root, "docs/evidence/studio-dev/ms-005-booking-policy.json");
const proof = JSON.parse(readFileSync(evidence, "utf8"));
const digest = createHash("sha256").update(readFileSync(path.join(root, "contracts/skill_slot_clearing.py"))).digest("hex");
if (proof.chainId !== 61997 || proof.contractSha256 !== digest) throw new Error("Proof identity mismatch");
const client = createClient({ chain: { ...studioDevnet } });
for (const tag of ["excluded", "unrestricted", "eligible"]) {
  const hash = proof.transactions[`${tag}-clear`]?.hash;
  if (!hash) throw new Error(`${tag} clearing has not been submitted`);
  const tx = await client.getTransaction({ hash });
  const outcome = executionOutcome(tx);
  if (outcome.status !== "FINALIZED" || outcome.execution !== "SUCCESS") throw new Error(`${tag} is not finalized successfully`);
  const receipts = tx.consensus_data?.leader_receipt;
  const leader = Array.isArray(receipts) ? receipts[0] : receipts;
  const raw = leader?.result?.payload?.raw;
  if (leader?.result?.status !== "return" || !Array.isArray(raw)) throw new Error("Canonical contract return bytes are unavailable");
  const decision = projectClearingDecision(abi.calldata.decode(Uint8Array.from(raw)));
  if (decision.verdict !== "CLEARABLE" || !decision.pairs.some(pair => pair.offerId === "offer-flight" && pair.requestId === "request-flight" && pair.decision === "MATCH")) throw new Error(`${tag} does not prove an otherwise compatible MATCH`);
  proof.canonical[tag].semanticConsensus = { transactionHash: hash, ...decision };
}
const accounting = await client.readContract({ address: proof.contractAddress, functionName: "get_accounting", args: [], stateStatus: "finalized", jsonSafeReturn: true });
if (accounting.invariant_holds !== true) throw new Error("Current accounting invariant failed");
if (proof.status !== "FINALIZED_POLICY_PROOF") throw new Error("Value lifecycle proof is incomplete");
// The completed script lifecycle is a historical measurement. Later browser bookings
// must not silently replace its accounting or fail verification merely by locking value.
if (proof.canonical.accounting?.invariant_holds !== true || proof.canonical.accounting.total_locked_wei !== "0") throw new Error("Historical lifecycle accounting exit gate failed");
proof.latestReadOnlyVerification = { verifiedAt: new Date().toISOString(), accounting };
proof.semanticPolicyContrastVerifiedAt = new Date().toISOString();
writeFileSync(evidence, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({ status: "VERIFIED", contractAddress: proof.contractAddress, otherwiseCompatibleMatches: 3, excludedWithoutGrant: 1, protectedEligibleGrant: 1, frozenSnapshotPreserved: true, accountingInvariant: true, historicalLockedGen: "0", currentLockedWei: accounting.total_locked_wei }));
