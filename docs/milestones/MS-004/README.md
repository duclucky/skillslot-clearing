# MS-004 — Contestable Delivery Reputation

## Phase record

| Field | Value |
| --- | --- |
| Milestone ID | `MS-004` |
| Status | `SUBMISSION_READY` |
| Selected on | `2026-10-05` |
| Accepted baseline | MS-003, owner-confirmed accepted `2026-10-05` |
| Accepted evidence head | `741cf12ebd1c16329f7b4c74bade83b61374063a` |
| Working base | `305d615eac38a0e92f17a618a374ff025c1905f3` |
| Implementation commit | `08a3db06312b78ede2c2f70fe9eafd536043a746` |
| Finalized lifecycle evidence head | `8af4e497b99538da0cee4ec997d4b6a37384a602` |
| Accepted-baseline delta | `741cf12ebd1c16329f7b4c74bade83b61374063a..8af4e497b99538da0cee4ec997d4b6a37384a602` |
| Accepted deployment | Studionet `0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5` |
| MS-004 deployment | Studionet `0x1C282781D79Def68E4eea7895e2F427C2dA18F35` |
| Deployment transaction | `0x8ebca1b07ad4b1e282d25fdedd8b16402262ddc2394e5299fb58daa1f084cd1f` |
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
5. The UI reloads canonical review status; unresolved reviews can be voided after timeout. Read the provider aggregate through `get_provider_reputation` or the recorded network evidence.

My activity exposes these controls to matched participants. The finalization, resolution, and recovery
contract methods accept any wallet; unrelated wallets can call them with the canonical round/request IDs.

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
| Only finalized scores affect the canonical provider aggregate | aggregate counters updated once | `get_provider_reputation` | exact count/total/average, overturned/void exclusion | before/after aggregate read |
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

## Studionet evidence

- Deployment finalized on chain `61999` from source commit `f603a50014365e5f47491ab125f1ce3db71e2f54`.
- The bounded lifecycle finalized `submit_reputation`, provider `challenge_reputation`, and validator
  `resolve_reputation` for round `slot-muu45fa1`.
- Canonical status is `FINALIZED`; provider aggregate is one review, score total five, average `5000`
  milli-points, and zero overturned reviews.
- Accounting before and after all reputation writes is identical: 2 GEN received, 0 locked, 0
  credited, 2 GEN withdrawn, invariant true.
- Sanitized evidence: `docs/evidence/studionet/ms-004-contestable-reputation.json`.
- Original production evidence: `docs/evidence/studionet/ms-004-production.json`. That historical
  snapshot covered public reads; the original two-wallet reputation lifecycle was script-signed.
  See the dated browser amendment below for additional evidence rather than interpreting this
  original snapshot as a current inventory or global accounting read.
- Public Windows CI: `https://github.com/duclucky/skillslot-clearing/actions/runs/37223282038` (`success`).

## Exit gates

- [x] RED-first direct and frontend tests cover all state, verdict, deadline, authorization, and aggregate branches.
- [x] GenVM lint and full `npm run check` pass with all accepted regression tests (263 checks).
- [x] A new Studionet deployment proves submit, challenge, validator resolution, and aggregate consequence.
- [x] Production UI exposes every legal role/state action through tested role/state components and loads canonical MS-004 state; browser QA confirmed six open reviewer rounds and the finalized lifecycle round.
- [x] Public repo, CI, Vercel, dossier, evidence, and Portal copy are verified.

## Completion amendment — 2026-10-05

The accepted MS-003 evidence head remains `741cf12ebd1c16329f7b4c74bade83b61374063a`.
The code delta, including supporting layout maintenance, is pinned through
`a9fc2d0b779cd479192bffb89b339a77ab8f63f2`. The original exit-gate observation of six
open rounds is historical: the latest finalized inventory has five open and two cleared rounds.
The six-round creation snapshot and original two-wallet accounting proof are preserved unchanged.

Additional production Chrome/OKX QA exercised offer and request deposits of 1 GEN each, lock, clear,
delivery submission, requester acceptance, review publication, and provider challenge. The user signed
the transactions in the same persistent tab. Provider and requester were the same wallet in this
additional run; this proves UI integration, not role independence, adoption, or external performance.
The browser run completed user-signed validator resolution, with transaction
`0x4e493059dd8bfcd93b8cf0e50ce309951fa621750550a3f0b8017d93d307867b` confirmed
`FINALIZED` / execution `SUCCESS`. Canonical review status is `FINALIZED`; the UI reloaded that
status without losing the session. The aggregate increased from one to two counted reviews and
score total five to ten, average remained `5000`. Global accounting before/after resolution is
identical: 4 GEN received, 0 locked, 2 GEN credited, 2 GEN previously withdrawn, invariant true.
The available 2 GEN credit is not claimed as a new withdrawal. The original two-wallet script proof
remains an independent historical snapshot.

The activity layout defect was caused by sibling panels sharing a horizontal flex row. Supporting
CSS maintenance changes the position card to a single-column grid, keeps panel width bounded, wraps
actions/headings, and allows long digests to wrap. Production inspection verified no horizontal
overflow at desktop card width 950 px and mobile viewport 375 px. The live tab received the deployed
stylesheet without reload to preserve its wallet session; temporary viewport overrides were reset.

Fresh `npm run check` passed all 263 checks and the frontend build. Public CI for the code head passed:
https://github.com/duclucky/skillslot-clearing/actions/runs/37246525602.
The latest Vercel production deployment is `dpl_EYdYHXBgpBb2LCh5gE2cFkLgdjoR` (`READY`).
Detailed current evidence: `docs/evidence/studionet/ms-004-browser-lifecycle.json`.
Portal remains `NOT_SUBMITTED`; MS-005 remains unlocked backlog only.

Controlled QA measurement window: browser transaction timestamps and finalized reads on 2026-10-05,
deduplicated by contract + round ID + request ID. One additional review was finalized; this is a
functional integration measurement, not an adoption metric. No independently sourced external use
is claimed. Copy-ready Portal fields are in `docs/MILESTONE-SUBMISSION-MS-004.md` (under 1,000 characters).

Final evidence range:
https://github.com/duclucky/skillslot-clearing/compare/741cf12ebd1c16329f7b4c74bade83b61374063a...8af4e497b99538da0cee4ec997d4b6a37384a602.
Acceptance reconciliation before working base `305d615eac38a0e92f17a618a374ff025c1905f3`
is baseline context, not a new functionality claim. Later packet-only commits do not change the
pinned implementation or lifecycle evidence. Status remains `SUBMISSION_READY / NOT_SUBMITTED`.
