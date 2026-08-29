# SkillSlot Clearing Milestone Ledger

## Program identity

- Project: `SkillSlot Clearing - Validator-Cleared Agent Access`
- Track: `Projects`
- Repository: `https://github.com/duclucky/skillslot-clearing`
- Live app: `https://skillslot-clearing.vercel.app`
- Portal contribution: `https://portal.genlayer.foundation/contribution/131883`
- Portal status: `ACCEPTED`
- Portal contribution date: `2026-08-12`
- Portal award: `320 points`
- Ledger initialized: `2026-08-29`

## Current accepted baseline

| Field | Verified value |
| --- | --- |
| Portal record | Contribution `131883`, status `Accepted` |
| Public evidence commit | `eec05516cdb9b1ff008fae900731eda6434d8392` |
| Evidence basis | Accepted Portal record links CI run `31883306657`; that successful run pins `eec05516cdb9b1ff008fae900731eda6434d8392` |
| Deployment source commit | `446e8ede30cb5d91ef8ca3b6b92e0a646ba2adc8` |
| Contract | `0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834` on Studionet chain `61999` |
| Contract source digest | `0c6203a72fcc1c33f27a70cffd7ff4b1c5fea3621a81123e4e8592fe7f32ad94` |
| Runner family | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Deployment evidence | `docs/evidence/studionet/deployment.json` |
| Accepted CI | `https://github.com/duclucky/skillslot-clearing/actions/runs/31883306657` (`success`) |

The Portal does not expose a dedicated accepted Git commit field. The public evidence commit above is
the strongest pinned repository reference because it is the head SHA of the CI run linked from the
accepted contribution. The deployed contract has its own earlier source-identity commit and digest;
both references are retained rather than collapsed into one guessed baseline.

The accepted Portal notes still describe an eight-write surface, while the linked remediation
deployment and current specification expose nine writes including permissionless timeout recovery.
Treat authenticated provider metadata and `recover_expired_round` as accepted remediation work because
the accepted record links that deployment and its evidence. Do not claim either again as a Milestone.

## Accepted capability and evidence inventory

The following work is already accepted and cannot be counted again:

1. Bounded semantic compatibility judgment over provider offers and requester needs.
2. Deterministic unit-capacity clearing, one-time route grants, provider credits, requester refunds,
   cancellation, grant consumption, and credit withdrawal.
3. Provider offers bound to authorized metadata URI, body digest, issuer proof, provider address,
   capability IDs, policy version, and expiry before consequential clearing.
4. Permissionless refund-only recovery after round expiry without releasing provider fees.
5. Canonical accounting views and zero-liability lifecycle evidence using whole-GEN demo amounts.
6. A wallet-enabled React product with canonical reads and production OKX wallet proof for grant
   consumption and withdrawal, kept separate from the script-signed remediation lifecycle.
7. One deployed `SkillSlotClearing` contract and the public Vercel product/repository/CI surfaces linked
   by contribution `131883`.

## Pre-existing post-acceptance work

The repository contained the following work before the Milestone program began. It is not part of a
future `MS-001` implementation claim unless explicitly selected and submitted as that exact phase:

- Working-base commit at ledger initialization: `67c531a`.
- Existing range after the accepted public evidence commit: `eec0551..67c531a`.
- Project Explorer overview, listing copy, open reviewer rounds, and reviewer guidance.
- Generated provider metadata onboarding and the same-origin `/agents/` metadata route.
- Explicit EIP-6963 wallet selection, Studionet switch/add behavior, account menu, and disconnect.
- Same-origin Studionet read proxy, coalesced canonical refreshes, and wallet-RPC/read-RPC separation.
- The immersive video landing system, overview layout refinements, typography work, and PNG/SVG logo.
- Project Explorer documentation, tests, and related production polish.

These changes may be used as infrastructure for a later Milestone. Their existence must be disclosed in
that dossier, and their UI/UX or onboarding work must not be presented as newly built by another phase.

## Cross-phase claim and evidence inventory

This inventory is the anti-double-counting reference for the first Milestone selection. `Accepted` and
`pre-existing` rows are baseline context only; neither class may be presented as the new phase delta.

| Dimension | Accepted or pre-existing surface | Evidence reference | Available new headroom |
| --- | --- | --- | --- |
| User capability | Create, join, clear, recover, inspect, consume, and withdraw through the marketplace | Accepted Portal record, README, production app | Turn a cleared grant into a protocol-level agent handoff |
| Contract state | Rounds, offers, requests, matches, active/consumed grants, credits, and accounting | `contracts/skill_slot_clearing.py` | Bind one exact task digest to one cleared grant |
| Write methods | Nine accepted writes including timeout recovery and grant consumption | Contract source and direct tests | A bounded, requester-authorized dispatch transition |
| Canonical views | Eight accepted views including `can_route` | Contract source and frontend adapter | Task-specific dispatch authorization read |
| Evidence authority | Accepted metadata URI/digest/issuer/provider/capability/expiry checks | Remediation deployment and lifecycle evidence | Requester-authored onchain task digest and protocol receipt |
| Consequence | Deterministic grants, refunds, credits, withdrawal, and one-time grant consumption | Studionet lifecycle and accounting evidence | Permit exactly the committed task to enter an A2A handoff boundary |
| Value surface | Whole-GEN deposits, provider credits, refunds, and withdrawals | `get_accounting` plus lifecycle evidence | None planned for the first dispatch phase |
| External integration | Reusable `can_route` interface; no adopted router | README, submission notes, postmortem | Deployed A2A reference adapter consuming canonical authorization |
| Frontend journey | Marketplace and wallet lifecycle, including production consume/withdraw proof | Browser evidence and current frontend | Authorize a task, send it, and inspect a bounded receipt |
| Test/evidence | Contract/direct/frontend/deployment/browser suites for accepted behavior | CI, project tests, Studionet evidence | Replay, digest mismatch, wrong requester, wrong grant, adapter, and live handoff proof |

