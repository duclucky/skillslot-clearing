# MS-002 — Delegated Agent Execution Permits

## Phase record

| Field | Value |
| --- | --- |
| Milestone ID | `MS-002` |
| Status | `BUILDING` |
| Selected on | `2026-09-08` |
| Accepted baseline | Portal contribution `185631` (`ACCEPTED`) |
| Baseline commit | `69fded8b7b20f0eef18b659702967af8ea61faac` |
| Outcome reconciliation commit | `c0bf0818e85e3f04517bbaec190397159c2ef399` |
| Baseline deployment | Studionet `0x0c43822abD25a0247d0814E7dD501fA19b1C8958` |
| Implementation commit | `PENDING` |
| MS-002 deployment | `PENDING` |
| Portal reference | `NOT_SUBMITTED` |

## Exact new capability

A matched requester can delegate execution of its already-authorized exact A2A task to a separate EOA
agent wallet for a bounded time. The executor signs a canonical, domain-separated permit message; the
reference endpoint verifies the recovered signer and current onchain executor address, epoch, expiry,
task digest, active grant, cleared round, chain, and contract before returning the deterministic A2A
task receipt. The requester can revoke the permit from the product at any time.

This does not transfer the grant or requester authority. It removes the need for a human requester to
sign every HTTP invocation while preserving exact-task authorization and fail-closed revocation.

## Why this is a separate Milestone

- `MS-001` authenticates the task through a requester-written digest, but any HTTP caller holding the
  exact body can invoke the endpoint while the grant remains active.
- `MS-002` creates a new authenticated executor role and makes a wallet signature, current epoch,
  deadline, and canonical onchain permit mandatory for invocation.
- The delta adds new contract state, two writes, one view, a signed protocol extension, requester and
  executor UI journeys, and live negative evidence. None was claimed or accepted in `MS-001`.
- It is independently useful: a requester can hand one execution package to an autonomous EOA agent,
  then revoke it without consuming or transferring the underlying grant.

## User journeys

### Requester

1. Open an active, cleared grant in **My activity** and authorize the exact task digest as in `MS-001`.
2. Enter the executor EOA address and select a bounded permit duration.
3. Finalize `authorize_executor` on Studionet.
4. After canonical refresh, copy the portable execution package containing only public binding data.
5. Revoke later with `revoke_executor`; canonical state immediately blocks new sends.

### Executor

1. Connect the delegated EOA wallet and open the executor section in **My activity**.
2. Paste the execution package and inspect contract, round, request, digest, epoch, and expiry.
3. Sign the deterministic, domain-separated permit message with the connected wallet.
4. Send the exact A2A request plus signature headers to the fixed SkillSlot endpoint.
5. Receive the same deterministic task identity on an identical retry. Wrong signer, altered body,
   stale epoch, expiry, revocation, or consumed grant is rejected without chain or value mutation.

## Ten-dimension anti-overlap audit

| Dimension | MS-001 accepted baseline | MS-002 new delta | Result |
| --- | --- | --- | --- |
| User capability | Requester authorizes and sends its exact task | Requester delegates invocation to another wallet and can revoke it | `EXTENDS` |
| Contract state | Dispatch digest and status | Executor address, status, expiry, and monotonic epoch | `NEW` |
| Write methods | `authorize_dispatch` | `authorize_executor`, `revoke_executor` | `NEW` |
| Canonical views | `can_dispatch` | `can_execute_dispatch` with executor, digest, epoch, and time | `NEW` |
| Evidence authority | Requester transaction binds task digest | Executor EIP-191 signature binds current canonical permit | `EXTENDS` |
| Consequence | Exact task may enter fixed endpoint | Only current delegated executor may invoke it until revoke/expiry | `NEW` |
| Value surface | No dispatch value change | No new value destination or accounting mutation | `UNCHANGED` |
| External integration | Unsigned fixed-origin A2A send | Signed vendor extension on the same endpoint | `EXTENDS` |
| Frontend journey | Requester drafts, authorizes, sends | Requester authorizes/exports/revokes; executor imports/signs/sends | `NEW` |
| Test/evidence | Digest, requester, grant and retry identity | Wrong signer, stale epoch, expiry boundary, revoke and accounting | `NEW` |

No dimension repackages accepted `MS-001` work as new. Existing task creation and dispatch authorization
remain baseline infrastructure and will be cited, not recounted.

## Scope

### Included

