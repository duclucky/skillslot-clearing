# Project Explorer Readiness Implementation Plan

**Goal:** Upgrade SkillSlot Clearing from a technically functional marketplace into a polished Project Explorer-ready webapp with first-run explanation, guided reviewer flow, generated provider metadata, explicit wallet selection, account disconnect, listing assets, and fresh verification evidence.

**Architecture:** Keep the existing GenLayer contract, React/Vite frontend, Vercel deployment, Studionet network, and wallet transaction adapter. Add small typed frontend modules for generated metadata, wallet selection UI state, reviewer-step derivation, and Explorer listing copy. Keep writes routed through the existing adapter and keep canonical state reads on the current contract view surface.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, Testing Library, native CSS, GenLayerJS 1.1.8, Viem-compatible EIP-1193 wallets, Vercel static hosting.

## Scope Boundaries

- Do not redeploy the contract unless current metadata constraints are proven incompatible with generated metadata under `/agents/`.
- Do not publish through Sites or create `.openai/hosting.json`.
- Do not fake signatures, gas, balances, transaction status, finality, or canonical state.
- Do not click the final Project Explorer Submit button without explicit action-time authorization.
- Keep browser-wallet evidence distinct from script-signed lifecycle evidence.

## Task 1: Add Project Explorer product framing and reviewer checklist model

**Files:**

- `frontend/src/explorerGuide.ts`
- `frontend/src/explorerGuide.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/styles.css`

**Behavior:**

- Add typed reviewer steps for the public lifecycle.
- Derive step states from workspace snapshot, selected round, connected wallet, and activity state.
- Render an Overview destination that explains product purpose, GenLayer role, live contract status, and full lifecycle checklist.
- Preserve existing Rounds, Create round, and My activity destinations.

**TDD checkpoints:**

1. Write failing tests for disconnected, open-round, cleared/grant, and expired-recovery checklist states.
2. Implement `getExplorerGuide()` until focused tests pass.
3. Add UI tests proving Overview content and checklist render for fresh users.
4. Implement Overview UI and responsive styles.

**Verification:**

- `npm --prefix frontend run test -- explorerGuide.test.ts app.test.tsx`

## Task 2: Add generated provider metadata defaults

**Files:**

- `frontend/src/providerMetadata.ts`
- `frontend/src/providerMetadata.test.ts`
- `frontend/src/Marketplace.tsx`
- `frontend/src/contractAdapter.ts` if the offer input type needs adjustment only
- `frontend/src/styles.css`

**Behavior:**

- Generate deterministic provider metadata JSON from wallet address, agent ID, label, capabilities, description, issuer, policy version, and expiry.
- Compute SHA-256 hash using browser-compatible Web Crypto.
- Populate the default offer flow with generated metadata fields.
- Keep an Advanced metadata disclosure for reviewers who need to inspect or override raw fields.
- Block offer submission with clear inline validation if generated metadata cannot be bound to the connected wallet.

**TDD checkpoints:**

1. Write failing tests for canonical JSON stability, hash computation, and proof generation.
2. Implement metadata generation/hash/proof helpers.
3. Write failing UI tests proving the provider form no longer requires manual hash entry on the default path.
4. Implement generated metadata mode in the provider form.

**Verification:**

- `npm --prefix frontend run test -- providerMetadata.test.ts app.test.tsx contractAdapter.test.ts`

## Task 3: Add explicit wallet-selection modal and account menu

**Files:**

- `frontend/src/wallet.ts`
- `frontend/src/wallet.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/app.test.tsx`
- `frontend/src/styles.css`

**Behavior:**

- The connect button opens a centered detected-wallet modal.
- Writes and permission requests require explicit wallet choice.
- No code path auto-picks the first provider for a new write-capable connection.
- Restored read-only authorization may still use `eth_accounts` without prompting.
- Connected wallet opens an account menu with copy address, explorer link when available, and disconnect.
- Disconnect clears account/provider state and disables write actions until reconnect.

**TDD checkpoints:**

1. Write failing wallet tests proving `connectStudionetWallet()` requires a selected wallet unless restoring an existing session.
2. Implement the wallet API change.
3. Write failing UI tests for wallet modal, wallet choice, no-wallet state, account menu, and disconnect.
4. Implement modal/menu UI and styles.

**Verification:**

- `npm --prefix frontend run test -- wallet.test.ts app.test.tsx`

## Task 4: Polish visual system and listing assets

**Files:**

- `frontend/src/App.tsx`
- `frontend/src/Marketplace.tsx`
- `frontend/src/Activity.tsx`
- `frontend/src/styles.css`
- `frontend/public/skillslot-logo.svg` or `public/skillslot-logo.svg` depending on current Vite public root
- `docs/PROJECT-EXPLORER-LISTING.md`
- `README.md`
- `docs/SUBMISSION.md`
- `docs/README.md` if evidence wording needs alignment

**Behavior:**

- Replace dashboard-like first impression with a polished marketplace/product surface.
- Add public logo asset.
- Add copy-ready Project Explorer listing fields and exact how-to-try steps.
- Update stale CI/evidence references and make README/submission wording internally consistent.
- Maintain accessibility basics: visible focus, labels, helper text, status contrast, 44px targets, reduced-motion safety.

**TDD/checkpoints:**

1. Add UI assertions for logo alt/title, Project Explorer copy, and primary action labels where practical.
2. Apply CSS polish and listing docs.
3. Run static searches for stale CI IDs, pending evidence claims, fake-state terms, and forbidden control files.

**Verification:**

- `npm --prefix frontend run test -- app.test.tsx`
- `rg -n "31883024625|browser-wallet write pending|fake|simulated|AGENTS.md|MASTER-PROMPT" README.md docs/PROJECT-EXPLORER-LISTING.md docs/SUBMISSION.md docs/README.md`

## Task 5: Full local verification, browser QA, Vercel deploy, and push

**Files:**

- `docs/evidence/studionet/project-explorer-browser-qa.json`
- deployment evidence files only if Vercel or Studionet verification produces new public evidence
- repository docs only if exact URLs/run IDs change

**Behavior:**

- Run the full project check.
- Run browser-local frontend verification to prove no browser CORS/read failure on the configured RPC paths.
- Use Chrome/control browser for visible first-run and wallet UX checks.
- Deploy to Vercel, verify production URL, bundle contract address, metadata URL behavior, and browser console.
- Push to GitHub only after public repo hygiene passes.
- Wait for CI and update docs if the successful run ID changes.

**Verification:**

- `npm run check`
- `git rev-parse --show-toplevel`
- `git status --short`
- `git diff --cached --name-only` before any commit
- `git ls-files` allowlist/secrets scan
- local Chrome/browser checklist
- Vercel production HTTP 200 and deployed bundle contract check
- GitHub Actions successful run for pushed commit

## Final acceptance checklist

- [ ] Fresh reviewer can understand the app on first screen.
- [ ] In-product instructions match `docs/PROJECT-EXPLORER-LISTING.md`.
- [ ] Provider metadata is generated by default and inspectable in advanced mode.
- [ ] Wallet connection uses explicit modal selection and supports disconnect.
- [ ] Every write still uses the real wallet and reloads canonical state after finalization.
- [ ] Timeout recovery remains canonical-state gated.
- [ ] README/submission/listing docs match actual contract, deployment, and evidence.
- [ ] `npm run check` passes.
- [ ] Browser QA evidence is updated.
- [ ] Vercel production deployment is verified.
- [ ] Public repo hygiene passes before push.
- [ ] GitHub CI passes after push.
