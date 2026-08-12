# Builders submission packet

## Recommended category

Projects

## Title

SkillSlot Clearing - Validator-Cleared Agent Access

## Notes / description

SkillSlot Clearing is a wallet-enabled GenLayer marketplace for capacity-constrained agent access. Providers bond 1 GEN around a natural-language service promise; requesters escrow a 1 GEN booking fee with exact needs, capability IDs, and exclusions. Validators inspect the complete bounded set of canonical, wallet-authenticated statements and independently decide every compatibility edge. Semantic equivalence compares the normalized pair graph while deterministic code applies unit capacity and insertion order, creates one-time route grants, credits matched fees, and refunds unused positions. Its reusable 8-write/8-view contract serves A2A routers, MCP marketplaces, and DAO schedulers. Verified evidence includes one deployed contract, 124 automated checks, Windows CI, 5 GEN received/withdrawn with zero liabilities, and production OKX-wallet consume/withdraw flows. Limits: Studionet only; access is reserved, not service performance; external adoption is not yet proven.

Character count: 981

## Evidence

- Repository: https://github.com/duclucky/skillslot-clearing
- Primary contract explorer: https://explorer-studio.genlayer.com/address/0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86
- Consumer/integration explorer: N/A — one contract owns the complete trust boundary
- Lifecycle evidence: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/deployment.json
- Browser-wallet evidence: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/browser-lifecycle.json
- Successful CI: https://github.com/duclucky/skillslot-clearing/actions/runs/31603299326
- Demo/frontend: https://skillslot-clearing.vercel.app - production canonical reads plus finalized OKX-wallet consume and withdrawal verified

## Verified facts

- Contracts: 1 (`SkillSlotClearing`), with 8 public writes and 8 public views
- Automated checks: 124 passing; 8 static, 39 direct, 5 receipt parser, 7 deployment tooling, 65 frontend
- Network: GenLayer Studionet, chain ID 61999
- Deployment: `0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86`, finalized with successful execution
- Lifecycle: one offer and one opposing request produced a validator-cleared match; the requester consumed the one-time grant; aggregate canonical accounting now proves 5 GEN received and withdrawn with zero locked/credited liability
- Balance proof: a separate 1 GEN offer was safely cancelled and withdrawn; the actor balance moved down exactly 1 GEN and returned exactly 1 GEN
- Browser proof: production OKX Wallet finalized `consume_grant` and `withdraw_credit`; the app retained one hash per action, recovered transient status reads without resubmission, then reloaded canonical grant `CONSUMED` and credit `0 GEN`

## Honest limitations / pending

- Script-signed authorized wallets prove the full Studionet lifecycle; production browser-wallet evidence separately proves `consume_grant` and `withdraw_credit`, not all eight writes.
- Studionet is a hosted development network, not production mainnet.
- No external A2A router, MCP marketplace, or DAO scheduler has adopted the interface yet.
- The contract reserves access based on submitted meaning; it does not certify later agent performance or fulfillment.

## Why this category

This is a Projects submission because the contribution is a complete wallet-enabled product: contract, real state/value lifecycle, contextual UI, public repository, CI, and production deployment. The frontend is not decorative; it exposes every user-relevant write, tracks finality, recovers transient reads without replaying writes, and reloads canonical contract state. Script-signed and production browser-wallet evidence remain explicitly separate.
