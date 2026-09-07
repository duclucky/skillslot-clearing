# MS-001 — Onchain-Bound A2A Task Handoff

## Phase record

| Field | Value |
| --- | --- |
| Milestone ID | `MS-001` |
| Status | `ACCEPTED` |
| Selected on | `2026-08-29` |
| Accepted Project baseline | Portal contribution `131883` (`Accepted`) |
| Public evidence commit | `eec05516cdb9b1ff008fae900731eda6434d8392` |
| Working-base commit | `67c531a` |
| Current deployment | Studionet `0x0c43822abD25a0247d0814E7dD501fA19b1C8958` |
| Implementation commit | `be1a8cd309e797f99401e174490941c010d21c12` |
| Deployment transaction | `0x9f89f92dffe12e9656e246659150914c9e181a0d92a6d645cc1dd21b17f6f785` (`FINALIZED`) |
| Portal reference | Contribution `185631`; submission `612ee13c-eaec-4352-a262-0e16748ece97` |
| A2A protocol pin | A2A `v1.0.1`, proto blob `400cdbad934654e27d7abbae1e145923eb40ac52` |

The accepted evidence commit and current working base are intentionally separate. The range
`eec0551..67c531a` contains pre-existing Project Explorer, wallet, metadata, proxy, UI, and reviewer
readiness work. None of that range is counted as the new Milestone delta.

## Exact new capability

A matched requester can bind one exact A2A `SendMessageRequest` digest to an active, validator-cleared
grant, send that exact request to a deployed SkillSlot reference A2A endpoint, receive a deterministic
task receipt, and then consume the grant. The endpoint refuses a request unless its body recomputes to
the onchain digest and the canonical grant is still active for that requester.

This is a new protocol handoff boundary, not a renamed `can_route` demo. The accepted contract currently
answers only whether an address may route. `MS-001` adds task-specific authorization, a canonical read,
an A2A 1.0 HTTP+JSON endpoint, an Agent Card, a browser journey, and live evidence that the endpoint
consumes finalized SkillSlot state.

## Why it qualifies as a Milestone

- **Substantial improvement:** new contract state/write/read plus a deployed A2A integration and user
  journey.
- **Not repackaging:** no accepted UI, wallet, metadata, recovery, or `can_route` work is counted again.
- **Builds on the accepted version:** the handoff is reachable only from an accepted validator-cleared
  match and active grant.
- **Documented delta:** this dossier pins the accepted baseline, working base, exact changed surfaces,
  tests, deployment, and evidence.
- **Moves toward real usage:** a cleared right becomes consumable by an A2A protocol endpoint instead of
  ending at a dashboard boolean.

## User journey

1. The requester opens **My activity** and selects an `ACTIVE` grant.
2. The requester enters a bounded text task. The browser creates an A2A 1.0 `SendMessageRequest` with a
   random message ID, exact SkillSlot chain/contract/round/request binding, and `returnImmediately`.
3. The browser canonicalizes the request, computes SHA-256, and asks the wallet to finalize
   `authorize_dispatch(round_id, request_id, task_digest)` on Studionet.
4. After a canonical reload shows the same digest, the requester sends the exact request to
   `/a2a/v1/message:send`.
5. The reference endpoint recomputes the digest and reads `can_dispatch` from the deployed Intelligent
   Contract. An invalid body, requester, grant, digest, contract, or network is rejected without a write.
6. A valid request returns an A2A `Task` in `TASK_STATE_SUBMITTED` with a deterministic task ID and
   SkillSlot binding. Repeating the exact request returns the same identity and does not create a second
   authorization.
7. The requester may finalize the existing `consume_grant` action. Once consumed, `can_dispatch` is
   false and the endpoint rejects later sends.

## Seven-part delta fingerprint

