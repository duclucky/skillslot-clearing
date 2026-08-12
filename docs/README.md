# SkillSlot Clearing product and contract brief

## Identity

- Idea ID: `IDEA-012`
- Project name: SkillSlot Clearing
- Project slug: `skillslot-clearing`
- Category: Projects
- Status: `BUILDING`
- Repository: local child repository; public remote pending
- Target network: `studionet`

## One-sentence product hook

SkillSlot Clearing lets independent validators match scarce agent-access slots
to wallet-authenticated needs by meaning, then grants one-time route rights and
settles booking credits deterministically.

## Trust problem and product boundary

Providers and requesters must not trust a marketplace operator or one backend
model to decide semantic fit when several requests compete for limited agent
capacity. An ordinary contract can enforce prices and capacity but cannot judge
whether differently worded capability promises satisfy required and excluded
meaning.

The product sells an onchain access reservation, not proof that an agent works
or completed a task. Provider performance, task quality, reputation, recurring
subscriptions, private Agent Cards, legal service obligations, and dispute
resolution are explicitly outside v1.

## Seven-part fingerprint

- Trust problem: neutral semantic edge selection for capacity-constrained agent access.
- Actors/adversary: round creator, competing providers, and competing requesters.
- Evidence class + authenticity mechanism: wallet-authenticated canonical offers
  and requests; A2A examples are non-consequential design evidence only.
- Consensus question: the exact compatible offer/request edge set, or
  `UNVERIFIABLE`, under locked requirements and exclusions.
- State machine: `OPEN -> LOCKED -> CLEARING -> CLEARED`, with `RETRYABLE` and
  safe `CANCELLED` recovery.
- Direct consequence: access grants, capacity consumption, matched provider fee
  credits, unmatched refunds, and one-time grant consumption.
- Reuse surface: round/order writes plus `can_route`, match, credit, and
  accounting views for A2A routers, MCP marketplaces, and DAO schedulers.

## Mandatory gate matrix

| Gate | Result | Evidence/reason |
| --- | --- | --- |
| Replacement | PASS | Removing GenLayer restores a privileged marketplace's semantic matching decision. |
| Judgment | PASS | Required/excluded natural-language capability meaning cannot be reduced to deterministic tags alone. |
| Evidence availability | PASS | Consensus input is bounded canonical order state; official A2A examples were fetched at a pinned commit. |
| Evidence authenticity | PASS | Wallet transactions authenticate actors' own promises/needs; external performance claims cannot trigger v1 consequences. |
| Equivalence | PASS | Exact pair decisions, bounded fact IDs, coverage, and compatible edge set are critical; prose is not. |
| Consequence | PASS | Accepted edges directly assign scarce access and booking credits. |
| Adversarial | PASS | Competing providers/requesters benefit from biased compatibility edges. |
| State model | PASS | Per-round isolation, immutable locked orders, append-only attempts, capacity and duplicate protections are required. |
| Reuse | PASS | Three named downstream consumers use the same writes/views. |
| Contract count | PASS | One state owner is sufficient; no pass-through guard is justified. |
| Differentiation | PASS | Batch bipartite semantic clearing differs from succession, winner selection, overlap rewards, markets, and escrow. |
| Claim-to-code | PASS | Every provisional visible action below maps to a capability/read/test/evidence boundary. |
| Full lifecycle | PASS - feasible | Browser path includes writes, finality, canonical reload, failure/retry, access consumption, and withdrawal. |
| Scope honesty | PASS | Design/source probe are the only completed evidence; performance/adoption are excluded. |

## Human users and jobs

| User/role | Primary job | Decision or outcome needed |
| --- | --- | --- |
| Provider operator | Offer one scarce agent-access slot with precise capabilities and exclusions | Know whether the slot matched, who received access, and when booking credit is withdrawable |
| Requester | Reserve one compatible agent slot without trusting marketplace keywords | Know the canonical match, exercise the one-time route right, or recover an unmatched fee |
| Round creator | Open and close a bounded clearing round | Know whether clearing finalized, needs retry, or can be safely cancelled |

## Locked contract-capability surface