- Append-only executor permit fields on `Match`.
- Requester-only `authorize_executor` and `revoke_executor` writes.
- Exact `can_execute_dispatch` canonical view with epoch and expiry.
- EOA `personal_sign` / EIP-191 verification at the fixed same-origin endpoint.
- Versioned SkillSlot A2A delegated-executor extension metadata.
- Progressive requester and executor UI with visible labels, inline failures, stable loading states,
  public-data export/import, and keyboard/touch accessibility.
- Direct, static, API, adapter, component, deployment-tooling, Studionet, and browser evidence.

### Explicit non-goals

- No smart-contract-account signatures, session keys, delegation chains, or key rotation.
- No signed third-party Agent Card or trust in a provider-controlled discovery document.
- No arbitrary outbound provider URL, SSRF-capable fetch, router adoption, or traffic claim.
- No service-completion proof, provider-quality judgment, payout, penalty, slashing, refund, or credit.
- No automatic final Portal submission without explicit action-time authorization.

## Architecture and trust boundary

```text
Requester wallet
  -> accepted authorize_dispatch(exact task digest)
  -> authorize_executor(executor EOA, bounded expiry) -> finalized epoch
  -> export public execution package

Executor wallet
  -> import package -> recompute task digest and canonical permit message
  -> personal_sign(canonical permit message)
  -> POST exact request + executor/epoch/expiry/signature headers
  -> endpoint recovers EOA signer and reads can_execute_dispatch
  -> deterministic Task(SUBMITTED) or fail-closed rejection

Requester wallet
  -> revoke_executor -> finalized state -> all later sends reject
```

The frontend owns package preparation and signing UX. The endpoint owns signature recovery and exact
binding checks but cannot grant authority. The GenLayer contract owns executor identity, epoch,
deadline, active grant, cleared round, and exact task digest. The accepted validator-cleared match
remains the source of the underlying right.

## Contract state and transition design

Append to `Match`, preserving existing field order:

- `executor: str`, initially empty;
- `executor_status: str`, initially `NONE`, then `AUTHORIZED` or `REVOKED`;
- `executor_expires_at: u256`, initially zero;
- `executor_epoch: u256`, initially zero and incremented for each new authorization.

`authorize_executor(round_id, request_id, executor, expires_at)` requires the matched requester, a
cleared round, active grant, accepted `authorize_dispatch`, a valid non-zero EVM address, and a deadline
strictly after current time but no more than seven days ahead. An identical active authorization is
idempotent. A different active executor/deadline must be revoked before replacement. Reauthorization
after revocation increments the epoch.

`revoke_executor(round_id, request_id)` requires the matched requester and existing match. It is
idempotent for `NONE` or `REVOKED` and changes an active permit to `REVOKED` without erasing audit
fields.

`can_execute_dispatch(round_id, request_id, executor, task_digest, epoch, expires_at)` returns true only when all
accepted `can_dispatch` predicates hold, executor status/address/epoch/expiry match exactly, and
`now < executor_expires_at`. At the exact expiry second it returns false.

## Write-method safety cards

| Method | Caller | Allowed state | Forbidden state | Time gate | Idempotency | Value/accounting | Views | Negative tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `authorize_executor` | Matched requester | Match; `CLEARED`; `ACTIVE`; dispatch `AUTHORIZED`; no active executor | Wrong caller; missing match; stale phase; consumed grant; no dispatch; invalid executor; active different permit | `now < expiry <= now + 7 days` | Exact active executor + expiry returns unchanged; post-revoke authorization increments epoch | Non-payable; totals unchanged | `get_match`, `can_dispatch`, `can_execute_dispatch`, `get_accounting` | caller; phase; grant; no dispatch; malformed/zero address; expiry past/equal/too far; duplicate same/different; accounting |
| `revoke_executor` | Matched requester | Existing match in any executor state | Wrong caller; missing match | None; expired permits remain revocable | `NONE`/`REVOKED` returns unchanged | Non-payable; totals unchanged | `get_match`, `can_execute_dispatch`, `get_accounting` | wrong caller; missing match; double revoke; expired revoke; accounting |

The accepted value-destination matrix is unchanged because neither method receives, credits, refunds,
withdraws, or transfers GEN.

## Evidence authority matrix