```text
Trust problem: An A2A endpoint must not accept a task merely because a caller claims to own a cleared SkillSlot grant.
Actors/adversary: Matched requester, matched provider/reference endpoint, bystander/replayer, and wallets trying to route another requester's grant.
Evidence class + authenticity mechanism: Canonical cleared match/grant plus a SHA-256 task digest committed by the matched requester in a finalized Studionet transaction.
Consensus question: Inherited from the accepted Project: are the authenticated provider offer and requester need semantically compatible for one scarce slot?
State machine: ACTIVE grant + empty dispatch digest -> ACTIVE grant + immutable AUTHORIZED digest -> CONSUMED grant; invalid HTTP evidence changes no chain state.
Direct consequence: Only the exact requester-committed task may enter the A2A endpoint while the validator-cleared grant remains active.
Reuse surface: authorize_dispatch, can_dispatch, get_match dispatch fields, the A2A 1.0 endpoint, and the public Agent Card.
```

## Scope

### Included

- One new non-payable contract write: `authorize_dispatch`.
- One new canonical view: `can_dispatch`.
- Dispatch digest and authorization status in the match view.
- A bounded A2A 1.0 HTTP+JSON `message:send` reference endpoint.
- A public same-origin Agent Card describing only the reference endpoint and its bounded skill.
- One inline, progressive A2A handoff panel for active grants in **My activity**.
- Direct, static, API, frontend, browser, deployment-parser, and Studionet lifecycle evidence.

### Explicit non-goals

- No JWS/JCS Agent Card verification, key rotation, or revocation in this phase.
- No arbitrary or user-provided outbound provider URL; the endpoint is fixed to the SkillSlot origin.
- No claim of third-party adoption or external traffic.
- No proof that a provider completed a service and no provider-quality judgment.
- No payout, penalty, refund, credit, slashing, or accounting change from an A2A request or receipt.
- No automatic final Portal submission without explicit action-time authorization.

## A2A protocol pin

Implementation is pinned to official A2A release `v1.0.1`:

- Specification: `https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md`
- Proto: `https://github.com/a2aproject/A2A/blob/v1.0.1/specification/a2a.proto`
- Proto blob: `400cdbad934654e27d7abbae1e145923eb40ac52`
- Binding used: HTTP+JSON `POST /message:send`
- Request type: `SendMessageRequest`
- Response type: `SendMessageResponse` with a `Task` payload

Unsigned card data is discovery-only in `MS-001`. It cannot authorize a dispatch or change value. JWS/JCS
origin authentication for third-party Agent Cards remains `BL-001B`.

## Architecture and trust boundary

```text
Requester wallet
  -> authorize_dispatch(round, request, sha256(canonical A2A request))
  -> GenLayer Studionet finalization
  -> canonical get_match/can_dispatch reload
  -> POST exact SendMessageRequest to /a2a/v1/message:send
  -> same-origin reference agent recomputes SHA-256
  -> reference agent reads can_dispatch from the deployed contract
  -> deterministic A2A Task(SUBMITTED) receipt or fail-closed rejection
```

The API does not trust requester, round, request, contract, chain, or digest fields simply because they
appear in JSON. The chain and active deployment are server configuration; the contract supplies the
requester and grant state; the body digest is recomputed; and all bindings must agree exactly.

## Contract state delta

`Match` gains:

- `dispatch_digest: str`, initially empty;
- `dispatch_status: str`, initially `NONE`, then `AUTHORIZED`.

`authorize_dispatch(round_id, request_id, task_digest)`:

- requires an existing match and cleared round;
- requires `gl.message.sender_address` to be the matched requester;
- requires the grant to be `ACTIVE`;
- accepts only one canonical lowercase 64-character SHA-256 hex digest;
- is idempotent for the already-authorized identical digest;
- rejects a different second digest so one grant cannot authorize multiple tasks;
- changes no GEN balance, credit, liability, or withdrawal total.

`can_dispatch(round_id, request_id, requester, task_digest)` returns true only when the match exists,
the round is `CLEARED`, the grant is `ACTIVE`, the requester matches, and the immutable authorized digest
matches exactly. Existing `consume_grant` invalidates the view by changing the grant to `CONSUMED`.