Human-visible writes are limited to: open a round; submit an offer with a
provider bond; submit a request with a booking fee; lock a round; request or
retry semantic clearing; cancel only from a safe open state; consume a matched
one-time grant; withdraw canonical credit. Views expose round summary, the
connected user's positions, a match outcome, route permission, withdrawable
credit, and transaction-independent accounting.

The intended lifecycle is:

```text
creator opens round
  -> providers and requesters submit wallet-authenticated positions
  -> creator locks round
  -> validators decide bounded compatibility edges
  -> deterministic clearing creates grants and credits
  -> requester consumes one grant
  -> actors withdraw canonical credits
```

`UNVERIFIABLE` creates no matches or fee movement and exposes retry. A failed or
undetermined transaction leaves canonical state unchanged. Safe cancellation is
creator-only before clearing and credits each recorded deposit exactly once.

## Information architecture

The app is a focused two-view workspace, not a contract explorer.

| Screen/view | User purpose | Primary action | Required states | Mobile behavior |
| --- | --- | --- | --- | --- |
| Clearing floor | Understand the active round and place the one position relevant to the connected role | Submit offer/request, or lock/clear when creator | no wallet, loading, open empty/active, submitted, locked, clearing, retryable, cleared, failed | Single-column flow; sticky primary action; order summary collapses below form |
| My access & credits | See canonical matches, consume a grant, and withdraw available GEN | Use access or withdraw credit | no positions, matched active, consumed, unmatched refunded, credit ready, finalizing, failed | Compact cards; actions remain full-width and state-gated |

Round creation is a contextual creator panel reached from the empty/no-active
round state, not a permanent admin dashboard.

## Visibility matrix

| Function/data group | Visibility | Eligible role/state | User need or reason hidden |
| --- | --- | --- | --- |
| Round title, phase, counts, close/clear status | USER_PRIMARY | Everyone | Needed to decide whether to join or wait |
| Offer form and own offer result | USER_PRIMARY | Provider in `OPEN`; matched provider after clear | Core provider job |
| Request form and own request result | USER_PRIMARY | Requester in `OPEN`; requester after clear | Core requester job |
| Lock, clear, retry, safe cancel | USER_CONTEXTUAL | Creator in the exact legal state | Recovery/round progression only when authorized |
| One-time access action | USER_PRIMARY | Matched requester with active grant | The product consequence |
| Withdrawable credit | USER_PRIMARY | Connected wallet with credit | Real user outcome |
| Explorer link and transaction hash | USER_CONTEXTUAL | After submission/finality | Optional verification, not the primary outcome |
| Raw verdict JSON, compatibility matrix, attempt IDs, storage keys | SYSTEM_ONLY | None in primary UI | Validator/reviewer internals |
| Other users' addresses and deposits | SYSTEM_ONLY | None in primary UI | Not needed for the connected user's task |

## Locked UI action matrix

| Visible control | Expected capability | Eligible role | Legal state | Input/value | Expected finality | Failure/recovery |
| --- | --- | --- | --- | --- | --- | --- |
| Connect wallet | injected-provider discovery and Studionet switch | Any visitor | Any | No value | Connected network/account | Honest missing-wallet/network error |
| Open round | `open_round` | Creator | No active round | bounded title and terms; no value | Finalized then canonical round reload | Retry transaction; no local success state |
| Offer a slot | `submit_offer` | Provider | `OPEN` | bounded promise/requirements; 1 GEN bond | Finalized then own offer reload | Failed write leaves form recoverable |
| Request access | `submit_request` | Requester | `OPEN` | bounded need/exclusions; 1 GEN booking fee | Finalized then own request reload | Failed write leaves form recoverable |
| Lock round | `lock_round` | Creator | `OPEN` with both sides | No value | Finalized `LOCKED` reload | Show unmet precondition or failed tx |
| Clear matches | `clear_round` | Creator | `LOCKED` or `RETRYABLE` | No value | Submitted -> accepted/decided -> finalized -> canonical reload | `UNVERIFIABLE` exposes retry; undetermined/failed changes no state |
| Cancel safely | `cancel_round` | Creator | Safe `OPEN` only | No value | Finalized cancellation and credits reload | Duplicate/unsafe cancel blocked |
| Use one-time access | `consume_grant` | Matched requester | Active grant | No value | Finalized `CONSUMED` reload | Duplicate/wrong-wallet use blocked |
| Withdraw credit | `withdraw_credit` | Credited actor | Credit > 0 | No value | Finalized child transfer plus credit/balance reload | Debit-first; failed transfer evidence remains honest |

