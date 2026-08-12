# SkillSlot Clearing product and contract brief

## Identity

- Idea ID: `IDEA-012`
- Project name: SkillSlot Clearing
- Project slug: `skillslot-clearing`
- Category: Projects
- Status: `SELECTED`
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

## Provisional contract-capability sketch

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

## Provisional UI action matrix

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

## Visual direction and preservation constraints

The users are technical operators making time-sensitive allocation decisions.
The interface should feel like a compact exchange ticket plus a calm operations
ledger: warm light canvas, ink typography, crisp rules, one signal color for
active actions, and strong typography-led hierarchy. It must not use AI-purple
gradients, a centered dark-mesh hero, a generic SaaS dashboard grid, excessive
glass, or an explorer-style table wall.

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

1. A2A routers call `can_route(provider_id, requester)` before sending a task.
2. MCP marketplaces reserve limited tool seats using the round/order interface.
3. DAO schedulers allocate contributor workflows to matched agent slots and
   consume the grant once assigned.

## Honest evidence status

- Completed: registry collision analysis, official-source landscape, A2A source
  fetch, semantic separability probe, product/UX brief.
- Pending: UI design engine output, frontend source/build, full contract spec,
  contract, tests, Studionet smoke/lifecycle, browser-wallet evidence, public
  GitHub, CI, Vercel, Portal submission, and external adoption.

## Kill criteria

Return to ideation if semantic matching can be replaced by deterministic tags
without losing the product, validator output cannot be bounded to existing IDs,
the access grant is not a meaningful canonical consequence, or implementation
would require claiming provider performance from self-authored evidence.

