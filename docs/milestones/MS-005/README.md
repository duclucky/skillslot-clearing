# MS-005 — Reputation-Bound Booking Policies

## Phase record

- Status: `SUBMISSION_READY`; execution evidence `LOCAL / STUDIO_DEV_LIFECYCLE / BROWSER / NATIVE_TRANSFER / PRODUCTION / PUBLIC_CI_VERIFIED`; Portal `NOT_SUBMITTED`.
- Selected: 2026-10-19. Track: Milestones on the accepted SkillSlot Project.
- Accepted MS-004: owner-confirmed 2026-10-19, no Portal recheck; public reference pending capture.
- Accepted product head: `be794338f9a00a00e72baab466d229cd03467e2b`.
- Accepted lifecycle evidence: `8af4e497b99538da0cee4ec997d4b6a37384a602`.
- Working base: `1866857` (submission-log-only changes after accepted product).
- Accepted contract: Studionet `0x1C282781D79Def68E4eea7895e2F427C2dA18F35`.
- Target: D1 Studio Dev, chain `61997`. Coherent v0.3 runtime/SDK deployment and lifecycle verified on 2026-10-19; the old Studionet aggregate is not imported.

## Exact delta and why it matters

A requester may commit minimum finalized review count and average score with its booking fee.
When a creator locks a round, the contract snapshots each offered provider's canonical finalized
aggregate. Clearing still requires independent semantic compatibility consensus, but deterministic
settlement must also satisfy the requester's immutable reputation policy. A model or client cannot
override the policy. An excluded request receives its existing full fee refund credit and the unused
offer its existing bond credit; no grant or delivery escrow is created for an excluded pair.

No new LLM scoring or reputation judgment is claimed. This phase consumes accepted MS-004 judgments
as a new onchain allocation constraint rather than merely displaying or sorting scores.

## Seven-field fingerprint

- Trust problem: a matcher/operator must not allocate a request to a semantically compatible provider below its committed reputation requirements.
- Actors/adversary: requester, provider, competing providers, creator; a model may propose an ineligible edge.
- Evidence class + authenticity mechanism: same-contract finalized provider aggregate, wallet-authenticated request policy, and creator-authenticated lock-time snapshot. No imported/self-reported reputation.
- Consensus question: inherited bounded semantic compatibility; reputation eligibility is exact deterministic arithmetic, not another AI prompt.
- State machine: request with policy in OPEN -> frozen provider snapshots at LOCKED -> consensus CLEARABLE/RETRYABLE -> eligible grant or unmatched refund; existing timeout/cancellation remains intact.
- Direct consequence: excludes an otherwise compatible edge from capacity allocation, grant creation and delivery escrow; credits unmatched fee and unused bond exactly once.
- Reuse surface: backward-compatible request write, offer/request canonical views, and pair-specific `get_booking_eligibility`.

## Design decisions

1. Extend `submit_request` with optional integer policy arguments, default zero/zero for old callers. Validate both before any mutation. Count is 0–1000; average is 0–5000 milli-points. A positive average requires at least one review. Zero/zero is explicitly unrestricted.
2. Snapshot count and score total for each offer at `lock_round`, never at submission or each retry. Freeze the same snapshot through all clearing attempts. This avoids a moving target and never changes an existing grant because later reviews arrive.
3. Use integer cross-multiplication (`total * 1000 >= minimum_average_milli * count`) rather than rounded displayed averages. No floats.
4. Expose count, total, snapshot flag and request thresholds through canonical views. The pair view reports `SNAPSHOT_PENDING`, `INSUFFICIENT_REVIEWS`, `AVERAGE_TOO_LOW` or `ELIGIBLE`; it is reputation eligibility only, not a promise of semantic fit/capacity.
5. Preserve the existing dark UI. Add optional labeled reputation controls in the request form, explain lock-time sampling, and show the chosen policy on the request position. No new dashboard, leaderboard, dependency, or restyle.
6. Old contracts are not upgraded in place. A new D1 deployment must prove coherent runtime/SDK/schema before writes. Old address remains discoverable for credit withdrawal; no manufactured migration of balances or reputation.