## User-facing state language

| Canonical status | User-facing label | User consequence/next step |
| --- | --- | --- |
| `OPEN` | Accepting offers and requests | Submit one position or wait for lock |
| `LOCKED` | Ready to match | Creator can ask validators to clear the round |
| `CLEARING` | Validators are matching | Wait; no access or payout is claimed yet |
| `RETRYABLE` | Matching needs another attempt | Creator can retry; all funds remain protected |
| `CLEARED` | Matches finalized | Use a matched access grant or withdraw credit |
| `CANCELLED` | Round cancelled safely | Withdraw the credited refund |
| `ACTIVE` grant | Access ready | Use the one-time route right |
| `CONSUMED` grant | Access used | No further action for this grant |
| unmatched request | No compatible slot | Withdraw the refunded booking fee |

## Interaction and feedback rules

- Wallet connection discovers injected providers, prefers EIP-6963, switches or
  adds Studionet, and never stores a private key.
- The app never declares success on signature or submission. It distinguishes
  submitted, accepted/decided, finalized, failed, and retryable states.
- Every finalized write triggers a fresh canonical read. Local storage may hold
  only a harmless dismissed-help preference.
- Missing contract address, wallet, network, or canonical data produces an
  explicit unavailable state, never fixtures presented as live state.
- Raw enums are preserved in the adapter and translated only at the view layer.

## Stable identifiers and input bounds

Identifiers are caller-chosen but validated before they become storage keys.
They use the ASCII grammar `[A-Za-z0-9][A-Za-z0-9._-]{2,79}`. This excludes the
internal `|` separator and makes compound keys unambiguous. A round ID is unique
for the lifetime of the contract. Offer IDs and request IDs are unique within a
round and are never reused after cancellation or clearing.

| Input | Bound and normalization | Rejection cases |
| --- | --- | --- |
| `round_id`, `offer_id`, `request_id` | 3-80 ASCII characters; exact case preserved | bad grammar, duplicate in scope |
| `title`, `label` | trim outer whitespace; 3-120 characters | empty after trim, control characters, over bound |
| `promise_text`, `need_text` | trim outer whitespace; 1-600 characters | empty, control characters, over bound |
| fact-ID CSV | zero or more unique safe IDs; max 600 characters; canonical comma join | empty token, duplicate, unsafe token, over bound |
| fee and bond | exactly `10**18` base units, displayed as `1 GEN` | any other configured amount or received value |
| round cardinality | at most four offers and four requests | fifth position on either side |

User prose may contain Unicode. Contract source remains ASCII-only. Text is not
lowercased, summarized, or silently rewritten because that could change the
meaning submitted for validator judgment. Prompt construction serializes text
as JSON data and labels it untrusted; text that resembles instructions has no
authority over the fixed task or response schema.

## Structured storage model

The contract has one `Contract` class and class-body storage annotations. No
collection is replaced in `__init__`. All `TreeMap` keys are `str` and use these
stable forms:

| Record/index | Key | Canonical fields |
| --- | --- | --- |
| `rounds` | `round_id` | creator, title, phase, fee/bond, insertion-order ID CSVs, counts, attempts, match count, round liability |
| `offers` | `round_id|offer_id` | provider, label, promise, capability IDs, deposit, matched request, active flag |
| `requests` | `round_id|request_id` | requester, label, need, required IDs, excluded IDs, deposit, matched offer, outcome |
| `matches` | `round_id|request_id` | offer/request IDs, provider/requester, grant status |
| `offer_by_actor` | `round_id|offer-actor|address` | offer ID for one-offer-per-wallet enforcement |
| `request_by_actor` | `round_id|request-actor|address` | request ID for one-request-per-wallet enforcement |
| `credits` | canonical address string | current withdrawable base units across rounds |
| `round_ids` | append-only `DynArray[str]` | public deterministic discovery order |

