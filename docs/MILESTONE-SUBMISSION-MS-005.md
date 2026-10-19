# MS-005 Portal packet

Category: **Milestones**. Status: **SUBMISSION_READY / NOT_SUBMITTED**. Final Submit needs explicit action-time authorization.

## Title

MS-005: Reputation-Bound Booking Policies

## Changes & Improvements

MS-005 turns accepted finalized reputation into enforceable booking policy. Requesters attach minimum review count and average to a paid request. At round lock, the contract freezes each provider's canonical count and score total; deterministic allocation rejects below-policy offers even when GenLayer validators return semantic MATCH. Defaults stay unrestricted; ineligible requests receive refund credit instead of grants or delivery escrow. Studio Dev proofs contrast excluded, unrestricted and exact-threshold eligible MATCH results and preserve snapshots after later reviews. Chrome/OKX proves a signed 1 GEN policy booking, reload and web cancellation. A separately authorized 1 GEN script withdrawal proves an exact native contract debit and recipient increase. All 326 checks and the production build pass. Controlled QA only, not external adoption, imported reputation or verified real-world service performance.

## Evidence & Supporting Information

Add each URL separately. All addresses and transactions below belong to **Studio Dev, chain 61997**.

1. Exact accepted MS-004 product baseline to MS-005 implementation and finalized evidence

   https://github.com/duclucky/skillslot-clearing/compare/be794338f9a00a00e72baab466d229cd03467e2b...8ff8f52e90297244054ba10341fcc96b165e3cd2

2. Phase dossier, scope, safety matrix and verification

   https://github.com/duclucky/skillslot-clearing/blob/main/docs/milestones/MS-005/README.md

3. Canonical policy contrast: three semantic MATCH results with different deterministic allocation outcomes

   https://github.com/duclucky/skillslot-clearing/blob/8ff8f52e90297244054ba10341fcc96b165e3cd2/docs/evidence/studio-dev/ms-005-booking-policy.json

4. Actual Chrome/OKX policy booking, canonical reload and web cancellation

   https://github.com/duclucky/skillslot-clearing/blob/8ff8f52e90297244054ba10341fcc96b165e3cd2/docs/evidence/studio-dev/ms-005-browser-lifecycle.json

5. Separately authorized exact 1 GEN native withdrawal, both balances bracketed

   https://github.com/duclucky/skillslot-clearing/blob/8ff8f52e90297244054ba10341fcc96b165e3cd2/docs/evidence/studio-dev/ms-005-native-withdrawal.json

6. Contract

   https://explorer-studio-dev.genlayer.com/address/0x3835fDE18eF5FF14c5Bdc87fE7a24043A231746d

7. Deployment transaction

   https://explorer-studio-dev.genlayer.com/transactions/0xe3f8602128318f29700aa17199697ee02353114a8cd790d0bfd904bac314d9e6

8. Signed browser policy transaction

   https://explorer-studio-dev.genlayer.com/transactions/0x399f88be4e57b4b4a6302d269393db7b0ba9566190f7dfc81551e2dae8a72653

9. Live application

   https://skillslot-clearing.vercel.app/?ms=005-final

10. Successful CI for the deployed application code

    https://github.com/duclucky/skillslot-clearing/actions/runs/39214981065

11. Production and responsive QA

    https://github.com/duclucky/skillslot-clearing/blob/8ff8f52e90297244054ba10341fcc96b165e3cd2/docs/evidence/studio-dev/ms-005-production.json

12. Successful CI for the finalized implementation/evidence head

    https://github.com/duclucky/skillslot-clearing/actions/runs/39217570408

## Exact identities and boundaries

- Accepted product baseline: `be794338f9a00a00e72baab466d229cd03467e2b` (MS-004 accepted, owner-confirmed).
- MS-005 contract source: `11be3f21f09c8b7a51d2880779076043bdbef1da`;
  SHA-256 `b243a3625ec80241cb4ef4ef9a0453ba999f80fd38b4e4bfe019b760bffbfac2`.
- Production frontend/API source: `7c54c9c3fe776046a3a3a0472bdcb22388606ea0`.
- Finalized lifecycle evidence head: `8ff8f52e90297244054ba10341fcc96b165e3cd2`.
- Later packet/log commits do not introduce another product capability or change those identities.
- One SkillSlot contract, 21 writes and 13 views; separate minimal constructor probe is diagnostic only.
- Local 326 checks: 14 static/linter + 96 direct + 5 receipt parser + 26 deployment/fee + 185 frontend/API.
- Changes & Improvements: **922 characters**, within the Portal 1000-character limit.
- Three script policy rounds and one additional browser policy request, deduplicated by chain + contract + round + request, measured 2026-10-19. Seed inventory is not adoption.
- Current totals after supplemental withdrawal: 7 GEN received, 0 locked, 4 credited, 3 withdrawn; invariant true.
  Historical script totals 6 / 0 / 4 / 2 GEN remain preserved, not presented as current totals.
- Browser cancellation gives refund credit. The subsequent exact 1 GEN native withdrawal is script-signed,
  not a browser withdrawal claim. Earlier two withdrawals observed actor balances; the supplemental
  transfer additionally proves the exact native contract decrease.
- No previous Studionet balances or reputation migrated. Retained access:
  https://skillslot-ms004.vercel.app/?ms=004-legacy-public

## Reviewer path

1. Open the live app, choose Browse rounds and inspect `ms005-excluded`, `ms005-unrestricted` and
   `ms005-eligible` in History. There are also five developer-seeded open rounds at the latest read.
2. Compare the canonical records in evidence 3: all three consensus graphs contain MATCH; the first
   provider snapshot has zero counted reviews and receives no grant under policy 1/4000; the default
   policy admits; the later snapshot count 1 / total 4 satisfies the exact 4000 boundary.
3. Inspect evidence 4: the actual browser request persisted policy 1/4000 and exact 1 GEN through
   finalization and reload. Its creator subsequently cancelled it through the web, returning 1 GEN
   to credit. This closed QA round is evidence, not an invitation to submit into that cancelled round.
4. For a new write reproduction, connect a funded Studio Dev wallet. Create your own unique round
   to control normal lock/clear actions; joining someone else's round does not grant creator rights.
   Use the existing provider/request workflow with 1 GEN each. Optional minimum count/average controls
   appear under request policy. A provider with no finalized local reviews cannot satisfy a positive
   count policy; use 0/0 for unrestricted admission. Reputation is contract-local, sampled at lock.
5. Check exact 1 GEN native contract debit and recipient increase in evidence 5. The remaining 4 GEN
   credit is intentionally retained; no full-credit web withdrawal or zero-credit claim is made.

## Why this qualifies

This is a new contract-enforced allocation constraint, not score display, search sorting or restyling.
It consumes MS-004's accepted reputation but adds immutable request policy, frozen offer snapshots,
deterministic exclusion, canonical eligibility views and an actual signed consumer path. MS-001 A2A,
MS-002 executors and MS-003 delivery remain inherited infrastructure. No independent adoption,
portable credentials, imported scores, Sybil resistance or real-world performance oracle is claimed.

Portal reference: **NOT_SUBMITTED**. Accepted baseline remains MS-004; no MS-006 selection yet.
