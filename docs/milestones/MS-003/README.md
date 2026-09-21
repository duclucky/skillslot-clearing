# MS-003 — Delivery Escrow & Validator Settlement

## Phase record

| Field | Value |
| --- | --- |
| Milestone ID | `MS-003` |
| Status | `VERIFIED — NOT SUBMITTED` |
| Selected on | `2026-09-22` |
| Accepted baseline | MS-002, owner-confirmed accepted `2026-09-21` |
| Accepted source | `7a5047e0b4e50a9e93d52488c68fd17441c051e8` |
| Working base | `b7425856b0bab3a2e76a975473be852c09ecf839` |
| Baseline deployment | Studionet `0x7eDbD2E1EAc2189ef0Cd4F4f808f179f02138E4b` |
| MS-003 deployment | Studionet `0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5` |
| Implementation commit | `afa040916d74a13044f3043022c633580e71bbbc` |
| Verified evidence head | `741cf12ebd1c16329f7b4c74bade83b61374063a` |
| Public CI | `https://github.com/duclucky/skillslot-clearing/actions/runs/35666807829` (`success`) |
| Contract digest | `6c3f04398c8c991eeebea0d7bd61398fd51760c43e2d336ca187df61b2e28949` |
| Portal reference | `NOT_SUBMITTED` |

## Exact new capability

A matched SkillSlot booking becomes a delivery escrow instead of paying the provider at clearing.
The matched provider submits a bounded artifact through its authenticated wallet. The requester may
accept it directly, or anyone may trigger a GenLayer semantic review that compares the exact artifact
with the locked request need, provider promise, and capability facts. Deterministic code
then releases or refunds the exact 1 GEN booking fee and 1 GEN provider bond.

## State and consequences

`AWAITING_DELIVERY -> SUBMITTED -> FULFILLED | FAILED | RETRYABLE -> RECOVERED`.

- Clearing keeps the matched request fee and matched offer bond locked; unmatched positions refund.
- `submit_delivery` is provider-only, before the delivery deadline, and stores bounded content plus a
  SHA-256 digest derived by the contract.
- `accept_delivery` is requester-only and credits fee plus bond to the provider exactly once.
- `review_delivery` uses independent semantic validation. `FULFILLED` credits fee plus bond to the
  provider; `FAILED` refunds the fee and awards the provider bond to the requester; `UNVERIFIABLE`
  changes no value and remains retryable.
- `recover_delivery` is permissionless after the recovery deadline. No submission awards fee plus bond
  to the requester; an unresolved/unverifiable submission refunds the fee to the requester and returns
  the bond to the provider, avoiding a penalty without verifiable evidence.

## Anti-overlap

| Dimension | MS-001/MS-002 baseline | MS-003 delta |
| --- | --- | --- |
| Capability | Authorize and delegate one exact A2A invocation | Prove and settle the resulting deliverable |
| Contract state | Grant, task digest, executor permit | Delivery artifact, deadlines, verdict, settlement status |
| Judgment | Offer/request compatibility | Artifact fulfillment against the locked match |
| GEN consequence | Booking fee and bond credited at clearing | Matched value remains escrowed until delivery outcome |
| UI | Task/export/import/send | Provider submit, requester accept, review/retry/recovery |
| Evidence | Permit signature and HTTP denial | Authenticated artifact plus exact credit/refund accounting |

This is not a resubmission of clearing, task authorization, executor authentication, UI redesign, or
transaction retry. It adds a distinct post-match service consequence. It also differs from a generic
buyer/seller escrow: the admissible artifact and payees are derived from an already validator-cleared
SkillSlot match and its exact provider/requester identities and capability facts.

## Evidence Authority Matrix