The canonical address helper uses the GenVM address string representation. An
offer and request can be submitted by the same wallet because they are distinct
roles, but one wallet cannot submit two offers or two requests in one round.
Order records are immutable after insertion. The bounded ID CSVs in each round
define deterministic insertion order; they are indexes, not evidence payloads.

Global accounting fields are `total_received_wei`, `total_locked_wei`,
`total_credited_wei`, and `total_withdrawn_wei`. A round also carries its current
locked liability so cancellation/clearing can prove it reached zero.

## Public contract interface

### Writes

```text
open_round(round_id, title, booking_fee_wei, provider_bond_wei)
submit_offer(round_id, offer_id, label, promise_text, capability_ids_csv) payable
submit_request(round_id, request_id, label, need_text, required_ids_csv, excluded_ids_csv) payable
lock_round(round_id)
clear_round(round_id) -> normalized clearing result
cancel_round(round_id)
consume_grant(round_id, request_id)
withdraw_credit(amount_wei)
```

Only `submit_offer` and `submit_request` are payable, and each requires exactly
`1 * 10**18` base units. Every other public write rejects a nonzero attached
value through metadata/runtime semantics and static metadata tests.

### Views

| View | Inputs | Returned canonical data |
| --- | --- | --- |
| `get_round` | `round_id` | phase, creator, terms, counts, attempt/match totals, bounded ID order, round liability |
| `get_offer` | `round_id`, `offer_id` | immutable offer plus matched request or empty result |
| `get_request` | `round_id`, `request_id` | immutable request plus outcome/matched offer |
| `get_match` | `round_id`, `request_id` | match actors/IDs and `ACTIVE`/`CONSUMED`, or empty result |
| `can_route` | `round_id`, `request_id`, `requester` | true only for the matched requester while its grant is `ACTIVE` |
| `get_credit` | `owner` | current withdrawable amount in base units; frontend formats GEN |
| `get_accounting` | none | four global totals, locked sum, and invariant flag |
| `get_round_ids` | none | append-only round IDs in creation order |

Views return JSON-compatible dictionaries/lists in direct mode and stable
serialized values over RPC. Absence is explicit and never filled with demo data.

## State machines and transition rules

### Round

```text
missing --open_round--> OPEN
OPEN --lock_round--> LOCKED
OPEN --cancel_round--> CANCELLED
LOCKED --clear_round/internal--> CLEARING --consensus CLEARABLE--> CLEARED
LOCKED --clear_round/internal--> CLEARING --consensus UNVERIFIABLE--> RETRYABLE
RETRYABLE --clear_round/internal--> CLEARING --consensus CLEARABLE--> CLEARED
RETRYABLE --clear_round/internal--> CLEARING --consensus UNVERIFIABLE--> RETRYABLE
```

`CLEARED` and `CANCELLED` are terminal. `CLEARING` is written only inside the
atomic clearing transaction; an aborted/undetermined transaction exposes no
accepted consequence. Offers and requests are legal only in `OPEN`. Locking
requires at least one offer and one request. Cancellation from `LOCKED`,
`CLEARING`, `RETRYABLE`, or `CLEARED` is forbidden. Repeating creator-owned
`cancel_round` on `CANCELLED` is the single documented idempotent no-op.

### Request outcome and grant

```text
PENDING --clear--> MATCHED + ACTIVE grant
PENDING --clear--> UNMATCHED + requester refund credit
ACTIVE --consume_grant by matched requester--> CONSUMED
```

There is no grant before `CLEARED`, no grant for an unmatched request, and no
path from `CONSUMED` back to `ACTIVE`. Grant consumption changes only the access
right; it does not assert a task was delivered and moves no funds.

## Consensus task and normalized schema

`clear_round` pre-reads the locked round and all bounded positions before
entering nondeterminism. The no-argument leader function sends that immutable
snapshot to `gl.nondet.exec_prompt(..., response_format="json")`. No other write
or view invokes nondeterminism.

The leader must return exactly this critical shape:

```json
{
  "verdict": "CLEARABLE",
  "pairs": [
    {
      "offer_id": "offer.alpha",
      "request_id": "request.one",
      "decision": "MATCH",
      "matched_ids_csv": "calendar.write",
      "missing_ids_csv": "",
      "prohibited_ids_csv": ""
    }
  ],
  "reason": "non-critical explanatory prose"
}
```

