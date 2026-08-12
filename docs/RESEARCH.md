# SkillSlot Clearing research record

Checked: 2026-08-12

## Current GenLayer landscape

The current official GenLayer guidance reserves Intelligent Contracts for
shared onchain decisions that deterministic code or a single backend cannot
make without restoring trust in one operator. It specifically requires a real
consequence, independently checkable evidence, structured output, and semantic
equivalence. Current package checks returned `genlayer 0.39.2`, `genlayer-js
1.1.8`, and `genlayer-mcp 2.2.0`. The official project boilerplate `main` branch
was pushed on 2026-07-26; its latest tagged release remains `v0.2.0`.

The local registry already covers bonded software covenants, governance
mandates, recall applicability, agent access-policy enforcement, deliverable
escrow, SEC filing triggers, FDA prediction settlement, AP2 mandate settlement,
sealed procurement, multi-researcher reward apportionment, and agent-provider
succession. A new product must avoid those state/consequence shapes.

## Agent protocol landscape

- A2A 1.0 defines Agent Cards for identity, capabilities, skills, endpoints,
  and authentication requirements. It supports signed cards, but capability
  advertisements are still untrusted input and are not proof of performance.
- ERC-8004 defines identity, reputation, and validation registries for agents;
  payments and concrete market clearing remain orthogonal.
- Existing A2A/agent marketplaces can discover or rank agents, but the surveyed
  official protocols do not provide validator-controlled semantic batch
  clearing that assigns scarce access rights and settles booking fees.

The last statement is a landscape inference from the cited protocol surfaces,
not a claim that no private implementation exists.

## Problem-first sweep

| Situation | Decision exposed to bias | Evidence feasibility | Result |
| --- | --- | --- | --- |
| Scarce agent slots matched to natural-language requests | Marketplace operator chooses semantic fit | Wallet-authenticated orders; bounded A2A examples | Keep |
| DAO proposals clustered before ballot admission | Agenda operator decides duplicate/conflict groups | Onchain proposals + constitution | Reject: MandateLock/Disclosure collision |
| Signed game transcript appeal | Game operator or moderator decides sanction | Needs independent issuer integration | Hold: authenticity not proven |
| Multi-service agent coalition assembly | Aggregator chooses a team that covers a job | Wallet orders + capability promises | Merge into batch clearing |
| Software incident cost allocation | Service operators dispute causal responsibility | Signed telemetry and incident report | Reject: source/auth complexity |
| Standards migration reward pool | Sponsor judges semantic migration completeness | Official standard + project commits | Reject: milestone/covenant collision |
| Port disruption settlement | Carrier or buyer interprets force-majeure notice | Official port bulletins | Reject: generic clause/escrow shape |
| Scientific replication credit | Publisher allocates credit for confirming evidence | Papers/data are public but provenance fragmented | Reject: authenticity/bounds |
| Disaster mutual-aid tranche | Treasury interprets public needs reports | Official reports exist but consequence is high risk | Reject: bounded coverage insufficient |
| Open-source maintainer succession | Registry decides whether successor is adequate | Repository history and signatures | Reject: PactRelay/continuity collision |

## Architecture alternatives

1. **SkillSlot Clearing — selected.** Validators output a bounded compatibility
   graph; deterministic code performs multi-order clearing and creates access
   grants. Strongest agentic-economy reuse and least registry collision.
2. **CharterMerge.** Validators cluster and conflict-check DAO proposals before
   admission. Simpler evidence, but structurally too close to mandate governance
   and multi-claim semantic overlap.
3. **ReplayAppeal.** Validators interpret a signed game transcript under a
   versioned rulebook. Strong appeal architecture, but a real independent issuer
   is not available for the current end-to-end evidence bar.

## Viability probe

Official repository: `a2aproject/a2a-samples`

Pinned commit: `6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3`

Bounded sample cards:

| Card | Skill ID | Description distilled from source |
| --- | --- | --- |
| Air Ticketing Agent | `book_air_tickets` | Books air tickets from stated criteria |
| Hotel Booking Agent | `book_accommodation` | Books hotels from stated criteria |
| Car Rental Agent | `book_cars` | Books car rentals from stated criteria |

Two structured semantic passes with paraphrased requester language preserved
the same critical edges: flight needs matched only `book_air_tickets`; hotel
needs matched only `book_accommodation`; neither matched `book_cars`. Narrative
reasons varied and are therefore excluded from consensus.

This probe proves public-source access and semantic separability only. It is not
GenVM, consensus, Studionet, wallet, settlement, or production evidence.

## Gap statement

Agent discovery protocols describe what agents say they can do. Deterministic
market code can enforce price and capacity. The missing trust boundary is the
semantic compatibility graph between bounded human requests and provider
promises when several parties compete for scarce slots. SkillSlot Clearing puts
that graph under validator consensus and leaves allocation/accounting
deterministic.

## Authoritative sources

- https://docs.genlayer.com/developers/intelligent-contracts/when-to-use-genlayer
- https://docs.genlayer.com/developers/intelligent-contracts/features
- https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- https://github.com/a2aproject/a2a-samples
- https://eips.ethereum.org/EIPS/eip-8004

