# SkillSlot Clearing postmortem

## Outcome

The project passed all 14 ideation gates, shipped one `SkillSlotClearing` contract, and completed a consequential two-wallet Studionet lifecycle. Validators cleared a bounded semantic pair graph; deterministic code created one match; the requester consumed the grant; and all 2 GEN of semantic-lifecycle liability were withdrawn. A separate recovery flow proved a 1 GEN deposit, safe cancellation, credit, withdrawal, and exact EOA balance restoration. The public React marketplace reconstructs all deployed rounds, exposes every role-legal write, aggregates wallet activity, and passed desktop/mobile browser QA on Vercel production.

## What held up

- Keeping external performance claims outside v1 made canonical wallet-authenticated offer/request statements sufficient for the authenticity gate.
- A complete Cartesian pair graph plus normalized critical fingerprints allowed validators to disagree on prose while agreeing on consequence-bearing meaning.
- Deterministic insertion order and capacity-one settlement kept the nondeterministic boundary narrow.
- Credits-before-transfer accounting and canonical recovery reads made the value flow resumable and auditable.

## What changed during real deployment

Studionet enforced a 30-request-per-minute quota during receipt polling. The first offer transaction finalized even though the local process exited on rate limiting. Canonical reads recovered it without replay. Tooling now honors the nested RPC `retry_after_seconds`, polls more slowly, and keeps exact transaction evidence through recovery.

The balance-proof round was created after the semantic round, so a naive “last round ID” UI briefly surfaced the cancelled diagnostic round. The frontend now prefers the newest open round, then a round in decision, then useful cleared history before a cancelled diagnostic round. The lesson is general: diagnostic/evidence rounds are valid canonical entities, but product selectors must not confuse append order with user relevance.

## Validated versus pending

Validated: local contract behavior and adversarial tests; schema surface; deployment parser/tooling; exact source deployment; semantic consensus consequence; grant consumption; value accounting, withdrawal, and balance delta; public repository; current Windows CI; production canonical reads; responsive layout and console cleanliness.

Pending: a production browser-wallet write/finality capture; adoption by an external router or marketplace; any mainnet claim; any claim that a matched agent later performed successfully.

## MS-001 work in progress

The first Milestone increment is an onchain-bound A2A task handoff. It adds requester-only
`authorize_dispatch`, exact `can_dispatch`, a fixed-origin `POST /a2a/v1/message:send` reference
endpoint, and `GET /.well-known/agent-card.json`. The endpoint returns a deterministic
`TASK_STATE_SUBMITTED` receipt only for the request bytes committed to an active grant, and grant
consumption revokes the permission. The receipt does not prove service completion and cannot change
GEN accounting.

This phase deliberately stops short of origin-signed third-party Agent Cards and external adoption.
Those remain separate backlog candidates so they cannot be claimed from an unsigned same-origin
discovery card. New Studionet, production-browser, repository, and CI evidence remain exit conditions
before `MS-001` can become submission-ready.