The alternative top-level verdict is `UNVERIFIABLE`. A `CLEARABLE` result must
cover the complete offer/request Cartesian product exactly once. Normalization
rejects missing/duplicate pairs, invented order IDs, unknown fact IDs, duplicate
fact IDs, malformed CSV/JSON, extra consequence-bearing fields, and invalid
enums. Each required fact ID must be classified as matched or missing, never
both. Prohibited IDs must come from that request's exclusion list. `MATCH`
requires no missing or prohibited ID; a semantic mismatch in unanchored prose
may still yield `NO_MATCH`.

The validator first rejects non-`gl.vm.Return`, reruns the same bounded task,
normalizes its result independently, and compares the top-level verdict plus
the complete canonical pair tuples. It ignores `reason`. A malicious leader,
schema-valid but semantically different replay, or incomplete result therefore
cannot pass equivalence merely because the prose sounds plausible.

`UNVERIFIABLE` is intentionally non-penalizing: the attempt counter increments,
the round becomes `RETRYABLE`, and deposits, credits, grants, matches, and
liability remain unchanged. The UI exposes retry only to the creator.

## Deterministic matching and consequence mapping

After consensus, deterministic code walks request IDs in insertion order. For
each request it walks offer IDs in insertion order and selects the first
consensus-`MATCH` offer whose unit capacity remains. Each offer has capacity one
in v1. Validator prose and response ordering cannot affect the result.

| Accepted normalized result | Deterministic consequence |
| --- | --- |
| `CLEARABLE`, request matched | create one `ACTIVE` grant; credit its provider the request's 1 GEN booking fee |
| `CLEARABLE`, request unmatched | credit its requester the 1 GEN booking-fee refund |
| `CLEARABLE`, every submitted offer | credit its provider the 1 GEN provider-bond refund, matched or not |
| completed `CLEARABLE` round | set all order outcomes, set round liability to zero, record match count, set `CLEARED` |
| `UNVERIFIABLE` | set `RETRYABLE`; no money/right consequence |
| failed, rejected, or undetermined transaction | no accepted canonical change; frontend offers transaction recovery |

## Accounting invariant

At every accepted state transition:

```text
total_received_wei
  == total_locked_wei + total_credited_wei + total_withdrawn_wei
```

- A payable submission increases received and locked by exactly 1 GEN.
- Clearing or cancellation moves each recorded deposit exactly once from
  locked liability to an actor credit; received is unchanged.
- Withdrawal checks `0 < amount <= caller_credit`, debits caller credit and
  `total_credited_wei`, increments `total_withdrawn_wei`, then emits the external
  transfer. A transfer failure reverts the whole transaction.
- `open_round`, `lock_round`, `clear_round` returning `UNVERIFIABLE`, and
  `consume_grant` move no value.
- No match, retry, duplicate cancellation, duplicate consumption, or duplicate
  withdrawal can double-credit, double-withdraw, or double-settle.

`get_accounting` exposes totals and the equality result. Direct tests assert the
invariant after every value transition and across isolated rounds. Human-facing
surfaces convert base units to GEN and use only small whole-GEN demo values.

## Write-method safety cards

