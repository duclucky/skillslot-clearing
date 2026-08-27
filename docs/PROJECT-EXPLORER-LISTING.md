# Project Explorer Listing

## Name

SkillSlot Clearing

## Category

Marketplace / Agent Economy

## Logo

`frontend/public/skillslot-logo.svg`

## One-liner

GenLayer clears scarce agent-access slots by meaning, then settles route grants, refunds, and GEN credits onchain.

## Short description

SkillSlot Clearing is a wallet-enabled GenLayer marketplace for capacity-constrained AI agents. Providers bond 1 GEN to offers backed by authenticated agent metadata. Requesters escrow 1 GEN with exact access needs, required capability IDs, and exclusions. GenLayer validators inspect the bounded offer/request graph and decide semantic compatibility; deterministic contract code then creates one-time route grants, credits matched provider fees, refunds unmatched deposits, and lets any wallet recover expired locked funds without paying provider fees.

Use it when keyword matching is too weak for access allocation: the product needs validator-controlled semantic judgment, deterministic capacity assignment, and onchain accounting that a marketplace backend cannot rewrite.

## Status

Preview on GenLayer Studionet.

## Website

https://skillslot-clearing.vercel.app

## Repository

https://github.com/duclucky/skillslot-clearing

## Contract link

https://explorer-studio.genlayer.com/address/0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834

## How to try it

Prerequisites: use a Studionet-compatible EVM wallet with test GEN. For the full lifecycle, use two wallets or two accounts: one creator/provider wallet and one requester wallet. The app never simulates balances, fees, signatures, transactions, or finality.

1. Open https://skillslot-clearing.vercel.app.
2. Read the Overview mechanism explainer to understand how provider offers, requester escrow, validator clearing, and settlement fit together.
3. Click Connect wallet and choose a detected wallet from the modal. The app will switch/add GenLayer Studionet before writes.
4. Open Rounds and choose one of the pre-created `Project Explorer ...` rounds under Open now. These are intentionally left open for reviewers and fresh users.
5. Submit a provider offer from the creator/provider wallet. Use the default generated metadata mode; enter an offer ID, label, access promise, capability IDs such as `FLIGHT.BOOK,CALENDAR.WRITE`, and an agent ID. The app generates the authorized metadata URI, hash, issuer, signature, and expiry.
6. Connect the requester wallet, select the same open round, and submit a request with a matching need and overlapping required capability IDs.
7. Reconnect the creator/provider wallet, select the round, and lock it.
8. Click Clear round semantically. GenLayer validators review the bounded graph; after finality, the app reloads canonical round, match, grant, credit, and accounting views.
9. Reconnect the requester wallet, open My activity, and consume the active grant.
10. Reconnect any wallet with credited GEN and withdraw the available credit.
11. Optional creator path: open Create round and create a new round with a stable round ID and title.
12. Optional recovery test: create a round and let it expire in an uncleared state; then any wallet can call Recover expired round to refund locked deposits without releasing provider fees.

## What reviewers should verify

- The first screen explains what the product does and why GenLayer is required.
- Wallet connection uses an explicit wallet-selection modal; the app does not auto-pick the first provider.
- Provider offers are bound to authenticated metadata before semantic clearing.
- Writes require real wallet signatures and show wallet/submitted/accepted/finalized/failed states.
- Canonical state reloads after finalization.
- Timeout recovery is visible only when the selected round is expired and recoverable.
- The contract explorer link opens the active Studionet deployment.

## Honest limits

- Studio-only deployments appear as Preview, not Live.
- The contract reserves route access; it does not certify that an external agent later performs the service.
- Existing evidence includes script-signed full lifecycle and separate production browser-wallet actions. Fresh Project Explorer QA should follow the how-to steps above after each production redeploy.
- No external router or marketplace has adopted the grant interface yet.