## Evidence Authority Matrix

| Claim | Bytes/controller | Authority and deterministic binding | Freshness/anti-replay | Semantic role | Failure and blocked consequence | Negative test |
| --- | --- | --- | --- | --- | --- | --- |
| Provider meets reputation policy | Provider may advertise scores but cannot submit them to this gate | Read only this contract's provider count/total, keyed by canonical offer.provider; policy belongs to canonical request.requester and request ID | Snapshot once inside authorized, unexpired lock; same round/offer/request keys across retries; no imported address/network proof | None; inherited semantic judgment cannot alter score/count | No grant/escrow for insufficient or absent snapshot; existing refunds, no penalty | Model MATCH with forged score prose still excluded; other wallet's aggregate not borrowed; wrong round IDs return no eligibility |
| Policy is requester-authorized | Request transaction creator | `gl.message.sender_address`, exact fee, request key, validated integer bounds | Unique request ID and one requester position per round; immutable after submission | None | Invalid policy rejects before deposit accounting/storage; old defaults unchanged | invalid count/average, positive score with zero count, duplicate, late request, non-open state |

## Admission gates

| Gate | Result and rationale |
| --- | --- |
| Replacement | PASS: a backend cannot authoritatively replace neutral semantic clearing or its policy-constrained allocation. |
| Judgment | PASS: inherited semantic compatibility stays independently adjudicated; no artificial new nondeterminism for integer thresholds. |
| Evidence availability | PASS: bounded canonical aggregate and at most four offer snapshots; runtime execution pending. |
| Evidence authenticity | PASS: same-contract aggregate and wallet-bound policy; no claimant score import. |
| Equivalence | PASS: inherited exact compatible-edge set; deterministic policy never delegated to model output. |
| Consequence | PASS: allocation/grant/escrow vs refund changes. |
| Adversarial | PASS: providers seek acceptance despite insufficient reputation, requester wants enforcement. |
| State model | PASS: immutable per-request policy, lock-time snapshot, unique grant/credits, local timestamp guards. |
| Reuse | PASS: typed request/view API and actual product consumer. |
| Contract count | PASS: one existing state owner, no mirror/guard. |
| Differentiation | PASS: accepted MS-004 records reputation; this phase consumes it to constrain new booking rights. |
| Claim-to-code | PASS_ADMISSION: mappings below; execution pending. |
| Full lifecycle | PASS_ADMISSION / PENDING_EXECUTION: all paths and acceptance cases specified below. |
| Scope honesty | PASS: no Sybil resistance, external performance, adoption, portable credential, or network migration claim. |

## Safety cards

| Method | Caller | Allowed states | Forbidden states | Temporal/expiry gate | Idempotency | Value/accounting effect | Views affected | Negative tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `submit_request` extension | requester wallet | OPEN, unique position, valid policy/exact fee | duplicate, capacity full, any other phase, invalid policy | now < open_deadline; equality late, stale OPEN rejects | duplicate rejects | unchanged exact 1 GEN fee enters escrow once | request/accounting | bounds, late±1/equality, duplicates, unchanged state/accounting on rejection |
| `lock_round` extension | creator only | OPEN with offers/requests | wrong caller/phase/empty | now < open_deadline; equality late | second lock rejects, snapshots never reset | snapshots only; no GEN movement | offer/eligibility/round | wrong caller, late±1/equality, immutable snapshots, cross-wallet isolation |
| `clear_round` settlement extension | creator only | LOCKED/RETRYABLE | other phases | now < clear_deadline; equality late | terminal duplicate rejects | inherited escrow for eligible matches, full unmatched fee/unused bond credit once | match/request/accounting/eligibility | malicious MATCH, thresholds±1/equality, retry with changed live aggregate, no double credits/grants |

## Value destinations

| Source | Eligible pair | Ineligible/no capacity pair | Retry/timeout/cancel | Canonical proof |
| --- | --- | --- | --- | --- |
| Requester 1 GEN fee | Existing delivery escrow, unchanged acceptance/validator/recovery destinations | Full requester credit once | Existing timeout/cancel refunds; RETRYABLE remains locked only until recovery | request/match/accounting/credit |
| Provider 1 GEN bond | Existing delivery escrow and settlement destinations | Full provider credit if unused | Existing timeout/cancel recovery | offer/match/accounting/credit |