| Write | Caller authorization | Allowed state / forbidden state | Idempotency | Value/accounting effect | Canonical views affected | Required negative tests |
| --- | --- | --- | --- | --- | --- | --- |
| `open_round` | any wallet becomes immutable creator | missing ID only; forbidden if ID ever exists | duplicate always rejects | non-payable; totals unchanged | `get_round`, `get_round_ids`, `get_accounting` | duplicate ID, bad ID/title/amount, nonzero value, round isolation |
| `submit_offer` | any wallet with no offer in round | `OPEN`; forbidden in all later/terminal phases | duplicate actor or ID rejects | receive and lock exactly 1 GEN | `get_round`, `get_offer`, `get_accounting` | wrong value, duplicate actor/ID, fifth offer, wrong state, finalized/cancelled, invariant |
| `submit_request` | any wallet with no request in round | `OPEN`; forbidden in all later/terminal phases | duplicate actor or ID rejects | receive and lock exactly 1 GEN | `get_round`, `get_request`, `get_accounting` | wrong value, duplicate actor/ID, fifth request, wrong state, finalized/cancelled, invariant |
| `lock_round` | round creator only | `OPEN` with both sides; forbidden elsewhere | duplicate lock rejects | non-payable; totals unchanged | `get_round` | wrong caller, empty side, wrong state, duplicate, cancelled/finalized, invariant unchanged |
| `clear_round` | round creator only | `LOCKED` or `RETRYABLE`; forbidden elsewhere | only `RETRYABLE` creates a new bounded attempt | `CLEARABLE` moves all liability to credits; `UNVERIFIABLE` moves none | all round/order/match/credit/accounting views | wrong caller/state, duplicate after clear, malformed/malicious/contradictory output, retry, terminal state, exact credits/invariant |
| `cancel_round` | creator checked before phase check | `OPEN`; duplicate creator call in `CANCELLED` is no-op; all other phases forbidden | documented no-op only for creator on `CANCELLED` | credits every recorded deposit once and zeros round liability | round/order/credit/accounting views | wrong caller including cancelled, locked/retryable/cleared, duplicate, two-round isolation, no double-credit, invariant |
| `consume_grant` | matched requester only | round `CLEARED` and grant `ACTIVE`; forbidden otherwise | second use rejects | non-payable; totals unchanged | `get_match`, `can_route` | wrong wallet, unmatched request, pre-finalized/cancelled, duplicate, other-round request, invariant unchanged |
| `withdraw_credit` | caller may debit only own credit | positive amount no greater than credit | duplicate/over-credit rejects | debit before external transfer; credited decreases, withdrawn increases | `get_credit`, `get_accounting` | zero/negative/over-credit, double withdrawal, debit-before-transfer, external recipient, transfer revert, invariant |

## Threat model and controls

| Threat | Incentive/impact | Contract/product control |
| --- | --- | --- |
| Provider exaggerates capability | win a booking fee | v1 treats the promise only as the provider's bonded commitment and never claims performance; access reservation is the bounded consequence |
| Requester injects instructions in need text | bias validators or escape schema | fixed prompt authority, JSON data envelope, full pair coverage, allowlisted enums/IDs, independent validator replay |
| Malicious leader invents/misses/reorders pairs | steer scarce capacity | complete Cartesian normalization and deterministic insertion-order matching |
| Creator locks empty side or clears twice | trap funds or double settle | both sides required; strict state guards; terminal `CLEARED`; accounting invariant |
| Caller forges another actor | steal grant/refund/credit | `gl.message.sender` binds positions, creator actions, grant consumption, and withdrawal |
| Duplicate/replayed writes | double position, grant, or value movement | stable IDs, actor indexes, terminal phases, debit-before-transfer, explicit duplicate tests |
| External Agent Card is false or replaced | unsupported performance consequence | never used as consequence-triggering evidence in v1 |
| Validator/source outage | funds penalized without evidence | `UNVERIFIABLE -> RETRYABLE`, no grant/credit movement |
| Frontend lies about success | user acts on nonexistent state | explicit transaction stages and canonical reload after finalization; no local canonical state |
| Superseded deployment retains value | stranded GEN | revision identity, resumable scripts, close/refund/withdraw plan, zero-liability evidence |

## Evidence and fact-authentication policy

| Fact/evidence | Source | Authentication | Consequence authority | Missing/invalid behavior |
| --- | --- | --- | --- | --- |
| round creator/configuration | accepted contract call | `gl.message.sender` and canonical storage | creator-only transition rights | write rejects |
| provider promise/capability IDs | provider call | sender authenticates it as that provider's own commitment | eligible for semantic access matching and return of its own bond | write rejects; no inferred promise |
| requester need/exclusions | requester call | sender authenticates it as that requester's own need | eligible for matching/refund of its own fee | write rejects; no inferred need |
| received GEN | GenVM message value | runtime value semantics | locked liability only | exact-value write rejects |
| semantic pair decisions | GenLayer equivalence principle | independent validator execution and normalized critical equality | deterministic grant/credit settlement | `UNVERIFIABLE`/rejected tx; non-penalizing |
| A2A Agent Cards and sample repo | official public source pinned for design research | repository commit and upstream provenance | none in v1 | omit from contract decision; no penalty |
| transaction finality/result | Studionet receipt/explorer | network receipt, allowlisted safe projection | frontend may reload/show finalized state | failed/undetermined; no success claim |
| screenshots/browser captures | project evidence package | public URL/time plus canonical state reference | reviewer evidence only | mark pending; never substitute for receipt/state |

