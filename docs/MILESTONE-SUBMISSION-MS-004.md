# MS-004 Portal submission packet

## Title

MS-004: Contestable Delivery Reputation

## Changes & Improvements

SkillSlot adds contestable onchain reputation to settled deliveries without changing payouts. The matched requester publishes one bounded 1–5 review; the provider may challenge before an exact deadline. GenLayer validators compare the locked offer, request, delivery outcome, review evidence, and provider response to uphold, overturn, or mark the dispute unverifiable. Unchallenged reviews finalize permissionlessly; unresolved challenges become void at timeout. Only finalized scores count in the provider aggregate. My Activity exposes role/state actions and canonical status. Studionet evidence includes a two-wallet script lifecycle and same-wallet Chrome/OKX QA with user-signed validator resolution, both finalized with unchanged GEN accounting. All 263 checks and the build pass; negative tests cover overturn, retry, deadlines, authorization, replay, and aggregate exclusion. Browser QA is controlled test data, not external adoption or verified real-world service performance.

## Evidence & Supporting Information

1. Complete MS-004 implementation and evidence diff

   https://github.com/duclucky/skillslot-clearing/compare/741cf12ebd1c16329f7b4c74bade83b61374063a...8af4e497b99538da0cee4ec997d4b6a37384a602

   The start is the accepted MS-003 evidence head; the end pins implementation and finalized browser evidence. The MS-004 working base was `305d615eac38a0e92f17a618a374ff025c1905f3`; acceptance reconciliation between those references is context, not a new capability claim. The layout repair is supporting maintenance, not a separate Milestone.

2. MS-004 dossier

   https://github.com/duclucky/skillslot-clearing/blob/main/docs/milestones/MS-004/README.md

3. Studionet contract

   https://explorer-studio.genlayer.com/address/0x1C282781D79Def68E4eea7895e2F427C2dA18F35

4. Deployment transaction

   https://explorer-studio.genlayer.com/transactions/0x8ebca1b07ad4b1e282d25fdedd8b16402262ddc2394e5299fb58daa1f084cd1f

5. Requester review transaction

   https://explorer-studio.genlayer.com/transactions/0x21fa82a20ea595d7b318e93cc60b0e110da441dce7b224d82c8a37c66fd6d637

6. Provider challenge transaction

   https://explorer-studio.genlayer.com/transactions/0x36fb4db86f5fa45d45fa529b7d163ca7c1c4b35861bd8e1c4433efc33cd2bdc3

7. Validator resolution transaction

   https://explorer-studio.genlayer.com/transactions/0xf1d563d8bf0787cce4bc35e3ae4fa96596e0303a60eaf965ddfe426d0bb64e8c

8. Sanitized reputation lifecycle evidence

   https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/ms-004-contestable-reputation.json

9. Production browser evidence

   https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/ms-004-production.json

10. Historical seed-round creation snapshot (six were initially open)

    https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/project-explorer-open-rounds.json

11. Live application

    https://skillslot-clearing.vercel.app

12. Successful public CI

    https://github.com/duclucky/skillslot-clearing/actions/runs/37246525602

13. Current browser-wallet lifecycle, layout, and round inventory

    https://github.com/duclucky/skillslot-clearing/blob/8af4e497b99538da0cee4ec997d4b6a37384a602/docs/evidence/studionet/ms-004-browser-lifecycle.json

14. Browser validator resolution transaction

    https://explorer-studio.genlayer.com/transactions/0x4e493059dd8bfcd93b8cf0e50ce309951fa621750550a3f0b8017d93d307867b

## Reviewer verification

1. Open the live app and select **Browse rounds**. At the latest inventory read, five seeded rounds were `OPEN` and two rounds were `CLEARED`; these are timestamped observations, not permanent counts.
2. Inspect the `CLEARED` history round `slot-muu45fa1`, then open evidence links 5–8 to verify the original two-wallet reputation lifecycle: `FINALIZED`, one counted review, score total five, average `5000`, and identical 2 GEN received/withdrawn accounting snapshots. Those figures belong to that historical run, not today's global totals.
3. For a new write-through reproduction, connect a funded Studionet wallet and create your own uniquely named round. Its creator controls normal lock/clear actions; joining a seeded round does not grant creator privileges. Submit a compatible authenticated provider offer (1 GEN bond) and requester position (1 GEN fee), lock and clear as creator, submit a bounded delivery as provider, then accept as requester. Use two wallets for independent roles; same-wallet execution is only controlled QA.
4. In **My activity**, the matched requester publishes a 1–5 review with bounded evidence; the provider challenges it before the displayed deadline. Request reputation resolution, sign the wallet request, and wait for canonical reload. Read the exact verdict and aggregate: `FINALIZED` scores count, `OVERTURNED` and `VOID` scores do not. `RETRYABLE` is not completion; retry before recovery or recover after the exact boundary. Reputation writes must leave the already-settled GEN accounting unchanged.
5. Inspect the test suite for local negative branches: overturn excludes the score, unverifiable remains retryable, timeout becomes void, deadline equality is enforced, wrong actors and replay reject, and no reputation write moves GEN.

## Scope boundary

The requester review and provider response are authenticated as statements by those matched wallets and judged only against the bounded canonical SkillSlot record. This milestone does not claim an external performance oracle, portable credential, cross-project reputation, Sybil-resistant ranking, mainnet deployment, external adoption, or a second-level appeal.

The additional browser run is explicitly controlled same-wallet QA. Its validator verdict is `FINALIZED`; the provider aggregate rose from one to two counted reviews, score total from five to ten, average remained `5000`. The global accounting stayed unchanged across resolution: 4 GEN received, 0 locked, 2 GEN withdrawable credit, 2 GEN previously withdrawn. The available 2 GEN credit is not represented as a completed withdrawal.