## Claim-to-code and executable acceptance plan

| Claim | Method/state | View | Tests | Live proof required |
| --- | --- | --- | --- | --- |
| Atomic requester policy | submit_request, two appended fields | get_request | default compatibility, invalid/bounded policy, exact fee, deadline | browser signed policy request and canonical reload |
| Frozen provider reputation | lock_round, three appended offer fields | get_offer | aggregate populated from accepted lifecycle, subsequent finalized review does not alter snapshot | finalized lock and snapshot read |
| Ineligible MATCH cannot grant access | deterministic settle filter | get_booking_eligibility/get_match | low count/score, exact boundary, forged text/model score, alternate eligible provider, no match refund | same semantically compatible offer excluded under strict policy and allowed under satisfied policy |
| Funds remain recoverable | existing credit/recovery/withdraw | get_accounting/get_credit | no double credit, retry/expiry/cancel, all prior regressions | safe receipt projections, native balance proof for every new withdrawal |

## Anti-overlap

MS-001 exact A2A authorization, MS-002 executor permits, MS-003 delivery payout and MS-004
reviews/disputes/aggregate are accepted infrastructure only. No new claim for those methods,
old test counts, old transactions, seeded rounds, or cosmetic fixes. BL-008 portable credentials,
BL-009 search, signed origin cards and adoption remain deferred.

## Ordered implementation and exit gates

1. Append acceptance logs; pin accepted baseline and authority. DONE at selection.
2. RED direct tests for policy constraints/snapshots/allocation; minimal contract extension; semantic lint then GREEN. Preserve all old callers.
3. RED adapter/UI tests; implement atomic optional controls and canonical policy display; use existing finality/recovery paths.
4. Full `npm run check`, static payability/API and adversarial regression verification. No hidden critical skips.
5. D1 exact-runtime compatibility spike, coherent SDK/browser routing, source-pinned deployment and bounded live policy lifecycle. Do not bypass a healthy Studio Dev by habit.
6. Browser signed write, finality and canonical reload with persistent Chrome session; requester/provider roles distinct where proof requires it. User signs wallet prompts.
7. Public hygiene, incremental push, production deploy, URL/CI verification, safe evidence and <=1000-character English Portal packet.
8. Only mark SUBMISSION_READY when all execution gates pass. No Portal Submit without action-time authorization; no MS-006 before MS-005 outcome.

## Current verification

- Contract policy implemented with 17 new direct cases; 96/96 direct regressions passed with the pinned v0.3 runner. The safe `run_nondet_default` spelling and storage decorators are recognized by a narrowly additive linter RC compatibility adapter, with negative safety/schema checks retained.
- Healthy primary target: official Studio Dev chain 61997, canonical RPC `https://studio-dev.genlayer.com/api`. `studio-next` is not treated as a separate SDK chain. Selected `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` / GenVM v0.6.0-rc5 / SDK 2.0.0-rc.1; no untested latest-runner substitution.
- Diagnostic zero-application-value constructor probe finalized SUCCESS at `0x70EE5C71d57C2DF50fB7Fa8D32BF443b3F5508E3`, transaction `0x1f19d96337877f8c7585cc65229a9fba8d1d60976284dded88104b6a265fb4a8`; canonical revision `5`. This is a compatibility probe, **not** the SkillSlot deployment or a policy lifecycle claim.
- Optional form controls, exact milli-point parsing, atomic request encoding, canonical policy/exclusion display, selected-network wallet/A2A binding, live fee budget quoting and fail-closed execution verification implemented. Focused regression checks are passing; final full suite remains to be rerun after integration.
- New network/deployment evidence is separate from accepted Studionet records. Owner approved a public alias for the retained MS-004 deployment. `https://skillslot-ms004.vercel.app/?ms=004-legacy-public` serves the actual React app, and Chrome loads its original canonical Studionet rounds without Vercel login. A scoped `alias-protection-override` affects only this alias; project-wide protections remain unchanged. No state/reputation import.
- Source-pinned deployment and live script-signed value lifecycle are now verified below. Browser signed policy write/reload, final production QA and Portal submission remain pending. Production has not yet been switched to this revision.