| Claim | Controller | Authority | Verification/binding | Freshness / replay | Consequence | Failure | Tripwire |
| --- | --- | --- | --- | --- | --- | --- | --- |
| One executor is currently permitted | Matched requester controls contract writes | Finalized SkillSlot state | Exact round/request, normalized executor, status, epoch, expiry | Monotonic epoch; strict expiry; revoke flips status | Continue to signature verification | HTTP reject; no mutation | Stale epoch/revoked permit rejects |
| Caller controls executor EOA | Executor wallet controls signature bytes | EIP-191 recovered address | Message binds domain, chain, contract, round, request, digest, executor, epoch, expiry | Valid only for current epoch/deadline | Return `SUBMITTED` receipt | HTTP 401/403 | Another wallet signature rejects |
| Exact task remains authorized | Requester controls request and digest write | Accepted dispatch state | Endpoint recomputes SHA-256; contract checks digest and active grant | Altered bytes change digest; consumption invalidates | Invoke fixed endpoint only | HTTP reject | One-character change rejects |
| Destination is bounded | Deployment source/configuration | SkillSlot Vercel deployment | Fixed same-origin handler; user destination fields rejected | Versioned route/extension | No arbitrary fetch | 400 reject | Injected destination rejects |

## Fourteen-gate audit

| Gate | Result | Reason |
| --- | --- | --- |
| Replacement | PASS | A private backend permit cannot prove delegation derives from current finalized grant state. |
| Judgment | PASS | Accepted GenLayer semantic judgment remains prerequisite; delegation cannot create a match. |
| Evidence availability | PASS | New authority is bounded contract state plus an attached signature; no unstable web evidence. |
| Evidence authenticity | PASS | Requester controls writes; executor controls signature; endpoint recomputes bindings. |
| Equivalence | PASS | No new nondeterministic validator path; checks are exact equality and contract time. |
| Consequence | PASS | Only current executor can invoke one exact task before revoke/expiry. |
| Adversarial | PASS | Package theft, wrong signer, stale epoch, altered body, and indefinite permits are tested. |
| State model | PASS | Permit is isolated per match, bounded, monotonic, revocable, and grant-dependent. |
| Reuse | PASS | Canonical view and signed HTTP extension are reusable by autonomous executor clients. |
| Contract count | PASS | One existing contract remains the sole state owner. |
| Differentiation | PASS | Delegated execution authority is not UI polish or another task digest. |
| Claim-to-code | PENDING | Every claim must map to implementation, tests, deployment, and browser evidence. |
| Full lifecycle | PENDING | Must prove authorize, signed retry, revoke, denial, and accounting on new deployment. |
| Scope honesty | PASS | EOA-only, fixed origin, no delivery/value/adoption claims are explicit. |

## Claim-to-code and evidence plan

| Claim | Contract | API/client/UI | Tests | Network/browser evidence |
| --- | --- | --- | --- | --- |
| Requester delegates without transferring grant | executor fields + `authorize_executor` | requester form/export | caller/state/idempotency/accounting | finalized write + match reload |
| Only exact executor can invoke | `can_execute_dispatch` | EIP-191 recover + signed headers | valid/wrong signer/executor | production signed 200 + wrong signer reject |
| Permit ends predictably | epoch/status/expiry | current permit display | before/at/after expiry; revoke; stale epoch | finalized revoke + production 403 |
| Retry is safe | no API write | deterministic receipt | duplicate exact request/signature | identical live task ID |
| Product supports both actors | canonical requester state | export/import/sign/send UX | component/adapter/a11y/error | desktop/mobile browser journey |

## UI constraints selected for this phase

The existing immersive visual system remains unchanged. Focused `ui-ux-pro-max` guidance requires:

- visible labels for executor address, expiry, and package input;
- one primary action per stage with immediate disabled/loading and success/error feedback;
- async errors caught and shown with a recovery path;
- controls at least 44 CSS px high, visible focus, keyboard operation, and no 375 px overflow;
- public permit data clearly distinguished from the wallet signature, which is never persisted;
- status conveyed by text/icon and color; existing Phosphor icons and semantic tokens only.

## Exit evidence checklist

- [ ] New contract behavior has RED-first direct/static tests and GenVM lint passes.
- [ ] API verifies a real EIP-191 signature and fails closed for every mismatch.
- [ ] Adapter and UI implement requester and executor journeys with regression coverage.
- [ ] Full local `npm run check` passes with fresh counts.
- [ ] Source identity, contract digest, runner, deployment transaction, and address are recorded.
- [ ] Studionet proves authorize, signed retry, revoke, denial, and unchanged accounting.
- [ ] Vercel exposes the same contract identity and protocol extension.
- [ ] Production browser checks pass at desktop and 375 px.
- [ ] GitHub main and CI are verified before the copy-ready Portal packet is produced.
- [ ] Final Portal Submit remains untouched until explicit action-time authorization.

## Long-term backlog retained

- Signed third-party Agent Cards with authoritative key discovery/rotation/revocation.
- Smart-contract-account and richer session-key verification.
- Arbitrary provider destinations only after separate SSRF/trust-boundary design.
- Independent external adoption evidence.
- Service delivery, dispute, reputation, and financial consequences as future phases.
