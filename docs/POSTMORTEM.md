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

## Next milestone headroom

A credible substantial milestone is authenticated A2A capacity clearing: providers bind origin-signed, versioned Agent Cards to offers; validators combine the authoritative card with requester constraints; and a real A2A router consumes `can_route` before dispatch. That increment would add authoritative external capability evidence and real integration usage without repackaging the current access-reservation primitive. It must rerun all 14 gates, especially evidence authenticity, and cannot use claimant-hosted unsigned cards for financial consequences.
