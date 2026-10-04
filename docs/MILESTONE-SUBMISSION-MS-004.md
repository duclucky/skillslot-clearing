# MS-004 Portal submission packet

## Title

MS-004: Contestable Delivery Reputation

## Changes & Improvements

SkillSlot now turns one terminal delivery into a contestable onchain reputation record without changing its settled payout. The matched requester can publish one bounded 1–5 review; the matched provider can challenge it before an exact deadline. GenLayer validators independently compare the locked offer, request, delivery outcome, review evidence, and provider response, then uphold, overturn, or mark the dispute unverifiable. Unchallenged reviews finalize permissionlessly, while unresolved challenges become void after a recovery deadline so no actor can strand the record. Only finalized scores enter the provider aggregate; overturned and void scores are excluded. The app exposes role/state actions in My Activity. Studionet evidence proves submit, challenge, validator resolution, a finalized 5/5 aggregate, and identical GEN accounting before and after all reputation writes. Local tests cover overturn, retry, deadline equality, authorization, replay, and aggregate exclusion.

## Evidence & Supporting Information

1. Complete MS-004 implementation and evidence diff

   https://github.com/duclucky/skillslot-clearing/compare/305d615eac38a0e92f17a618a374ff025c1905f3...79918f09b5601b16e078be24c52dbf1cfba415c2

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

10. Six open reviewer rounds

    https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/project-explorer-open-rounds.json

11. Live application

    https://skillslot-clearing.vercel.app

12. Successful public CI

    https://github.com/duclucky/skillslot-clearing/actions/runs/37223282038

## Reviewer verification

1. Open the live app, select **Browse rounds**, and confirm **Open now 6** plus the `CLEARED` history round `slot-muu45fa1`.
2. Connect a Studionet wallet and join any `explorer-1c282781-*` round as provider or requester using the fixed 1 GEN position value.
3. In **My activity**, inspect the role/state reputation section after a terminal matched delivery: requester review, provider challenge, permissionless resolution/finalization/recovery, canonical deadlines, and explicit status are exposed only when legal.
4. Open the sanitized evidence and explorer transactions. Confirm reputation `FINALIZED`, `review_count = 1`, `score_total = 5`, `average_milli = 5000`, and unchanged accounting: 2 GEN received/withdrawn, zero locked/credited liability, invariant true.
5. Inspect the test suite for local negative branches: overturn excludes the score, unverifiable remains retryable, timeout becomes void, deadline equality is enforced, wrong actors and replay reject, and no reputation write moves GEN.

## Scope boundary

The requester review and provider response are authenticated as statements by those matched wallets and judged only against the bounded canonical SkillSlot record. This milestone does not claim an external performance oracle, portable credential, cross-project reputation, Sybil-resistant ranking, mainnet deployment, external adoption, or a second-level appeal.