## Phase history

| Milestone ID | Title | Status | Baseline reference | Delta fingerprint | Commit range | Deployment identity | Evidence index | Portal reference | Outcome date | Supersedes/extends | Lessons and follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MS-001` | Onchain-Bound A2A Task Handoff | `IMPLEMENTED_LOCAL` | Accepted Portal `131883`; public evidence `eec0551`; working base `67c531a` | Task-specific onchain authorization plus deployed A2A 1.0 reference endpoint | Starts after `67c531a`; end commit pending | Pending | `docs/milestones/MS-001/README.md` | `NOT_SUBMITTED` |  | Extends accepted grants and `can_route`; no earlier Milestone | 195 local checks pass; Studionet and production proof remain required |

## Adaptive backlog

Backlog items are directional until one passes the quality and anti-overlap gates. Ordering is revised
after every verified Portal outcome.

| Backlog ID | Direction | Current relationship | Dependencies and evidence needs | Status |
| --- | --- | --- | --- | --- |
| `BL-001A` | Onchain-bound A2A task authorization plus a deployed reference adapter consuming the authorization | `EXTENDS` accepted grants and `can_route` with a new protocol handoff boundary | Current A2A protocol shape; task canonicalization; safe fixed-origin adapter; replay and digest evidence | `SELECTED_AS_MS-001` |
| `BL-001B` | JWS/JCS-signed, origin-authenticated A2A Agent Cards with key rotation and revocation | `EXTENDS` accepted metadata authenticity; deliberately split from `BL-001A` | Current A2A signature rules; authoritative keys; deterministic verification support in GenVM | `BACKLOG` |
| `BL-002` | Browser-complete multi-wallet lifecycle on the remediation deployment | `REMEDIATES` an evidence gap; not independently substantial | Two funded roles, safe manual signing, all changed canonical states, no write replay | `SUPPORTING_ONLY` |
| `BL-003` | Verified external adoption/traction by an A2A router, MCP marketplace, or scheduler | `NEW` only when independently sourced usage exists | Real consumer, deduplicated usage metrics, public integration evidence | `BACKLOG` |
| `BL-004` | Architecture/security increment that creates a new authenticated consumer boundary | `UNASSESSED`; routine refactor is ineligible | Threat model, new enforcement consequence, regression/property evidence | `BACKLOG` |

The A2A research reference was refreshed on `2026-08-29`: upstream release `v1.0.1` was published on
`2026-05-28`, and upstream `main` was observed at commit
`f63dbb48271940ca5bd421f87e27e4d6ec002795`. The detailed implementation will pin the exact protocol
artifact it uses rather than silently following `main`.

## Phase-selection audit

| Candidate | Quality bar | Anti-overlap result | Decision |
| --- | --- | --- | --- |
| `BL-001A` | Substantial new contract capability and real A2A integration; independently demonstrable; moves a cleared grant toward use | `EXTENDS`: new task-bound state, write/view surface, adapter, receipt, UI journey, negative tests, and network evidence; no earlier Milestone exists | Advance to design approval for `MS-001` |
| `BL-001B` | Substantial security improvement but depends on a verified GenVM-compatible signature path and key lifecycle | `EXTENDS`, but combining it with dispatch would make the first phase unnecessarily broad | Keep separate for reconsideration after the Portal outcome of `MS-001` |
| `BL-002` | Useful QA work but not a substantial standalone product increment | `REMEDIATES` existing evidence only | Supporting work; never submit alone |
| `BL-003` | Potentially strong real-usage evidence | `NEW`, but presently blocked on an independent consumer and cannot be manufactured | Keep directional; do not select |
| `BL-004` | Not yet a concrete user capability or bounded consequence | `UNASSESSED` | Retain as a discovery direction only |

`BL-001A` is the only viable next candidate. Its proposed delta is not the accepted `can_route` view:
it adds a requester-authorized digest for one exact task, a canonical task-specific authorization read,
and a deployed A2A reference adapter that refuses mismatched/replayed/unauthorized handoffs. Its first
phase does not certify provider performance, add financial consequences, support arbitrary outbound
origins, or claim external adoption.

## Retired or reserved claims

- Project Explorer visual redesign, wallet selection, network switching, disconnect, generated metadata,
  and read-proxy work are reserved as pre-existing post-acceptance work and cannot be silently relabeled.
- Routine bug fixes, documentation-only updates, more seed rounds, and test-count growth are supporting
  maintenance, not standalone Milestones.
- Mainnet, Bradbury, Asimov, external adoption, and post-reservation service performance remain unproven
  unless a later dossier supplies current authoritative evidence.

## Current phase pointer

- Active Milestone: `MS-001`
- Program state: `IMPLEMENTED_LOCAL`
- Last Portal reconciliation: `2026-08-29`
- Reconciliation evidence: accepted public contribution `131883` and the signed-in Portal submission
  history showing `SkillSlot Clearing - Validator-Cleared Agent Access` as `Accepted`.
- Next allowed action: bind the locally verified source to a commit and new Studionet deployment, then
  collect production A2A/browser evidence; do not absorb `BL-001B`, external adoption, arbitrary
  destinations, or financial delivery consequences.
