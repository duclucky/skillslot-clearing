# SkillSlot Clearing

SkillSlot Clearing uses GenLayer validators to clear scarce agent-access slots by meaning, then creates one-time route grants and settles native-GEN credits deterministically.

## Why GenLayer

Providers describe what an agent promises to do; requesters describe an exact need, required capabilities, and exclusions. Keyword matching cannot reliably decide whether differently worded promises satisfy those constraints. GenLayer validators independently judge the complete bounded compatibility graph. The contract then applies deterministic request order and unit capacity, so no marketplace backend can choose winners or move funds offchain.

The product reserves access. It does **not** certify agent performance, task completion, identity, service quality, or legal obligations.

## Verified status

- Track: GenLayer **Projects**
- Contract: one `SkillSlotClearing` Intelligent Contract with 8 writes and 8 views
- Network: Studionet (`61999`)
- Deployment: `0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86`
- Automated checks: 83 tests currently pass locally (8 static, 39 direct, 5 receipt parser, 7 deployment tooling, 24 frontend)
- Current Windows CI: [`check` run 31568488263](https://github.com/duclucky/skillslot-clearing/actions/runs/31568488263) passed
- Network lifecycle: `FINALIZED_LIFECYCLE`; one semantic match, consumed grant, 2 GEN received and 2 GEN withdrawn, zero remaining liabilities
- Balance proof: a separate 1 GEN deposit/cancel/withdraw flow returned the actor balance from `2010.6399969999999882 GEN` to `2011.6399969999999882 GEN`

## Deployed contract

- Address: [`0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86`](https://explorer-studio.genlayer.com/address/0x9aeebe7B3e1318D4ca2eBD38fB714b84976fdA86)
- Deployment transaction: [`0x4696f8c362979c1733a84fbdf0659b6b149406cd00fd2338478b5f314d81e851`](https://explorer-studio.genlayer.com/transactions/0x4696f8c362979c1733a84fbdf0659b6b149406cd00fd2338478b5f314d81e851)
- Sanitized lifecycle evidence: [`docs/evidence/studionet/deployment.json`](docs/evidence/studionet/deployment.json)

## Live app

[`https://skillslot-clearing.vercel.app`](https://skillslot-clearing.vercel.app) is the verified production deployment. It returned HTTP 200, contained the project title and React root, and loaded the canonical `CLEARED` Studionet round on desktop and mobile browser QA.

## Product flow

1. A creator opens a bounded round with a fixed 1 GEN booking fee and 1 GEN provider bond.
2. Up to four providers and four requesters submit wallet-authenticated positions.
3. The creator locks the round.
4. Validators independently judge every offer/request pair and agree on critical meaning, not prose wording.
5. The contract deterministically assigns unit-capacity matches, creates route grants, and credits fees/refunds.
6. A matched requester consumes the one-time grant; actors withdraw canonical credits.
7. If evidence or consensus is unavailable, the round becomes non-penalizing `RETRYABLE` with funds still locked.

## Architecture

```text
Browser wallet (EIP-6963 / EIP-1193)
  -> React + GenLayerJS adapter
  -> SkillSlotClearing on Studionet
       -> bounded semantic consensus
       -> deterministic matching and accounting
  <- canonical round, position, grant, credit, and invariant views
```

The frontend reconstructs every canonical round, provides permanent Rounds, Create round, and My activity destinations, and exposes all eight legal writes only to the relevant wallet and lifecycle state. It discovers injected wallets, restores authorization with `eth_accounts` without forcing a permission prompt, switches/adds Studionet on an explicit connect action, tracks wallet/submitted/accepted/finalized/failed states, preserves form data for transaction retry, and reloads canonical contract state only after finalization. Local storage remembers only harmless wallet selection metadata.

## Run locally

Requirements: Windows, Python 3.12, Node.js, and `uv`.

```powershell
uv venv --python 3.12.13 .venv
uv pip install --python .\.venv\Scripts\python.exe -r requirements-dev.txt
npm install
npm --prefix frontend install
npm run check
Copy-Item frontend\.env.example frontend\.env
npm run dev
```

`frontend/.env` contains only the public `VITE_CONTRACT_ADDRESS`; never place wallet keys in a `VITE_*` variable.

## Studionet deployment and recovery

The script loads ignored configuration from the project `.env`, then the authorized parent `.env`, without printing secrets. It uses two distinct wallets for the consequential demo, projects receipt output through a safe allowlist, backs off when Studionet returns its rate-limit window, and recovers canonical state rather than replaying finalized writes.

```powershell
npm run inspect:studionet   # read-only
npm run deploy:studionet    # exact contract/API revision; resumable
npm run demo:studionet      # semantic match -> grant -> withdrawal
npm run balance:studionet   # deposit -> cancel -> withdraw balance proof
```

The demo uses exactly 1 GEN for each value-bearing position and stops at `RETRYABLE` instead of blindly repeating nondeterministic adjudication.

## Repository map

- `contracts/skill_slot_clearing.py` — canonical GenVM state machine and semantic consensus
- `tests/direct/` — state, adversarial, authorization, recovery, and accounting tests
- `frontend/` — wallet-enabled React/Vite product
- `scripts/deploy_studionet.mjs` — idempotent deployment and lifecycle evidence tooling
- `docs/README.md` — specification, safety cards, threat model, and claim-to-code matrix
- `docs/evidence/studionet/` — sanitized network evidence only

## Honest limitations

- The finalized lifecycle was executed with script-signed authorized wallets; production browser-wallet write evidence remains pending and is not substituted by the script.
- Studionet is a hosted development network, not production mainnet.
- External agent routers have not adopted the reusable interface yet.
- Compatibility is bounded to the round's submitted statements and stable fact IDs; the contract does not verify later service performance.

See the [full specification](docs/README.md), [research record](docs/RESEARCH.md), and [design system](design-system/skillslot-clearing/MASTER.md).
