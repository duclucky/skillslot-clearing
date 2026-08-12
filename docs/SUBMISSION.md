# Builders submission packet

## Recommended category

Projects

## Title

SkillSlot Clearing — Validator-Cleared Agent Access

## Notes / description

SkillSlot Clearing is a wallet-enabled GenLayer dApp for capacity-constrained agent access. Providers bond 1 GEN around a natural-language service promise; requesters escrow a 1 GEN booking fee with exact needs, required capability IDs, and exclusions. Validators inspect the complete bounded set of canonical, wallet-authenticated statements and independently decide every compatibility edge. Semantic equivalence compares the normalized pair graph and matched, missing, and prohibited IDs while ignoring prose wording. Deterministic code then applies unit capacity and insertion order, creates one-time route grants, credits matched fees, and refunds unused positions. The reusable 8-write/8-view interface serves A2A routers, MCP marketplaces, and DAO schedulers. One contract, 75 tests, Windows CI, a finalized 3 GEN accounting/balance proof, and a production Vercel app are verified. Browser-wallet writes and external adoption remain pending.

Character count: 948

## Evidence

- Repository: https://github.com/duclucky/skillslot-clearing
- Primary contract explorer: https://explorer-studio.genlayer.com/address/0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86
- Consumer/integration explorer: N/A — one contract owns the complete trust boundary
- Lifecycle evidence: https://github.com/duclucky/skillslot-clearing/blob/main/docs/evidence/studionet/deployment.json
- Successful CI: https://github.com/duclucky/skillslot-clearing/actions/runs/31568488263
- Demo/frontend: https://skillslot-clearing.vercel.app — production canonical read verified; browser-wallet write proof remains pending

## Verified facts

- Contracts: 1 (`SkillSlotClearing`), with 8 public writes and 8 public views
- Tests: 75 passing; 8 static, 39 direct, 5 receipt parser, 7 deployment tooling, 16 frontend
- Network: GenLayer Studionet, chain ID 61999
- Deployment: `0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86`, finalized with successful execution
- Lifecycle: one offer and one opposing request produced a validator-cleared match; the requester consumed the one-time grant; 2 GEN were received and withdrawn with zero locked/credited liability
- Balance proof: a separate 1 GEN offer was safely cancelled and withdrawn; the actor balance moved down exactly 1 GEN and returned exactly 1 GEN

## Honest limitations / pending

- Script-signed authorized wallets prove the full Studionet write lifecycle; a production browser-wallet write has not yet been captured.
- Studionet is a hosted development network, not production mainnet.
- No external A2A router, MCP marketplace, or DAO scheduler has adopted the interface yet.
- The contract reserves access based on submitted meaning; it does not certify later agent performance or fulfillment.

## Why this category

This is a Projects submission because the contribution is a complete wallet-enabled product: contract, real state/value lifecycle, contextual UI, public repository, CI, and production deployment. The frontend is not decorative; it exposes every user-relevant write, tracks finality, and reloads canonical contract state. Browser-wallet write evidence remains labeled pending rather than being substituted by the script lifecycle.
