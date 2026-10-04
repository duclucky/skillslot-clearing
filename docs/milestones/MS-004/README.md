# MS-004 — Contestable Delivery Reputation

## Phase record

| Field | Value |
| --- | --- |
| Milestone ID | `MS-004` |
| Status | `LOCAL_VERIFIED` |
| Selected on | `2026-10-05` |
| Accepted baseline | MS-003, owner-confirmed accepted `2026-10-05` |
| Accepted evidence head | `741cf12ebd1c16329f7b4c74bade83b61374063a` |
| Working base | `305d615eac38a0e92f17a618a374ff025c1905f3` |
| Accepted deployment | Studionet `0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5` |
| Portal reference | `NOT_SUBMITTED` |

## Exact new capability

After one SkillSlot delivery reaches a terminal MS-003 settlement state, its matched requester may
publish one bounded 1–5 score with evidence. The matched provider may challenge that review with one
bounded response. GenLayer validators independently compare the review, response, locked offer/request,
delivery artifact, and terminal delivery outcome, then uphold the score, overturn it, or leave it
retryable as unverifiable. Unchallenged reviews finalize permissionlessly after the challenge window;
unresolved challenges become void permissionlessly at the recovery boundary. Only finalized upheld or
unchallenged reviews enter the provider's canonical aggregate.

## User journey

1. Complete a matched delivery through the existing MS-003 lifecycle.
2. The requester opens **My activity**, selects a 1–5 score, supplies bounded evidence, and signs one review transaction.
3. The provider either leaves it unchallenged or submits a bounded response before the challenge deadline.
4. Any wallet finalizes an unchallenged review after the deadline, or requests validator resolution for a challenged review.
5. The UI reloads canonical review status and provider aggregate; unresolved reviews can be voided after timeout.

## State and consequence

`NONE -> PENDING -> FINALIZED` for an unchallenged review.

`PENDING -> CHALLENGED -> FINALIZED | OVERTURNED | RETRYABLE -> FINALIZED | OVERTURNED | VOID` for a challenged review.

- `FINALIZED`: score is counted once in the provider aggregate.
- `OVERTURNED`: score is excluded and the provider's overturned counter increments once.
- `VOID`: unresolved score is excluded; no participant controls indefinite pending state.
- No MS-003 booking fee, provider bond, credit, or withdrawal destination changes.

## Delta claim-to-code matrix

| Claim (new) | Contract method/state | View/read | Test | Network evidence |
| --- | --- | --- | --- | --- |
| Requester can author one review only for its terminal delivery | `submit_reputation`; review fields bound to `Match` | `get_reputation` | requester/wrong-wallet/nonterminal/duplicate/bounds | authenticated submit transaction and canonical read |
| Matched provider can challenge before the exact deadline | `challenge_reputation`; response digest and deadlines | `get_reputation` | provider/wrong-wallet/deadline−1/equality/duplicate | challenge transaction and canonical `CHALLENGED` state |
| Validators resolve only the bounded dispute facts | `resolve_reputation`; custom independent evaluation | `get_reputation` | uphold/overturn/unverifiable/injection/malformed/terminal replay | finalized resolution receipt and stored reason |
| No participant can strand a review | `finalize_reputation`, `recover_reputation` | `get_reputation` | early/equality/late, wrong state, idempotency | permissionless close transaction |
| Only valid finalized scores affect discovery reputation | aggregate counters updated once | `get_provider_reputation` | exact count/total/average, overturned/void exclusion | before/after aggregate read |
| Users can complete the new lifecycle in the product | adapter writes plus My activity reputation card | canonical reload | component, adapter, transaction finality tests | production browser journey against MS-004 deployment |

## Write-method safety cards

| Method | Caller | Allowed/forbidden state and time | Idempotency | Value/accounting effect | Views and negative coverage |
| --- | --- | --- | --- | --- | --- |
| `submit_reputation` | matched requester | delivery terminal; no review exists | duplicate rejects | none | review + aggregate; wrong caller/nonterminal/score/text/duplicate |
| `challenge_reputation` | matched provider | `PENDING`; `now < challenge_deadline` | duplicate rejects | none | review; wrong caller/state/deadline−1/equality |
| `resolve_reputation` | any wallet | `CHALLENGED`/`RETRYABLE`; `now < recovery_at` | terminal replay rejects; unverifiable retry increments | none | review + aggregate; malformed/injection/every verdict/recovery boundary |
| `finalize_reputation` | any wallet | `PENDING`; `now >= challenge_deadline` | terminal replay rejects | counts score once | review + aggregate; early/equality/duplicate |
| `recover_reputation` | any wallet | `CHALLENGED`/`RETRYABLE`; `now >= recovery_at` | terminal replay rejects | voids score; aggregate unchanged | review + aggregate; early/equality/duplicate |

## Value destinations

MS-004 introduces no payable entrypoint and moves no GEN. Existing MS-003 booking fee, provider bond,
credits, locked liability, and withdrawals remain unchanged in every reputation transition. Tests must
assert the global accounting snapshot is identical before and after every new write.

## Anti-overlap

| Prior phase | Accepted consequence | MS-004 difference |
| --- | --- | --- |
| Project baseline | semantic offer/request allocation | reputation begins only after a settled matched delivery |
| MS-001 | one exact A2A task authorization and handoff | no task authorization or A2A receipt is claimed |
| MS-002 | bounded executor permit and revocation | no delegated signer or execution permission is claimed |
| MS-003 | delivery evidence decides escrow payout/refund | settlement is immutable; MS-004 adds a separate public review consequence |

## UI design decision

Extend the existing dark immersive **My activity** card with one progressive-disclosure reputation
section. Preserve typography, spacing, icon family, navigation, and card language. Use real labels,
native buttons/forms, visible focus, status text in addition to color, local error feedback, disabled
async actions, and canonical reload after finality. Do not create a new dashboard or restyle the product.

## Non-goals and deferred work

- No change to MS-003 payout, refund, withdrawal, or settled delivery outcome.
- No portable credential, cross-project reputation, token, ranking algorithm, Sybil-resistance claim, or external adoption claim.
- No second-level appeal after the validator outcome.
- No inference that a score proves real-world identity, legal performance, or facts outside the bounded submitted evidence.
- `BL-008` portable credentials and `BL-009` reputation-aware discovery remain backlog.

## Exit gates

- [x] RED-first direct and frontend tests cover all state, verdict, deadline, authorization, and aggregate branches.
- [x] GenVM lint and full `npm run check` pass with all accepted regression tests (262 checks).
- [ ] A new Studionet deployment proves submit, challenge, validator resolution, and aggregate consequence.
- [ ] Production UI exposes every legal role/state action and reloads canonical state.
- [ ] Public repo, CI, Vercel, dossier, evidence, and Portal copy are verified.
