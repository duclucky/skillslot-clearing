# SkillSlot Clearing Milestone Ledger

## Program identity

- Project: `SkillSlot Clearing - Validator-Cleared Agent Access`
- Track: `Projects`
- Repository: `https://github.com/duclucky/skillslot-clearing`
- Live app: `https://skillslot-clearing.vercel.app`
- Original Project contribution: `https://portal.genlayer.foundation/contribution/131883`
- Latest accepted Milestone: `https://portal.genlayer.foundation/contribution/185631`
- Portal status: `MS-001 ACCEPTED / MS-002 ACCEPTED / MS-003 VERIFIED — NOT SUBMITTED`
- Portal contribution date: `2026-08-12`
- Portal award: `320 points`
- Ledger initialized: `2026-08-29`

## Current accepted baseline

| Field | Verified value |
| --- | --- |
| Portal record | Original Project `131883` plus Milestone `185631`, both `Accepted` |
| Public accepted commit | `69fded8b7b20f0eef18b659702967af8ea61faac` |
| Evidence basis | Accepted Milestone `185631` links the final CI run `33250187578`, dossier, lifecycle proof, deployment transaction, and contract explorer |
| Deployment source commit | `be1a8cd309e797f99401e174490941c010d21c12` |
| Contract | `0x0c43822abD25a0247d0814E7dD501fA19b1C8958` on Studionet chain `61999` |
| Contract source digest | `1c18989f4d4c28852b731ab624d74ed2cd93c4f154963143c0923ad2d07ce2e1` |
| Runner family | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Deployment evidence | `docs/evidence/studionet/archive/2026-09-07T23-06-04-354Z.json` |
| Accepted CI | `https://github.com/duclucky/skillslot-clearing/actions/runs/33250187578` (`success`) |

The Portal does not expose a dedicated accepted Git commit field. Commit `69fded8` is the strongest
pinned repository reference because it is the head SHA of the successful CI run linked from accepted
Milestone `185631`. The deployed contract retains its separate source-identity commit and digest.

The prior accepted Project baseline remains preserved in the `MS-001` phase row and dossier: Portal
`131883`, public evidence `eec0551`, deployment source `446e8ed`, and contract
`0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`.

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
8. Requester-authenticated immutable task digests, exact `can_dispatch`, the fixed-origin A2A 1.0
   endpoint, deterministic retry identity, post-consume rejection, and the in-app handoff flow accepted
   as Milestone `185631`.

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

This inventory is the anti-double-counting reference for `MS-002`. `Accepted` and pre-existing rows are
baseline context only; neither class may be presented as the new phase delta.

| Dimension | Accepted or pre-existing surface | Evidence reference | Available new headroom |
| --- | --- | --- | --- |
| User capability | Create, join, clear, recover, inspect, consume, withdraw, and authorize/send one exact A2A task | Accepted Portal records, README, production app | Delegate execution of that exact task to a separate agent wallet without transferring ownership |
| Contract state | Rounds, offers, requests, matches, active/consumed grants, credits, accounting, and immutable dispatch digest/status | `contracts/skill_slot_clearing.py` | Add bounded executor address, epoch, expiry, and revocation state to a match |
| Write methods | Ten accepted writes including `authorize_dispatch` | Contract source and direct tests | Requester-only authorize/revoke executor transitions |
| Canonical views | Nine accepted views including `can_dispatch` | Contract source and frontend adapter | Exact executor eligibility read with epoch and expiry |
| Evidence authority | Accepted metadata URI/digest/issuer/provider/capability/expiry checks | Remediation deployment and lifecycle evidence | Requester-authored onchain task digest and protocol receipt |
| Consequence | Deterministic grants, refunds, credits, withdrawal, and one-time grant consumption | Studionet lifecycle and accounting evidence | Permit exactly the committed task to enter an A2A handoff boundary |
| Value surface | Whole-GEN deposits, provider credits, refunds, and withdrawals | `get_accounting` plus lifecycle evidence | None planned for the first dispatch phase |
| External integration | Fixed-origin A2A 1.0 endpoint consumes canonical `can_dispatch`; no adopted third-party router | Accepted MS-001 dossier and live endpoint | Signed delegated execution request against canonical permit state |
| Frontend journey | Marketplace, wallet lifecycle, and requester-authored A2A handoff | Browser evidence and current frontend | Requester exports a permit; executor imports, signs, sends, and proves revocation |
| Test/evidence | Contract/direct/frontend/deployment/browser suites for accepted behavior | CI, accepted dossiers, Studionet evidence | Wrong signer, stale epoch, expiry boundary, revocation, replay identity, and unchanged accounting |

## Phase history