## Write-method safety card

| Method | Caller | Allowed state | Forbidden state | Time gate | Idempotency | Value/accounting | Canonical views | Required negative tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `authorize_dispatch` | Matched requester only | Match exists; round `CLEARED`; grant `ACTIVE`; digest absent or identical | Missing match, wrong requester, uncleared/cancelled/retryable round, consumed grant, malformed digest, different second digest | `N/A`: legality does not depend on time; it depends on finalized grant state | Identical digest returns without mutation; different digest rejects | Non-payable; all received/locked/credited/withdrawn totals unchanged | `get_match`, `can_route`, `can_dispatch`, `get_accounting` | wrong caller; wrong round/request; stale phase; consumed grant; short/uppercase/non-hex digest; duplicate same; duplicate different; unchanged accounting |

No existing value destination changes, so the accepted value-destination matrix remains unchanged.

## Evidence Authority Matrix

| Consequential claim | Representation and byte controller | Authority | Deterministic verification and binding | Freshness / anti-replay | Allowed consequence | Failure state and blocked consequences | Tripwire test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The requester owns an active validator-cleared grant | `get_match`, round phase, grant status; contract-controlled | Deployed SkillSlot contract after GenLayer finalization | Exact chain ID, contract, round ID, request ID, requester, `CLEARED`, and `ACTIVE` checks | Current canonical read; `CONSUMED` invalidates immediately | Continue to task-digest verification | HTTP rejection; no dispatch, value, credit, settlement, or chain mutation | Valid-looking request against another requester or consumed grant is rejected |
| The requester authorized this exact A2A request | SHA-256 hex committed by the matched requester; requester controls original A2A bytes | Requester EOA authenticated by `gl.message.sender_address` | Contract verifies caller; endpoint canonicalizes the exact request and recomputes SHA-256; body binds chain, contract, round, request, message ID, and nonce | One immutable digest per active grant; same body maps to the same deterministic task ID; old grant cannot dispatch after consumption | Return a protocol-level `SUBMITTED` task receipt | HTTP rejection; no task receipt, dispatch right, value, credit, or settlement | Correct stored digest paired with altered body, wrong entity binding, or wrong requester is rejected |
| The destination is the SkillSlot reference agent | Fixed same-origin endpoint in deployed source; not actor-controlled | SkillSlot production deployment | Server ignores any arbitrary destination in user data; active deployment and route are fixed configuration | Versioned A2A path and pinned protocol release | Invoke only the bounded reference endpoint | Reject unsupported destination/protocol; no outbound fetch or SSRF | Payload attempts to redefine the destination or protocol and is rejected |
| An A2A receipt was returned | Same-origin reference endpoint | SkillSlot reference endpoint over HTTPS | Deterministic task ID and binding fields; receipt is informational only | Same authorized request produces same task ID | Display `SUBMITTED` handoff receipt | Receipt never moves money or certifies service delivery | Forged receipt text cannot change contract, accounting, or provider credit |

## Fourteen-gate audit for the new surface

