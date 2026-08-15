# Builders submission packet

## Recommended category

Projects

## Title

SkillSlot Clearing - Validator-Cleared Agent Access

## Notes / description

SkillSlot Clearing is a wallet-enabled GenLayer marketplace for capacity-constrained agent access. Providers bond 1 GEN around an offer bound to authenticated agent metadata; requesters escrow a 1 GEN booking fee with exact needs, capability IDs, and exclusions. Validators inspect the bounded canonical set and independently decide every compatibility edge only after deterministic metadata checks pass. Semantic equivalence compares the normalized pair graph while deterministic code applies unit capacity and insertion order, creates one-time route grants, credits matched fees, refunds unused positions, and lets any wallet recover expired locked funds without releasing provider fees.

Character count: 689

## Evidence

- Repository: https://github.com/duclucky/skillslot-clearing
- Primary contract explorer: https://explorer-studio.genlayer.com/address/0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834
- Consumer/integration explorer: N/A — one contract owns the complete trust boundary
- Lifecycle evidence: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/deployment.json
- Browser-wallet evidence: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/browser-lifecycle.json
- Successful CI: PENDING_AFTER_REMEDIATION_PUSH
- Demo/frontend: https://skillslot-clearing.vercel.app

## Verified facts

- Contracts: 1 (`SkillSlotClearing`), with 9 public writes and 8 public views
- Automated checks: 131 passing locally after remediation; 8 static, 44 direct, 5 receipt parser, 7 deployment tooling, 67 frontend
- Network: GenLayer Studionet, chain ID 61999
- Deployment: `0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`, transaction `0xeca9750f84152b5c0f0b3b71d7361a50fefe7e6005aa01b14b3281c7cac98962`
- Lifecycle: `FINALIZED_LIFECYCLE` with authenticated metadata, consumed grant, zero locked liability, zero credited liability, and invariant true
- Timeout recovery: `FINALIZED_TIMEOUT_RECOVERY`; requester called `recover_expired_round` after expiry, round ended `CANCELLED`, zero locked liability, zero credited liability, and invariant true
- Balance proof: a separate 1 GEN offer was safely cancelled and withdrawn; the actor balance moved down exactly 1 GEN and returned exactly 1 GEN
- Browser proof: production OKX Wallet finalized `consume_grant` and `withdraw_credit`; the app retained one hash per action, recovered transient status reads without resubmission, then reloaded canonical grant `CONSUMED` and credit `0 GEN`

## Honest limitations / pending

- The remediation lifecycle and timeout recovery are script-signed Studionet evidence; production browser-wallet evidence covers grant consumption and withdrawal from the earlier browser run, not all nine writes on the remediation deployment.
- Studionet is a hosted development network, not production mainnet.
- No external A2A router, MCP marketplace, or DAO scheduler has adopted the interface yet.
- The contract reserves access based on submitted meaning; it does not certify later agent performance or fulfillment.

## Why this category

This is a Projects submission because the contribution is a complete wallet-enabled product: contract, real state/value lifecycle, contextual UI, public repository, CI, and production deployment. The frontend is not decorative; it exposes every user-relevant write, tracks finality, recovers transient reads without replaying writes, and reloads canonical contract state. Script-signed and production browser-wallet evidence remain explicitly separate.
