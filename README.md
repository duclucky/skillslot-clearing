# SkillSlot Clearing

SkillSlot Clearing uses GenLayer validators to clear scarce agent-access slots by meaning, then creates one-time route grants and settles native-GEN credits deterministically.

## Why GenLayer

Providers bond an offer to authenticated agent metadata, a bounded capability set, and a service promise; requesters escrow an exact need, required capabilities, and exclusions. Keyword matching cannot reliably decide whether differently worded offers satisfy those constraints. GenLayer validators independently judge the complete bounded compatibility graph after the contract verifies the provider metadata source. The contract then applies deterministic request order and unit capacity, so no marketplace backend can choose winners or move funds offchain.

The product reserves access. It does **not** certify agent performance, task completion, identity, service quality, or legal obligations.

## Verified status

- Track: GenLayer **Projects**
- Contract: one `SkillSlotClearing` Intelligent Contract with 9 writes and 8 views
- Network: Studionet (`61999`)
- Deployment: `0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`
- Automated checks: 131 currently pass locally (8 static, 44 direct, 5 receipt parser, 7 deployment tooling, 67 frontend)
- Verified Windows CI: [`check` run 31883024625](https://github.com/duclucky/skillslot-clearing/actions/runs/31883024625) passed
- Network lifecycle: the remediation deployment records a script-signed `FINALIZED_LIFECYCLE` with authenticated metadata, consumed grant, 2 GEN received, 2 GEN withdrawn, zero locked or credited liability, and invariant true
- Timeout recovery proof: the remediation deployment records requester-called `recover_expired_round`, terminal `CANCELLED`, 4 GEN cumulative received/withdrawn across proofs, zero locked or credited liability, and invariant true
- Balance proof: a separate 1 GEN deposit/cancel/withdraw flow returned the actor balance from `2010.6399969999999882 GEN` to `2011.6399969999999882 GEN`

## Deployed contract

- Address: [`0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`](https://explorer-studio.genlayer.com/address/0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834)
- Deployment transaction: [`0xeca9750f84152b5c0f0b3b71d7361a50fefe7e6005aa01b14b3281c7cac98962`](https://explorer-studio.genlayer.com/transactions/0xeca9750f84152b5c0f0b3b71d7361a50fefe7e6005aa01b14b3281c7cac98962)
- Sanitized lifecycle evidence: [`docs/evidence/studionet/deployment.json`](docs/evidence/studionet/deployment.json)
- Production browser-wallet evidence: [`docs/evidence/studionet/browser-lifecycle.json`](docs/evidence/studionet/browser-lifecycle.json)

## Live app

[`https://skillslot-clearing.vercel.app`](https://skillslot-clearing.vercel.app) is the verified production deployment. It returned HTTP 200, contained the project title and React root, and loaded the canonical `CLEARED` Studionet round on desktop and mobile browser QA. Production OKX Wallet testing finalized `consume_grant` and `withdraw_credit` through the webapp. The UI retained one transaction hash per action, recovered transient status reads without resubmission, and reloaded canonical grant `CONSUMED`, credit `0 GEN`, and accounting invariant true.

## Product flow

1. A creator opens a bounded round with a fixed 1 GEN booking fee and 1 GEN provider bond.
2. Up to four providers submit offers bound to registry metadata, and up to four requesters submit wallet-authenticated needs.
3. The creator locks the round.
4. Validators independently judge every offer/request pair and agree on critical meaning, not prose wording.
5. The contract deterministically assigns unit-capacity matches, creates route grants, and credits fees/refunds.
6. A matched requester consumes the one-time grant; actors withdraw canonical credits.
7. If evidence or consensus is unavailable, the round becomes non-penalizing `RETRYABLE` with funds still locked until retry or timeout recovery.
8. If the creator stops acting after a deadline, any wallet can call refund-only recovery; provider fees are not released on timeout.

## Architecture

```text
Browser wallet (EIP-6963 / EIP-1193)
  -> React + GenLayerJS adapter
  -> SkillSlotClearing on Studionet
       -> bounded semantic consensus
       -> deterministic matching and accounting
  <- canonical round, position, grant, credit, and invariant views
```

The frontend reconstructs every canonical round, provides permanent Rounds, Create round, and My activity destinations, and exposes all nine legal writes only to the relevant wallet and lifecycle state. It discovers injected wallets, restores authorization with `eth_accounts` without forcing a permission prompt, switches/adds Studionet on an explicit connect action, tracks wallet/submitted/accepted/finalized/failed states, preserves form data across wallet cancellation and uncertain submission, retries only transaction-status and canonical-state reads, never resubmits a known transaction, and reloads canonical contract state only after finalization. Local storage remembers only harmless wallet selection metadata.

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
npm run timeout:studionet   # expired locked round -> permissionless refund-only recovery
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

- The remediation lifecycle and timeout recovery are script-signed Studionet evidence. Production OKX Wallet evidence separately covers finalized grant consumption and credit withdrawal from the earlier browser run, not all nine writes on the remediation deployment.
- Studionet is a hosted development network, not production mainnet.
- External agent routers have not adopted the reusable interface yet.
- Compatibility is bounded to authenticated metadata, the round's submitted statements, and stable fact IDs; the contract does not verify later service performance.

See the [full specification](docs/README.md), [research record](docs/RESEARCH.md), and [design system](design-system/skillslot-clearing/MASTER.md).