| Gate | Result | Delta-specific reason |
| --- | --- | --- |
| Replacement | PASS | A database cannot independently prove the right came from a finalized GenLayer semantic clearing result and canonical grant state. |
| Judgment | PASS | The phase consumes the accepted nondeterministic semantic judgment; it does not replace or bypass it with an offchain decision. |
| Evidence availability | PASS | The new boundary reads bounded canonical contract views; no new validator-fetched source is needed. A live probe records only status/method/binding metadata. |
| Evidence authenticity | PASS | The consequential task digest is committed by the matched requester EOA; the endpoint recomputes exact bytes and treats all failures as non-penalizing HTTP rejection. |
| Equivalence | PASS | Accepted semantic equivalence is unchanged; the new boundary uses exact normalized digest and identifier equality only. |
| Consequence | PASS | A task-specific right is enforced: only the committed request may enter the reference A2A endpoint. |
| Adversarial | PASS | Wrong wallets, requesters changing task bytes, and replaying callers benefit from bypassing the grant boundary. |
| State model | PASS | Authorization is isolated by round/request, requester-only, immutable, idempotent, non-payable, and invalidated by grant consumption. |
| Reuse | PASS | Builders can use the public write/view and A2A HTTP+JSON boundary without forking the clearing logic. |
| Contract count | PASS | The accepted single contract remains the sole state owner; no pass-through consumer contract is added. |
| Differentiation | PASS | This is a protocol execution boundary and task-specific state, not a visual change, rename, or raw registry. |
| Claim-to-code | PASS | Every claim below maps to contract state, client/API code, tests, and network/browser evidence. |
| Full lifecycle | PASS | Finalized authorization produced the exact canonical digest; two live sends returned one task identity; finalized consumption then caused HTTP 403; withdrawal left zero liability. |
| Scope honesty | PASS | The phase explicitly excludes service completion, arbitrary agents, signed third-party cards, adoption, and financial consequences. |

The full-lifecycle exit condition is satisfied by the sanitized Studionet dispatch proof and the
production protocol/browser proof. Browser inspection proves canonical reads, responsive layout, and
deployed protocol surfaces; script-signed transactions separately prove the new write, deterministic
retry identity, consumption, post-consume denial, withdrawal, and accounting.

## Delta claim-to-code matrix

| Claim (new) | Contract method/state | View/read | Test | Network evidence |
| --- | --- | --- | --- | --- |
| Matched requester binds one exact task | `Match.dispatch_*`; `authorize_dispatch` | `get_match` | direct authorization happy/negative/idempotency tests | finalized authorization receipt plus canonical digest reload |
| Different bytes cannot use the authorization | immutable digest | `can_dispatch` | digest/body mismatch API test and direct different-digest rejection | production endpoint returns bounded rejection; no write |
| Only an active validator-cleared grant can enter A2A | accepted match/grant plus `can_dispatch` | `get_round`, `get_match`, `can_dispatch` | wrong requester/phase/consumed grant tests | live active succeeds; consumed grant rejects |
| The app performs an A2A 1.0 handoff | no extra chain mutation | server canonical reads | A2A schema, task identity, and route-handler tests | live `/a2a/v1/message:send` response and public Agent Card |
| Retry does not create a second authorization identity | identical write is idempotent; deterministic receipt ID | `get_match`, `can_dispatch` | duplicate same digest plus duplicate API request tests | repeated request returns same task ID; accounting unchanged |
| Users can complete the flow in the product | `authorize_dispatch`, existing `consume_grant` | refreshed activity snapshot | component/app transaction and accessibility tests | production wallet lifecycle screenshot and safe projected evidence |

## UI design constraints

The selected `ui-ux-pro-max` guidance is applied without changing the accepted product style:

- show an explicit four-step progress sequence instead of an unexplained spinner;
- expose one primary action per stage;
- retain visible labels and inline cause-plus-recovery errors;
- keep controls at least 44 CSS px high and keyboard reachable;
- use the existing Phosphor icon family, typography, surfaces, and color tokens;
- announce transaction/API status through one polite live region;
- preserve task text during the in-page transaction and never present browser storage as canonical;
- remain usable at 375 px without horizontal scrolling and respect reduced motion.

## Verified evidence index