| Claim | Controller | Authority and binding | Consequence | Failure behavior |
| --- | --- | --- | --- | --- |
| Provider authored this artifact | Matched provider | `gl.message.sender_address`; exact round/request; contract-derived digest | Artifact becomes reviewable | Wrong caller/state/deadline reverts |
| Requester accepts fulfillment | Matched requester | Requester wallet and exact match | Provider receives fee and bond | Wrong/duplicate acceptance reverts |
| Artifact fulfills locked need | GenLayer validators | Same stored artifact, request, offer, facts, and allowed verdicts | Deterministic provider or requester credits | Invalid/disagreed output is `UNVERIFIABLE`; no value moves |
| Timeout branch is due | Contract clock | Stored delivery/recovery deadlines | Permissionless deterministic recovery | Early calls revert |

## Write-method safety cards

| Method | Caller | Allowed state/time | Idempotency | Value effect | Negative coverage |
| --- | --- | --- | --- | --- | --- |
| `submit_delivery` | matched provider | cleared match; `AWAITING_DELIVERY`/`RETRYABLE`; `now < delivery_deadline` | exact same retry digest returns unchanged | none | caller/state, empty/oversize/control text, boundary, accounting |
| `accept_delivery` | matched requester | `SUBMITTED`/`RETRYABLE`; before recovery | terminal duplicate rejects | provider gets fee + bond | caller/state/duplicate/accounting |
| `review_delivery` | anyone | `SUBMITTED`/`RETRYABLE`; artifact exists; before recovery | terminal duplicate rejects; unverifiable retry increments attempt | fulfilled: provider fee+bond; failed: requester fee+bond | malformed/contradictory output, full bindings, recovery boundary, unchanged-on-unverifiable |
| `recover_delivery` | anyone | nonterminal; `now >= recovery_deadline` | terminal duplicate rejects | no artifact: requester fee+bond; unresolved artifact: requester fee, provider bond | early/equality/late, duplicate, accounting |

## Value destinations

| Value | Source | Locked after match | Fulfilled/accepted | Failed/no delivery | Unverifiable recovery |
| --- | --- | --- | --- | --- | --- |
| 1 GEN booking fee | requester | yes | provider | requester | requester |
| 1 GEN provider bond | provider | yes | provider | requester | provider |

## Non-goals

- No claim that an HTTP receipt alone proves delivery.
- No arbitrary URL fetch, claimant-hosted evidence, external adoption, reputation, appeal, or mainnet.
- No new executor custody, smart-account signature format, or third-party Agent Card trust.
- No Portal submission without explicit action-time authorization.

## Exit gates

- [x] RED-first contract and frontend tests cover every transition and value branch.
- [x] GenVM lint and full `npm run check` pass: 240 checks.
- [x] A new Studionet deployment proves one complete accepted-delivery payout and withdrawal path; direct tests prove failed, unverifiable, and both recovery branches.
- [x] Production UI exposes the legal role/state actions and canonical reload.
- [x] Public repo, CI, live app, dossier, evidence, and submission copy are verified.

## Verified Studionet evidence

- Deployment transaction: `0x5759037505eef0d72f995d99c30405784252878e7e45179949298bb10cc98f5b`.
- Lifecycle round: `slot-mubu7h8g`; request `request-flight`.
- Provider submission: `0xe975d7352830812a6e00032710e28af878de5c1a67e77c0c7e6acbb6e05777e8`.
- Requester acceptance: `0x734a17056733157dc81514450c6785a6878f0765492e9f3bf9ea1cc6ee29a71d`.
- Provider withdrawal: `0x38b216b7ba4cb5da0870f4591a6d2c9a5b8caf1f501cb28000273d62a771d567`.
- Canonical result: `FULFILLED`, provider credit before withdrawal `2 GEN`, after withdrawal `0 GEN`, locked liability `0`, accounting invariant true.
- Sanitized proof: `docs/evidence/studionet/ms-003-delivery-settlement.json`.
- Production proof: `docs/evidence/studionet/ms-003-production.json`; Vercel deployment `dpl_9bESou4a4uYYRc3ZonzKMmCk4yFm` READY, six OPEN rounds, responsive checks passed, zero console warnings/errors.
- Public verification: evidence head `741cf12ebd1c16329f7b4c74bade83b61374063a`; Windows CI run `35666807829` completed successfully.