| Milestone ID | Title | Status | Baseline reference | Delta fingerprint | Commit range | Deployment identity | Evidence index | Portal reference | Outcome date | Supersedes/extends | Lessons and follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MS-001` | Onchain-Bound A2A Task Handoff | `ACCEPTED` | Accepted Portal `131883`; public evidence `eec0551`; working base `67c531a` | Task-specific onchain authorization plus deployed A2A 1.0 reference endpoint | Implementation range `67c531a..be1a8cd`; accepted evidence head `69fded8` | Studionet `0x0c43822abD25a0247d0814E7dD501fA19b1C8958`; source `be1a8cd`; deploy `0x9f89f9...f6f785` | `docs/milestones/MS-001/README.md`; `docs/evidence/studionet/ms-001-a2a-dispatch.json`; `docs/evidence/studionet/ms-001-production.json` | Portal contribution `185631`; submission ID `612ee13c-eaec-4352-a262-0e16748ece97` | `2026-09-06` | Extends original Project grants and `can_route`; no earlier Milestone | Awarded 300 points; staff: “This is a meaningful update to the project and qualifies as a Milestone.” Keep third-party card authentication and adoption separate. |
| `MS-002` | Delegated Agent Execution Permits | `ACCEPTED` | Accepted MS-001 Portal `185631`; reconciliation `c0bf081` | Requester-controlled executor EOA, bounded epoch/expiry, EIP-191 invocation, and revocation | Implementation `7a5047e`; accepted evidence head `21d72a1` | Studionet `0x7eDbD2E1EAc2189ef0Cd4F4f808f179f02138E4b`; source `7a5047e`; deploy `0xc4fc267...f0bbe8` | `docs/milestones/MS-002/README.md`; `docs/evidence/studionet/ms-002-executor-permit.json`; `docs/evidence/studionet/ms-002-production.json`; CI `34170508545` | `ACCEPTED — owner-confirmed; public contribution reference pending capture` | `2026-09-21` | Extends MS-001 exact-task dispatch with a distinct authenticated executor boundary | Acceptance was confirmed by the project owner. Preserve the public-reference evidence gap until the contribution URL is captured; do not reuse executor-permit claims. |
| `MS-003` | Delivery Escrow & Validator Settlement | `VERIFIED` | Accepted MS-002 source `7a5047e`; evidence head `21d72a1`; working base `b742585` | Matched fee/bond remain escrowed until authenticated delivery is accepted, validator-settled, or safely recovered | Implementation `afa0409`; production copy `c1dc72b`; evidence head pending | Studionet `0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5`; source `afa0409`; deploy `0x575903...98f5b` | `docs/milestones/MS-003/README.md`; `docs/evidence/studionet/ms-003-delivery-settlement.json`; `docs/evidence/studionet/ms-003-production.json`; `docs/evidence/studionet/deployment.json` | `NOT_SUBMITTED` | — | Extends matched grants with a new delivery and GEN-settlement lifecycle; does not recount clearing, task authorization, or executor permits | Script-signed live path proves 2 GEN escrow, requester acceptance, provider payout/withdrawal, zero liability, and invariant true; production browser verifies six OPEN rounds and zero console errors; public CI pending. |

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
| `BL-005` | Delegated agent execution permits for an exact requester-authorized A2A task | `EXTENDS` accepted task dispatch with a new authenticated executor boundary | EOA signature verification, bounded expiry/epoch, revocation, import/export UX, live signed proof | `SELECTED_AS_MS-002` |
| `BL-006` | Authenticated delivery escrow with requester acceptance, validator dispute resolution, and permissionless recovery | `EXTENDS` matched grants with a new post-match value consequence | Provider-authored bounded artifact, exact match binding, semantic fulfillment judgment, timeout recovery, browser lifecycle | `SELECTED_AS_MS-003` |

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

### MS-002 selection audit (2026-09-08)

| Candidate | Quality bar | Anti-overlap result | Decision |
| --- | --- | --- | --- |
| `BL-005` | Complete user capability, new contract state/writes/view, authenticated API boundary, revocation and live proof | `EXTENDS`: separate executor identity, epoch/expiry/revocation, signed invocation, import/export UI, negative tests, and deployment evidence are absent from MS-001 | Select as `MS-002` |
| `BL-001B` | Important origin security, but authoritative third-party key rotation and GenVM-compatible verification remain unresolved | `EXTENDS`, but risks a signed-card facade while backend trust remains authoritative | Keep in backlog |
| `BL-003` | Strong only with real independent adoption | `NEW`, but no independent consumer evidence exists | Keep in backlog; do not manufacture traction |
| `BL-004` | Directional architecture idea without a bounded user consequence | `UNASSESSED` | Keep in backlog |

`MS-002` is intentionally narrower than general delegated authorization. It permits one EOA executor to
invoke one already-authorized exact task until a bounded deadline and current epoch. It does not move
the grant, release value, certify delivery, accept arbitrary destinations, or authenticate third-party
Agent Cards.

## Retired or reserved claims

- Project Explorer visual redesign, wallet selection, network switching, disconnect, generated metadata,
  and read-proxy work are reserved as pre-existing post-acceptance work and cannot be silently relabeled.
- Routine bug fixes, documentation-only updates, more seed rounds, and test-count growth are supporting
  maintenance, not standalone Milestones.
- Mainnet, Bradbury, Asimov, external adoption, and post-reservation service performance remain unproven
  unless a later dossier supplies current authoritative evidence.

## Current phase pointer

- Active Milestone: `MS-003 — Delivery Escrow & Validator Settlement`
- Program state: `MS-001 ACCEPTED / MS-002 ACCEPTED / MS-003 VERIFIED — NOT SUBMITTED`
- Last Portal reconciliation: `2026-09-21`
- Reconciliation evidence: project-owner confirmation that MS-002 was approved. The exact public
  contribution reference remains an explicit evidence gap and must be captured before MS-003 is
  packaged for submission.
- Next allowed action: push the verified commits, capture public CI, then freeze the evidence head.
  Do not submit until explicit action-time Portal authorization exists.