| Evidence | Required proof |
| --- | --- |
| Local checks | `npm run check`: contract lint/schema; 9 static, 50 direct, 5 receipt-parser, 11 deployment-tooling, and 120 frontend tests; TypeScript and production build pass (195 tests total) |
| CI | Windows run `33249385964` passed on deployment-evidence commit `f952f63` |
| Studionet deployment | Address `0x0c43822abD25a0247d0814E7dD501fA19b1C8958`, source `be1a8cd`, contract SHA-256 `1c1898...e2e1`, locked runner, chain `61999`, and finalized deployment transaction `0x9f89f9...f6f785` |
| Studionet lifecycle | Round `slot-mtea1oa2`; finalized `authorize_dispatch` `0x510500...fcab8`; exact digest; two HTTP 200 responses with one task ID; finalized consume `0xba0b5f...5466c`; post-consume HTTP 403; handoff accounting unchanged |
| Final accounting | Finalized withdrawal `0xde7fd9...5466c`; 2 GEN received and withdrawn; zero locked and credited; invariant true |
| Production/browser | Vercel deployment `dpl_E2PfvkfVWi8vKm2zGfDV6Y7cGP6D` READY; canonical CLEARED round visible; desktop and 375x812 console clean; no mobile overflow or controls below 44 CSS px; Agent Card and endpoint reachable; arbitrary destination rejected with HTTP 400 |
| Evidence files | `docs/evidence/studionet/deployment.json`, `docs/evidence/studionet/ms-001-a2a-dispatch.json`, and `docs/evidence/studionet/ms-001-production.json` |
| Portal | `docs/MILESTONE-SUBMISSION-MS-001.md` is copy-ready; final Submit still requires explicit action-time authorization |

## Delta result

### What changed

Compared with working base `67c531a`, implementation commit `be1a8cd` adds one non-payable contract
write, one canonical view, dispatch fields, a fixed-origin A2A 1.0 endpoint, a discovery-only Agent
Card, an in-app authorization/send/consume journey, resumable Studionet proof tooling, and focused
negative, protocol, accessibility, and lifecycle tests.

### Why it matters

The accepted Project previously ended at a generic one-time route permission. This phase makes that
permission usable at a protocol boundary: the matched requester must commit the exact task bytes, the
reference endpoint fails closed against current contract state, retries deduplicate to one identity,
and consumption revokes access.

### Quantified metric and measurement method

During the bounded Studionet proof window from `2026-08-29T11:13:38.441Z` through
`2026-08-29T11:15:27.172Z`, one finalized requester authorization for round `slot-mtea1oa2` and request
`request-flight` produced two HTTP 200 responses with exactly one deduplicated task ID; the identity
rule is exact canonical request digest plus deterministic task ID. After one finalized grant
consumption, the same request returned HTTP 403. Canonical accounting showed no handoff-induced change,
then the finalized withdrawal left 2 GEN received, 2 GEN withdrawn, zero locked or credited, and the
invariant true. The source is the sanitized Studionet evidence named above; actors are deduplicated by
their public EOA addresses.

### Real-usage signal and honest limitations

The live production app, fixed endpoint, and public Agent Card make the new capability directly
testable, but no independent external A2A router, marketplace, user count, or adoption is claimed. The
proof uses script-signed Studionet transactions rather than a complete browser-wallet capture of every
new-chain write. The unsigned Agent Card is discovery-only, Studionet is not mainnet, and a
`TASK_STATE_SUBMITTED` receipt does not prove service completion, delivery quality, or provider
performance.

## Deferred backlog after MS-001

- `BL-001B`: JWS/JCS-signed third-party Agent Cards, authoritative keys, rotation, and revocation.
- `BL-003`: independently verified adoption by an external A2A router or marketplace.
- Multi-agent destinations, service-performance evidence, delivery escrow, and financial consequences.

These items are not promised by `MS-001` and may be reordered only after the verified Portal outcome is
logged.

## Portal outcome

- Submitted: `2026-08-29`
- Reviewed: `2026-09-06`
- Outcome: `ACCEPTED`
- Award: 300 points
- Public contribution: `https://portal.genlayer.foundation/contribution/185631`
- Submission ID: `612ee13c-eaec-4352-a262-0e16748ece97`
- Staff response: “Thanks for the submission. This is a meaningful update to the project and qualifies
  as a Milestone.”

This accepted result promotes repository commit `69fded8b7b20f0eef18b659702967af8ea61faac`, the
Studionet deployment and sanitized lifecycle evidence above, and the corresponding live product state
to the baseline for the next phase. It does not promote any deferred claim about signed third-party
Agent Cards, external adoption, service completion, or mainnet.