### 2026-10-19 local integration gate

`npm run check` passed: 315 checks (14 static/linter regressions, 96 direct contract tests,
5 receipt parser tests, 25 deployment/fee tooling tests, 175 frontend/API tests) and production build.
Meaningful RED -> GREEN cases covered ineligible allocation despite model MATCH, precise policy
encoding, canonical exclusion reads, explicit fee forwarding, and rejection of FINALIZED/ERROR.
The real SDK v2 project-adapter test checks string-account normalization, wallet-provider routing,
chain 61997 and exact 1 GEN plus separately encoded fee budget. Source safety was not weakened:
the linter regression rejects both naked nondeterminism and an unmarked storage class.

The same-origin read proxy retains its old URL for compatibility but targets the selected Studio Dev
RPC. A direct Origin-header probe returned chain `0xf22d` and `Access-Control-Allow-Origin: *`;
actual browser CORS and signing remain a separate gate. Measured receipt profiles use 25% headroom
and per-method component maxima; unmeasured methods are explicitly `network-default`, not measured
claims. Withdrawal quoting fails closed until its emitted-message path has a real measurement.

### 2026-10-19 Studio Dev lifecycle gate

- Source commit: `11be3f21f09c8b7a51d2880779076043bdbef1da`; source SHA-256 `b243a3625ec80241cb4ef4ef9a0453ba999f80fd38b4e4bfe019b760bffbfac2`.
- Contract: `0x3835fDE18eF5FF14c5Bdc87fE7a24043A231746d`; deployment hash `0xe3f8602128318f29700aa17199697ee02353114a8cd790d0bfd904bac314d9e6`, FINALIZED/SUCCESS.
- [Public source CI](https://github.com/duclucky/skillslot-clearing/actions/runs/39207602466): success. Later supporting changes require their own final check/CI.
- 25 finalized successful transactions, two pre-existing authorized EOAs; no faucet/new wallet/funding transfer. [Safe proof](../../evidence/studio-dev/ms-005-booking-policy.json), [measured profile](../../../frontend/fee-profile.json).
- `ms005-excluded`: semantic consensus returns MATCH, but snapshot count 0 fails count 1 / average 4000; no match/grant, fee and unused bond become refund credit.
- `ms005-unrestricted`: same bounded semantic need, default 0/0, MATCH grants access; accepted delivery enables a review challenged by provider and upheld by validators. Canonical provider aggregate becomes count 1, total 4, average 4000.
- `ms005-eligible`: count 1 / average 4000 boundary is eligible at lock; MATCH creates grant and delivery escrow; requester accepts delivery. The first excluded round remains ineligible after this later review (frozen count 0).
- Each actor withdraws exactly 1 GEN, canonical credit decreases by 1 GEN, and native balance increases by `0.999873694749999177 GEN` after network fees. No claim that fee deposit equals consumed cost.
- Final accounting: received 6 GEN, locked 0, credited 4 (provider), withdrawn 2; invariant true. Credits are intentionally retained for later wallet UI withdrawal testing, not falsely described as withdrawn.
- Read-only `node frontend/scripts/verify-ms005-proof.mjs` decodes only the clearing return bytes and projects verdict/pairs; all three recorded graphs contain MATCH. No raw receipt, validator configuration, stdout or stderr is persisted.
- Controlled developer QA only; identities deduplicated by chain + contract + round + request. This is not external adoption or a second browser-wallet lifecycle.

Six additional `ms005-explore-1` through `ms005-explore-6` OPEN rounds were seeded with 1 GEN fee/bond
terms and a seven-day joining window. These are zero-deposit developer-created inventory, not six
users or six independent policy proofs. Their six transaction receipts are separate keys in the same
evidence record. The 25-transaction policy lifecycle count above excludes this inventory maintenance.
The [legacy access record](../../evidence/studio-dev/ms-005-legacy-access.json) documents the scoped
public alias, not an upgrade or migration of the accepted contract.

Final pre-rollout local gate: `npm run check` passed **324 checks** (14 static/linter,
96 direct, 5 receipt parser, 26 deployment/fee tooling, 183 frontend/API), production build, and
explicit TypeScript checking of all six serverless endpoints. The new fee-quote API raises measured
execution quantities to at least the current network execution floor; a regression proves the
live floor cannot be replaced with stale consumed-cost data. Unmeasured paths remain labeled
network defaults. Only the measured withdrawal path has an emitted-message profile.

### Production browser findings (supporting corrections, not a new Milestone claim)

- Vercel's NodeNext API build requires a JSON import attribute. The fee profile import now declares
  `with { type: "json" }`; the mandatory API check uses NodeNext rather than only Vite/Bundler rules.
  Corrected live endpoints return a measured-profile quote on chain 61997 and FINALIZED/SUCCESS for
  the deployed contract transaction. The first rollout with a build diagnostic is superseded, not
  presented as final verified production.
- Fresh Chrome browsing hit `Server busy: all 8 execution slots occupied`. The adapter previously
  launched every round read concurrently and did not recognize this explicit transient failure.
  Two RED -> GREEN regressions now prove at most three canonical reads in flight and bounded retry
  for that exact busy error, with no write submitted/replayed. This mitigates this app's burst; it
  does not claim to increase shared network capacity. Final live UI recheck remains pending.

Post-correction `npm run check`: **326 checks passed** (14 static/linter, 96 direct,
5 receipt parser, 26 deployment/fee tooling, 185 frontend/API), plus production build and NodeNext
API type checking. These local checks do not replace the pending Chrome policy-signing gate.

## Final execution amendment — 2026-10-19

The preceding pending statements are historical checkpoints, superseded by the evidence below.

- Final `npm run check` passed **326** checks (14 static/linter, 96 direct, 5 receipt parser,
  26 deployment/fee, 185 frontend/API), production build and NodeNext API checking. No critical skips.
  Contract source and deployed frontend are unchanged by this evidence amendment.
- Deployed application source: `7c54c9c3fe776046a3a3a0472bdcb22388606ea0`;
  [public CI](https://github.com/duclucky/skillslot-clearing/actions/runs/39214981065) completed `success`.
  Vercel production `dpl_7B2jqXmdBNDnr9Yfng2pp6HcraQc` is `READY`. App, old public alias and new contract
  explorer returned HTTP 200; live RPC returned `0xf22d`; measured request quote and invalid-hash
  rejection passed. [Production record](../../evidence/studio-dev/ms-005-production.json).
- Persistent Chrome/OKX exercised invalid policy rejection before wallet submission, then the user
  signed count **1**, average **4.000/5**, and exact **1 GEN** booking. Transaction
  `0x399f88be4e57b4b4a6302d269393db7b0ba9566190f7dfc81551e2dae8a72653`
  finalized `SUCCESS`; canonical policy survived reload. The user-approved web cancellation retry
  `0x963ae9866fb767af436f22122dddd071f6522b91df9c8013acf9133f3489d638`
  finalized `SUCCESS`; request/round became `CANCELLED`, credit increased 4 -> 5 GEN, locked value 0.
  This is refund **credit**, not a native transfer. Earlier wallet-cancelled attempts had no hash.
  [Browser record](../../evidence/studio-dev/ms-005-browser-lifecycle.json).
- The owner separately authorized a script withdrawal of **exactly 1 GEN**, not the web button's
  whole 5 GEN. Transaction `0xfe2e75c91eb368701a9c938e1b9bc0fb13d05f494ed1fa50d58385f29a155301`
  finalized `SUCCESS`. Native contract balance decreased exactly **5 -> 4 GEN**; credit decreased
  **5 -> 4 GEN**; recipient increased **0.999873694749999177 GEN** net of fees. This supplemental
  proof brackets both native balances, unlike the earlier two actor-only withdrawal observations.
  [Native transfer record](../../evidence/studio-dev/ms-005-native-withdrawal.json).
- Latest global accounting: **7 GEN received, 0 locked, 4 credited, 3 withdrawn**, invariant true.
  The original script lifecycle retains its historical **6 / 0 / 4 / 2 GEN** snapshot. Read-only
  re-verification now appends a separate current observation rather than overwriting that history.
- Inventory now has **five OPEN** developer-seeded rounds and the browser QA round cancelled.
  The earlier six-round creation observation is historical. A visitor can inspect existing rounds
  but does not gain creator permission to lock/clear them; full reproduction uses their own round.
- Desktop policy cards and 375 px mobile layout were inspected, with no horizontal overflow
  (document width 360 px); the temporary override was reset. Screenshots were inspected in the
  browser tool output; no uncreated screenshot artifact/path is claimed.

### Delta measurement and limitations

Measurement window: finalized receipts and timestamped state reads on **2026-10-19**. Identity key:
**chain + contract + round + request**. Three script policy rounds prove semantic MATCH contrasted
with reputation exclusion/default admission/exact-threshold admission. One additional browser policy
request proves the actual consumer write/reload and cancellation. These are controlled developer QA;
the two-wallet script proof is distinct from the same-wallet browser requester/creator flow. Six
seeded rounds are inventory, not users. No independent adoption, imported reputation, Sybil resistance,
mainnet, Bradbury or Asimov result is claimed. Same-contract reviewed delivery evidence is bounded;
it does not certify external real-world performance. Network fee deposits are not consumed costs.

### Final claim-to-evidence cross-check

| New claim | Code / current tests | Executed evidence |
| --- | --- | --- |
| Immutable requester threshold with exact fee | `submit_request`; policy parsing, bounds and atomic adapter cases | Browser policy 1/4000, 1 GEN, finalized and reloaded |
| Frozen authoritative provider reputation | `lock_round`; retry/later-review/cross-wallet tests | Excluded snapshot remains count 0 after later finalized count 1 |
| Semantic MATCH cannot override policy | deterministic settle filter; threshold 3999/4000/4001 and alternate-offer tests | Three decoded MATCH graphs, excluded no-grant vs eligible grant/escrow |
| Recoverable value with no duplicated payout | existing cancel/withdraw and accounting regressions | Browser cancel gives 1 GEN credit; supplemental exact 1 GEN native debit and wallet increase |

MS-001 to MS-004 remain accepted infrastructure, not re-submitted capability claims. Runtime migration,
fee handling, read throttling and layout checks support this vertical slice; they are not separate
Milestones. BL-008, BL-009, BL-001B and independent adoption remain unlocked backlog. No MS-006 may be
selected before MS-005 has a recorded Portal outcome. Final Portal Submit is not authorized.

## Submission-ready checkpoint — 2026-10-19

Finalized implementation/evidence head: `8ff8f52e90297244054ba10341fcc96b165e3cd2`.
Its [public CI](https://github.com/duclucky/skillslot-clearing/actions/runs/39217570408) completed
successfully; Windows verification step finished at `2026-10-19T07:48:03Z`. Local 326 checks, build,
browser policy write/reload/cancel, Studio Dev semantic contrast and exact native-debit proof all pass.
Admission gates 12 and 13 now have executed evidence, not only a design-level PASS. Every new claim
has a source, current test, canonical consequence and safe evidence record. All fourteen gates remain
satisfied within the stated scope; no deferred feature or external adoption is implied.

Exact complete delta:
https://github.com/duclucky/skillslot-clearing/compare/be794338f9a00a00e72baab466d229cd03467e2b...8ff8f52e90297244054ba10341fcc96b165e3cd2.

The [copy-ready packet](../../MILESTONE-SUBMISSION-MS-005.md) has a **922-character** Changes &
Improvements field (limit 1000), title, verified evidence links and reviewer steps. Public links were
checked for HTTP 200. Later packet/log-only commits do not change the deployed code or pin a new
product delta. The accepted baseline stays MS-004. Portal reference: `NOT_SUBMITTED`; no award,
acceptance or MS-006 selection is claimed. Await explicit action-time authorization before Submit.
