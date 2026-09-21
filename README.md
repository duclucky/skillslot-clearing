# SkillSlot Clearing

SkillSlot Clearing uses GenLayer validators to clear scarce agent-access slots by meaning, lets a matched requester delegate one exact A2A task, and keeps matched value in delivery escrow until acceptance, validator settlement, or timeout recovery.

## Why GenLayer

Providers bond an offer to authenticated agent metadata, a bounded capability set, and a service promise; requesters escrow an exact need, required capabilities, and exclusions. Keyword matching cannot reliably decide whether differently worded offers satisfy those constraints. GenLayer validators independently judge the complete bounded compatibility graph after the contract verifies the provider metadata source. The contract then applies deterministic request order and unit capacity, so no marketplace backend can choose winners or move funds offchain.

The product reserves access and adjudicates a bounded provider-submitted artifact against the locked promise and need. It does **not** prove external real-world performance, identity, service quality, or legal obligations beyond that evidence boundary.

## Verified status

- Track: GenLayer **Projects**
- Contract: one `SkillSlotClearing` Intelligent Contract with 16 writes and 10 views in the `MS-003` source
- Network: Studionet (`61999`)
- Accepted Project deployment: `0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`
- Milestone `MS-001` deployment: `0x0c43822abD25a0247d0814E7dD501fA19b1C8958`; accepted as Portal contribution `185631`
- Milestone `MS-002` deployment: `0x7eDbD2E1EAc2189ef0Cd4F4f808f179f02138E4b`; accepted on Portal (owner-confirmed; public contribution reference pending capture)
- Milestone `MS-003` deployment: `0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5`; Portal submission not yet sent
- Automated checks: 240 currently pass locally (10 static, 70 direct, 5 receipt parser, 18 deployment tooling, 137 frontend)
- Verified Windows CI: [`check` run 35666807829](https://github.com/duclucky/skillslot-clearing/actions/runs/35666807829) passed on MS-003 evidence commit `741cf12`
- MS-001 dispatch proof: one finalized authorization, two identical HTTP requests returning one deterministic task ID, finalized grant consumption, post-consume HTTP 403, and unchanged GEN accounting during the handoff
- MS-002 executor proof: finalized task and executor authorizations, two signed HTTP requests returning one deterministic task ID, wrong-signer HTTP 401, post-revoke HTTP 403, and unchanged GEN accounting
- MS-001 final accounting: 2 GEN received and withdrawn, zero locked or credited liability, invariant true
- Network lifecycle: the remediation deployment records a script-signed `FINALIZED_LIFECYCLE` with authenticated metadata, consumed grant, 2 GEN received, 2 GEN withdrawn, zero locked or credited liability, and invariant true
- Timeout recovery proof: the remediation deployment records requester-called `recover_expired_round`, terminal `CANCELLED`, 4 GEN cumulative received/withdrawn across proofs, zero locked or credited liability, and invariant true
- Balance proof: a separate 1 GEN deposit/cancel/withdraw flow returned the actor balance from `2010.6399969999999882 GEN` to `2011.6399969999999882 GEN`

## Deployments

- MS-002 address: [`0x7eDbD2E1EAc2189ef0Cd4F4f808f179f02138E4b`](https://explorer-studio.genlayer.com/address/0x7eDbD2E1EAc2189ef0Cd4F4f808f179f02138E4b)
- MS-002 deployment transaction: [`0xc4fc26710d2f9e28f5db83cc3ad48fbc4d42e0d1949f80e10dc897e290f0bbe8`](https://explorer-studio.genlayer.com/transactions/0xc4fc26710d2f9e28f5db83cc3ad48fbc4d42e0d1949f80e10dc897e290f0bbe8)
- MS-002 executor evidence: [`docs/evidence/studionet/ms-002-executor-permit.json`](docs/evidence/studionet/ms-002-executor-permit.json)
- MS-002 production evidence: [`docs/evidence/studionet/ms-002-production.json`](docs/evidence/studionet/ms-002-production.json)
- MS-003 address: [`0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5`](https://explorer-studio.genlayer.com/address/0xFd8C2c655dc3cc1C8270292087B75eD4B80757B5)
- MS-003 deployment transaction: [`0x5759037505eef0d72f995d99c30405784252878e7e45179949298bb10cc98f5b`](https://explorer-studio.genlayer.com/transactions/0x5759037505eef0d72f995d99c30405784252878e7e45179949298bb10cc98f5b)
- MS-003 delivery evidence: [`docs/evidence/studionet/ms-003-delivery-settlement.json`](docs/evidence/studionet/ms-003-delivery-settlement.json)
- Reviewer inventory: [`docs/evidence/studionet/project-explorer-open-rounds.json`](docs/evidence/studionet/project-explorer-open-rounds.json)
- MS-001 address: [`0x0c43822abD25a0247d0814E7dD501fA19b1C8958`](https://explorer-studio.genlayer.com/address/0x0c43822abD25a0247d0814E7dD501fA19b1C8958)
- MS-001 deployment transaction: [`0x9f89f92dffe12e9656e246659150914c9e181a0d92a6d645cc1dd21b17f6f785`](https://explorer-studio.genlayer.com/transactions/0x9f89f92dffe12e9656e246659150914c9e181a0d92a6d645cc1dd21b17f6f785)
- Current sanitized evidence: [`docs/evidence/studionet/deployment.json`](docs/evidence/studionet/deployment.json)
- MS-001 dispatch evidence: [`docs/evidence/studionet/ms-001-a2a-dispatch.json`](docs/evidence/studionet/ms-001-a2a-dispatch.json)
- Production protocol/browser evidence: [`docs/evidence/studionet/ms-001-production.json`](docs/evidence/studionet/ms-001-production.json)
- Accepted Project address: [`0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834`](https://explorer-studio.genlayer.com/address/0x90555BCDbC68a6833Fb98aC215b1Cbb1919C8834)
- Accepted production browser-wallet evidence: [`docs/evidence/studionet/browser-lifecycle.json`](docs/evidence/studionet/browser-lifecycle.json)

## Live app

[`https://skillslot-clearing.vercel.app`](https://skillslot-clearing.vercel.app) is the verified production deployment. It returned HTTP 200, contained the project title and React root, and loaded the canonical `CLEARED` Studionet round on desktop and mobile browser QA. Production OKX Wallet testing finalized `consume_grant` and `withdraw_credit` through the webapp. The UI retained one transaction hash per action, recovered transient status reads without resubmission, and reloaded canonical grant `CONSUMED`, credit `0 GEN`, and accounting invariant true.

The public URL above is configured for the current milestone deployment and exposes the fixed-origin A2A reference interface at
`POST /a2a/v1/message:send` and a discovery-only Agent Card at
`GET /.well-known/agent-card.json`. The send endpoint requires the advertised delegated-executor extension, a valid EIP-191 executor signature, and the exact current onchain executor, epoch, expiry, and task digest.

## Product flow

1. A creator opens a bounded round with a fixed 1 GEN booking fee and 1 GEN provider bond.
2. Up to four providers submit offers bound to registry metadata, and up to four requesters submit wallet-authenticated needs.
3. The creator locks the round.
4. Validators independently judge every offer/request pair and agree on critical meaning, not prose wording.
5. The contract deterministically assigns unit-capacity matches, creates route grants, refunds unmatched positions, and keeps each matched fee plus bond in delivery escrow.
6. A matched requester may canonicalize one bounded A2A request and finalize
   `authorize_dispatch(round_id, request_id, task_digest)`.
7. The requester authorizes a separate EOA executor for at most seven days and exports the public execution package.
8. The executor imports the package, signs the domain-separated EIP-191 message, and sends the exact request to the fixed SkillSlot endpoint.
9. The endpoint verifies the signature and calls `can_execute_dispatch`; an exact active permit returns a deterministic `TASK_STATE_SUBMITTED` receipt, while wrong signers, stale epochs, expiry, and revocation fail closed.
10. The matched provider submits a bounded delivery artifact. The requester may accept it directly, or any wallet may request GenLayer validator review.
11. `FULFILLED` pays the provider the fee and returned bond; `FAILED` pays both to the requester; `UNVERIFIABLE` moves no value and remains retryable.
12. After the delivery recovery deadline, any wallet can close unresolved escrow: no artifact returns fee and bond to the requester; an unresolved artifact refunds the fee and returns the bond without penalty.
13. The requester can revoke the executor or consume the one-time grant; later dispatch attempts fail and actors withdraw canonical credits.
14. If clearing evidence is unavailable, the round becomes non-penalizing `RETRYABLE`; if the creator stops before clearing, any wallet can trigger refund-only round recovery.

## Architecture

```text
Browser wallet (EIP-6963 / EIP-1193)
  -> React + GenLayerJS adapter
  -> SkillSlotClearing on Studionet
       -> bounded semantic consensus
       -> deterministic matching and accounting
       -> requester-bound A2A task digest
       -> requester-controlled executor address, epoch, expiry, and revocation
       -> bounded delivery artifact, validator judgment, and deterministic escrow settlement
  <- canonical round, position, grant, dispatch, executor, delivery, credit, and invariant views
  -> fixed same-origin A2A reference endpoint
       -> EIP-191 signer recovery + canonical can_execute_dispatch read
       -> deterministic submitted-task receipt
```

The frontend reconstructs every canonical round, opens with a Project Explorer-ready mechanism explainer, provides Rounds, Create round, and My activity destinations once a visitor enters the operational workspace, and exposes legal writes only to the relevant wallet and lifecycle state. It discovers injected wallets, requires the user to choose a wallet from a centered selection modal, restores authorization with `eth_accounts` without forcing a permission prompt, switches/adds Studionet on an explicit connect action, and provides an account menu with disconnect. Canonical reads route through a same-origin Studionet RPC proxy while wallet transaction writes stay on the selected wallet provider. Provider offers default to generated metadata mode: the app prepares the authorized `/agents/` URI, SHA-256 body hash, registry issuer, registry proof, and expiry before calling `submit_offer`. Transaction handling tracks wallet/submitted/accepted/finalized/failed states, preserves form data across wallet cancellation and uncertain submission, retries only transaction-status and canonical-state reads, never resubmits a known transaction, and reloads canonical contract state only after finalization. Local storage remembers only harmless wallet selection metadata.

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
npm run dispatch:studionet  # authorize -> repeated A2A receipt -> consume -> reject
npm run executor:studionet  # delegated signer -> retry identity -> wrong signer -> revoke
npm run delivery:studionet  # artifact -> requester acceptance -> exact 2 GEN payout -> withdrawal
npm run seed:studionet      # maintain six OPEN Project Explorer reviewer rounds
```

The demo uses exactly 1 GEN for each value-bearing position and stops at `RETRYABLE` instead of blindly repeating nondeterministic adjudication.

## Repository map

- `contracts/skill_slot_clearing.py` — canonical GenVM state machine and semantic consensus
- `tests/direct/` — state, adversarial, authorization, recovery, and accounting tests
- `frontend/` — wallet-enabled React/Vite product
- `scripts/deploy_studionet.mjs` — idempotent deployment and lifecycle evidence tooling
- `docs/milestones/MS-001/README.md` — accepted-baseline delta, gates, safety card, and evidence plan
- `docs/milestones/MS-002/README.md` — delegated-executor delta, gates, safety card, and evidence index
- `docs/milestones/MS-003/README.md` — delivery-escrow delta, evidence authority, recovery matrix, and exit gates
- `docs/MILESTONE-SUBMISSION-MS-001.md` — copy-ready Portal Milestones packet and evidence index
- `docs/PROJECT-EXPLORER-LISTING.md` — copy-ready Project Explorer listing and reviewer steps
- `docs/README.md` — specification, safety cards, threat model, and claim-to-code matrix
- `docs/evidence/studionet/` — sanitized network evidence only

## Honest limitations

- The remediation lifecycle and timeout recovery are script-signed Studionet evidence. Production OKX Wallet evidence separately covers finalized grant consumption and credit withdrawal from the earlier browser run, not all nine writes on the remediation deployment.
- Studionet is a hosted development network, not production mainnet.
- External agent routers have not adopted the reusable interface yet.
- The reference Agent Card is unsigned and discovery-only. It cannot authorize a hard consequence.
- A `TASK_STATE_SUBMITTED` receipt proves only that the bounded handoff was accepted. MS-003 settlement depends on a separately submitted bounded artifact and never upgrades the receipt itself into proof of completion.
- Delivery adjudication is bounded to authenticated marketplace state and the provider-submitted artifact; it does not independently observe or prove offchain real-world performance.

See the [full specification](docs/README.md), [research record](docs/RESEARCH.md), and [design system](design-system/skillslot-clearing/MASTER.md).