No hash, screenshot, claimant-hosted JSON, or LLM assertion is treated as proof
of external performance. If later versions settle on delivery quality, they must
add an authoritative issuer/signature/replay/version mechanism and pass a new
authenticity gate.

## Claim-to-code matrix

| Public claim | Write/state transition | Canonical view | Local verification | Studionet evidence |
| --- | --- | --- | --- | --- |
| bounded isolated rounds | `open_round`, per-round keys | `get_round`, `get_round_ids` | `test_round_state.py::test_two_round_isolation` | `PENDING_REAL_EVIDENCE` |
| exact bonded offers and paid requests | payable submissions | `get_offer`, `get_request`, `get_accounting` | `test_positions.py`, `test_accounting.py` | `PENDING_REAL_EVIDENCE` |
| validators judge semantic compatibility | `clear_round` nondeterministic boundary | `get_round`, `get_match` | `test_semantic_clearing.py::test_complete_pair_consensus` | `PENDING_REAL_EVIDENCE` |
| capacity clears deterministically | `CLEARING -> CLEARED` | `get_match`, `can_route` | `test_semantic_clearing.py::test_insertion_order_capacity` | `PENDING_REAL_EVIDENCE` |
| unavailable judgment cannot penalize | `CLEARING -> RETRYABLE` | `get_round`, `get_accounting` | `test_semantic_clearing.py::test_unverifiable_preserves_liability` | `PENDING_REAL_EVIDENCE` |
| unmatched fees and all bonds are recoverable | clear/cancel credit moves | `get_credit`, `get_accounting` | `test_accounting.py`, `test_recovery_and_grants.py` | `PENDING_REAL_EVIDENCE` |
| route permission is one-time | `consume_grant` | `get_match`, `can_route` | `test_recovery_and_grants.py::test_grant_consumes_once` | `PENDING_REAL_EVIDENCE` |
| withdrawals preserve exact accounting | `withdraw_credit` | `get_credit`, `get_accounting` | `test_recovery_and_grants.py::test_withdraw_debit_before_transfer` | `PENDING_REAL_EVIDENCE` |

## Browser lifecycle coverage matrix

| Claimed browser action | Adapter wrapper | UI control/state | Frontend test | Finality and reload | Live evidence |
| --- | --- | --- | --- | --- | --- |
| connect/switch Studionet wallet | `connectWallet` | top-bar wallet control | `wallet.test.ts` | account/network read after permission | `PENDING_REAL_EVIDENCE` |
| open round | `openRound` | contextual empty-state creator form | `app.lifecycle.test.tsx` | finalized then `loadWorkspace` | `PENDING_REAL_EVIDENCE` |
| submit bonded offer | `submitOffer` | provider form in `OPEN` | `genlayerAdapter.test.ts` and lifecycle test | 1 GEN write, finalized, offer/accounting reload | `PENDING_REAL_EVIDENCE` |
| submit paid request | `submitRequest` | requester form in `OPEN` | `genlayerAdapter.test.ts` and lifecycle test | 1 GEN write, finalized, request/accounting reload | `PENDING_REAL_EVIDENCE` |
| lock round | `lockRound` | creator action when both sides exist | `app.lifecycle.test.tsx` | finalized round reload | `PENDING_REAL_EVIDENCE` |
| clear or retry | `clearRound` | creator action in `LOCKED`/`RETRYABLE` | adapter and retry lifecycle tests | submitted/accepted/finalized or retryable, then full reload | `PENDING_REAL_EVIDENCE` |
| safe cancel | `cancelRound` | separated creator recovery action in `OPEN` | adapter and cancellation lifecycle tests | finalized round/credit/accounting reload | `PENDING_REAL_EVIDENCE` |
| consume route grant | `consumeGrant` | matched requester action | adapter and one-time lifecycle tests | finalized match/route reload | `PENDING_REAL_EVIDENCE` |
| withdraw canonical credit | `withdrawCredit` | credit action for positive balance | adapter and withdrawal lifecycle tests | finalized receipt plus credit/accounting reload | `PENDING_REAL_EVIDENCE` |

