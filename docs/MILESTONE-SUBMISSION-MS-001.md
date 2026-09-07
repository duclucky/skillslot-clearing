# MS-001 Portal submission packet

## Copy-ready fields

**Recommended category:** Milestones

**Project:** SkillSlot Clearing - Validator-Cleared Agent Access

**Milestone title:** Onchain-Bound A2A Task Handoff

**Delta description:**

SkillSlot Clearing now turns a validator-cleared one-time grant into one exact A2A task authorization. The matched requester commits the SHA-256 digest of a bounded A2A 1.0 SendMessageRequest through a new Studionet write. The fixed production endpoint recomputes the body, reads the new can_dispatch view, and returns a deterministic TASK_STATE_SUBMITTED receipt only while that grant remains active. In the live proof, one finalized authorization produced the same task ID for two identical sends; finalized grant consumption then caused HTTP 403, while handoff accounting stayed unchanged and the final withdrawal left 2 GEN received, 2 GEN withdrawn, and zero liability. This phase adds one write, one view, a production A2A endpoint, a discovery-only Agent Card, an in-app handoff flow, and focused negative/lifecycle tests. It does not claim task completion, provider performance, signed third-party cards, mainnet, external adoption, or value movement from A2A receipts.

**What changed:** SkillSlot Clearing added requester-authenticated, task-specific onchain authorization and a deployed A2A 1.0 boundary that fails closed against the active canonical grant.

**Why it matters:** A validator-cleared access right can now authorize one exact protocol task, deduplicate safe retries, and become unusable immediately after grant consumption.

## Evidence links

- Public repository: https://github.com/duclucky/skillslot-clearing
- Exact implementation range: https://github.com/duclucky/skillslot-clearing/compare/67c531a...be1a8cd
- Implementation commit: https://github.com/duclucky/skillslot-clearing/commit/be1a8cd309e797f99401e174490941c010d21c12
- Deployment-evidence commit: https://github.com/duclucky/skillslot-clearing/commit/f952f63265ce59d2fdd30ca77f261b51c2daa2ac
- Successful Windows CI: https://github.com/duclucky/skillslot-clearing/actions/runs/33249385964
- Live app: https://skillslot-clearing.vercel.app
- Studionet contract: https://explorer-studio.genlayer.com/address/0x0c43822abD25a0247d0814E7dD501fA19b1C8958
- Deployment transaction: https://explorer-studio.genlayer.com/transactions/0x9f89f92dffe12e9656e246659150914c9e181a0d92a6d645cc1dd21b17f6f785
- Sanitized dispatch proof: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/ms-001-a2a-dispatch.json
- Production protocol/browser proof: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/ms-001-production.json
- Full milestone dossier: https://github.com/duclucky/skillslot-clearing/blob/main/docs/milestones/MS-001/README.md
- Accepted Project baseline: https://portal.genlayer.foundation/contribution/131883
- Pinned A2A specification: https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md

## Verified facts

| Fact | Verified value |
| --- | --- |
| Milestone status | `MS-001 / ACCEPTED`; Portal contribution `185631`, reviewed `2026-09-06` |
| Contract surface | One `SkillSlotClearing` contract, 10 writes, 9 views |
| Automated verification | 195 checks: 9 static, 50 direct, 5 receipt-parser, 11 deployment-tooling, 120 frontend; TypeScript and production build pass |
| Network identity | Studionet chain `61999`; source `be1a8cd`; contract SHA-256 `1c18989f4d4c28852b731ab624d74ed2cd93c4f154963143c0923ad2d07ce2e1` |
| Lifecycle | Finalized open, offer, request, lock, clear, authorize, consume, and withdraw writes; canonical round `CLEARED`, dispatch `AUTHORIZED`, grant `CONSUMED` |
| Protocol result | Two identical authorized sends returned HTTP 200 with one task ID; the same request returned HTTP 403 after consumption |
| Accounting | Handoff changed no accounting; final state is 2 GEN received, 2 GEN withdrawn, zero locked/credited, invariant true |
| Production QA | Vercel deployment READY; canonical round visible; clean desktop and 375x812 consoles; no mobile overflow; no controls below 44 CSS px; arbitrary destination rejected |

## Quantified metric

Measurement window: `2026-08-29T11:13:38.441Z` to `2026-08-29T11:15:27.172Z` on Studionet. One
requester EOA finalized one authorization for one round/request pair. Two identical canonical request
bodies were deduplicated by exact SHA-256 digest and deterministic task ID to one task identity. One
finalized consumption changed the next identical endpoint result from HTTP 200 to HTTP 403. Public EOA
addresses, round ID, request ID, digest, task ID, and transaction hashes are the identity and
deduplication keys; the sanitized network evidence is the measurement source.

## Real-usage signal and limitations

The production app, public same-origin Agent Card, and fixed endpoint are live and directly testable.
There is no independently verified external router, marketplace integration, adoption count, or user
traffic claim. The new write lifecycle is script-signed Studionet evidence, not a complete
browser-wallet capture of every write. The Agent Card is unsigned and discovery-only. Studionet is not
mainnet. A `TASK_STATE_SUBMITTED` receipt proves only that the bounded handoff was accepted; it does not
prove service completion, delivery quality, or provider performance and cannot move GEN.

## Quality-bar qualification

This is substantial because it adds contract state, a write, a canonical view, a production protocol
boundary, a browser flow, and a finalized lifecycle. It is not a restyle or repackaging: the accepted
grant and `can_route` are baseline inputs, while the exact task digest, `can_dispatch`, protocol
endpoint, deterministic receipt identity, and revocation proof are new. The phase builds on accepted
contribution `131883`, documents the exact delta from working base `67c531a`, and moves the grant from a
dashboard permission toward an executable protocol handoff.

## Submission outcome

Portal accepted this Milestone as contribution `185631` and awarded 300 points. The authenticated
submission history records the staff response: “Thanks for the submission. This is a meaningful update
to the project and qualifies as a Milestone.”