## Deployment and evidence plan

1. Run the exact contract source/API-family lint, direct tests, static checks,
   frontend TypeScript/tests/build, and deployment parser tests through
   `npm run check` on Python 3.12.
2. Inspect current official Studionet/tool status and execute a bounded no-value
   smoke before a value-bearing lifecycle.
3. Bind each deployment revision to network, source commit, Depends/API version,
   address, and attempt status. Archive superseded revisions with reason and
   zero-liability recovery proof.
4. Use one creator/provider wallet and one separately authorized requester
   wallet. Record only public addresses, hashes, explorer URLs, timestamps,
   allowlisted status/result fields, canonical before/after views, and GEN deltas.
5. Demonstrate open -> offer/request -> lock -> clear -> match/route -> consume
   -> withdraw. The final accounting read must show zero locked liability and
   zero remaining demo credits after withdrawal.
6. Configure the public frontend with only the public contract address, verify
   the same lifecycle from the production browser, and keep script-signed and
   browser-wallet evidence explicitly separate.

Complete Studio transactions, validator config, `node_config`, private keys,
wallet exports, raw stdout/stderr, and `.env` content are forbidden evidence.

## Visual direction and preservation constraints

The users are technical operators making time-sensitive allocation decisions.
The interface should feel like a compact exchange ticket plus a calm operations
ledger: warm light canvas, ink typography, crisp rules, one signal color for
active actions, and strong typography-led hierarchy. It must not use AI-purple
gradients, a centered dark-mesh hero, a generic SaaS dashboard grid, excessive
glass, or an explorer-style table wall.

The offline engine was run with variance 6, motion 3, and density 7. Its generic
marketplace result recommended purple Soft UI and Inter, which conflicted with
the mandatory taste brief. Targeted style/color/typography searches supported a
minimal direct system, warm neutral canvas, and humanist/editorial pairing. The
recorded source of truth is `design-system/skillslot-clearing/MASTER.md`: warm
cream surfaces, ink foreground, one accessible green signal, Newsreader/Public
Sans/IBM Plex Mono, flat borders, Phosphor icons, and no decorative motion.

After Phase 3A the design tokens, typography, navigation, component shape,
spacing rhythm, and two-view arrangement are locked. Later work may only add or
correct the smallest state, control, disclosure, responsive, or accessibility
detail needed by the finalized contract interface.

## Design architecture, error handling, and test boundary

The frontend will use four independent units: a typed contract adapter; injected
wallet/network discovery; a transaction lifecycle state machine; and presentational
views that consume canonical domain models. The adapter can start with an honest
unconfigured implementation and later be replaced by `genlayer-js` without
restyling the UI.

Frontend tests must cover status translation, role/state action visibility,
wallet discovery and chain switching, submitted-to-finalized handling, failure
and retry, canonical reload after finality, one-time grant visibility, and the
absence of fixture-as-live behavior. Contract and deployment test matrices will
be finalized in Phase 4 before source code.

## Three concrete downstream consumers

1. A2A routers call `can_route(round_id, request_id, requester)` before sending a task.
2. MCP marketplaces reserve limited tool seats using the round/order interface.
3. DAO schedulers allocate contributor workflows to matched agent slots and
   consume the grant once assigned.

## Honest evidence status

- Completed: registry collision analysis, official-source landscape, pinned A2A
  source fetch, semantic separability probe, product/UX brief, offline design
  engine and anti-default override, typed frontend boundary, 7-test baseline,
  production frontend build, desktop/mobile visual inspection, and this locked
  contract specification.
- Pending: contract source, contract/static/direct/deployment tests, Studionet
  smoke/lifecycle, browser-wallet evidence, public GitHub, CI, Vercel, Portal
  submission, and external adoption.

## Kill criteria

Return to ideation if semantic matching can be replaced by deterministic tags
without losing the product, validator output cannot be bounded to existing IDs,
the access grant is not a meaningful canonical consequence, or implementation
would require claiming provider performance from self-authored evidence.
