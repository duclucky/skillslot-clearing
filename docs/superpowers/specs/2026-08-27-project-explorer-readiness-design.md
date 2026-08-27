# Project Explorer Readiness Design

Date: 2026-08-27

## Goal

Make SkillSlot Clearing ready for a GenLayer Project Explorer listing as a complete product experience that a fresh reviewer can understand, try, and verify end to end from the public webapp.

This is a Projects-track upgrade. The contract remains the load-bearing contribution: providers bond offers to authenticated agent metadata, requesters escrow needs, GenLayer validators clear semantic compatibility, and deterministic contract code settles grants, refunds, credits, withdrawals, and timeout recovery.

## Current state

SkillSlot Clearing already has the core pieces needed for eligibility:

- accepted Projects contribution context;
- public GitHub repository;
- Vercel production app;
- deployed Studionet contract;
- authenticated provider metadata requirement;
- permissionless timeout recovery;
- local check workflow and successful GitHub Actions evidence;
- existing production browser evidence for selected wallet writes.

The current product is functional but not yet strong enough for a public discovery surface. A reviewer can technically test it, but too much project knowledge is required before the first useful action.

## Project Explorer gaps to close

1. The landing view does not immediately explain what the product does, who it is for, why GenLayer is needed, and what a reviewer should try.
2. The provider offer form exposes raw metadata fields that require manual hash, issuer, signature, and URI knowledge.
3. Wallet connection discovers providers internally, but the primary UI still behaves like a single connect button instead of an explicit centered wallet-selection modal.
4. Connected wallet state lacks a clear account menu with disconnect/logout.
5. The visual system is serviceable but not polished enough for a public catalog card and first-run experience.
6. There is no dedicated copy-ready Project Explorer listing document with name, category, one-liner, description, exact test steps, contract link, website, repository, and status.
7. README and submission docs contain stale CI references and mixed evidence wording that can make review harder.
8. Browser evidence must prove the reviewer path from public instructions, not only isolated prior wallet actions.

## UX direction

Use a trust-first product experience, not a generic dashboard.

The app should answer these questions above the fold:

- What is this? A GenLayer clearing market for matching scarce agent capacity to authenticated user needs.
- Who uses it? Agent providers, requesters, and reviewers testing a complete GenLayer flow.
- Why GenLayer? Compatibility cannot be safely reduced to keyword matching; validators inspect bounded offers, needs, capability IDs, and exclusions before deterministic settlement.
- What should I do now? Connect a Studionet wallet, open or select a round, submit an authenticated offer or paid request, clear, consume a grant, and withdraw credit.

The main navigation should stay simple:

- Overview: product explanation, live contract status, and reviewer checklist.
- Rounds: canonical round browser and lifecycle actions.
- Create round: self-service creator flow.
- My activity: wallet-scoped offers, requests, grants, and withdrawable credits.

The Overview can be implemented inside the current app shell without changing the route architecture.

## Guided reviewer flow

Add a persistent "Try the full lifecycle" panel that turns Project Explorer instructions into product UI.

Recommended steps:

1. Connect wallet and verify Studionet network.
2. Create or select an open round.
3. Submit a provider offer using generated authenticated metadata.
4. Submit a requester need with matching capability IDs.
5. Lock the round.
6. Clear semantic matches.
7. Consume an active grant as the requester.
8. Withdraw credited GEN.
9. If a round expires before clearing, use permissionless refund recovery.

Each step should show:

- required role;
- expected onchain action;
- where the control lives;
- current canonical readiness state;
- whether it is done, blocked, available, or not applicable.

This panel must be honest. If the current wallet cannot perform a step, it should explain which wallet/role is needed rather than hiding the requirement.

## Provider metadata simplification

The provider flow should default to a "Generated metadata" mode.

The frontend should generate a deterministic metadata document from reviewer-friendly fields:

- provider wallet address;
- agent ID;
- display name;
- capability IDs;
- short capability description;
- issuer;
- policy version;
- expiry timestamp.

The app should expose the metadata through the existing authorized origin:

`https://skillslot-clearing.vercel.app/agents/...`

The existing contract allows this origin, so no contract redeploy is expected if the generated URI remains under `/agents/` and the contract already accepts the issuer/proof format.

The UI should calculate and populate:

- metadata URI;
- SHA-256 body hash;
- issuer;
- metadata proof/signature;
- expiry.

An "Advanced metadata" disclosure may remain for power users and reviewers, but the default submission path should not require manual hash calculation.

If dynamic metadata cannot be implemented within Vercel's static constraints, the fallback is a curated list of public demo agent metadata records that the app can select automatically. That fallback is acceptable only if the selected record is clearly bound to the connected provider address or the flow honestly states which provider wallet can use it.

## Wallet UX

The app must not auto-pick the first injected wallet for a write-capable connection.

Required behavior:

- The top-bar connect action opens a centered modal.
- The modal lists detected EIP-6963 wallets and injected-provider fallbacks.
- The user chooses one wallet explicitly.
- If no wallet is detected, the modal explains that a Studionet-compatible EVM wallet is required.
- After selection, the app requests accounts and switches/adds the official Studionet EVM-compatible chain.
- The connected account display opens a menu.
- The account menu includes copy address, view explorer link when available, and disconnect.
- Disconnect clears account/provider UI state and disables write actions until reconnect.

Read-only contract state should remain available without wallet connection.

## Visual design system

Preserve the existing trust-first language, but raise polish.

Direction:

- editorial hero with compact product proof cards;
- clearer hierarchy between explanation, reviewer checklist, and canonical marketplace state;
- restrained color palette around dark ink, warm background, amber action, and green success;
- explicit status chips for Open, Locked, Retryable, Cleared, Cancelled, and Expired;
- no raw validator internals on the primary surface;
- dense but readable forms with labels, helper text, and inline validation;
- responsive two-column layout on desktop, single column on mobile;
- minimum 44px interactive targets;
- visible focus states;
- reduced-motion-safe transitions;
- no layout shift when validation or transaction feedback appears.

The app needs a simple logo mark for the Explorer listing. It can be SVG/CSS-native: a slot grid, clearing path, or agent-capacity motif. No generated bitmap is required unless the listing explicitly demands a raster logo.

## Sites-assisted design boundary

`@Sites` may be used as a design and preview aid if it materially helps evaluate the webapp's first-run experience, information hierarchy, or public listing presentation.

Boundaries:

- Do not publish or host this project through Sites.
- Do not create a parallel production URL.
- Do not replace the existing Vite/Vercel project structure with a Sites scaffold.
- Do not introduce `.openai/hosting.json` unless the user explicitly changes the deployment strategy.
- Keep the final deploy target Vercel.
- If a Sites-style preview is used, treat it as non-authoritative design evidence only; production readiness still comes from the Vercel deployment, browser-wallet testing, canonical Studionet reads, and repository CI.

## Documentation and listing assets

Add `docs/PROJECT-EXPLORER-LISTING.md` with copy-ready fields:

- Name: SkillSlot Clearing
- Category: Marketplace / Agent Economy
- Logo path
- One-liner
- Short description
- Exact "How to try it" steps
- Website URL
- Repository URL
- Contract explorer URL
- Network status: Studionet Preview
- Known limits

Update README and submission docs so they agree on:

- current production URL;
- current active Studionet contract;
- latest successful CI run;
- exact browser evidence file;
- honest distinction between script-signed lifecycle evidence and browser-wallet evidence.

## Verification design

Automated checks:

- `npm run check`
- frontend unit tests for wallet modal selection and disconnect;
- frontend unit tests for generated metadata payload/hash/offer defaults;
- frontend unit tests for guided reviewer step status;
- existing transaction recovery tests remain passing.

Manual browser proof:

- open local app in Chrome or controlled browser;
- verify wallet-selection modal appears instead of auto-picking a wallet;
- connect a detected wallet and confirm Studionet state;
- verify account menu and disconnect;
- follow the Project Explorer instructions against production or a fresh local build;
- record only public evidence: URL, commit, contract address, safe transaction hashes, canonical view output, browser console status, and screenshots if useful;
- do not expose private keys, `.env`, raw RPC traces, or wallet exports.

Deployment proof:

- production Vercel deployment must serve the upgraded app;
- the deployed bundle must contain the active contract address;
- production URL must return HTTP 200;
- public metadata URLs must return deterministic documents when used by the offer flow.

## Non-goals

- No switch to Bradbury or Asimov in this upgrade. Studio-only Project Explorer status remains Preview.
- No fake gas, fake balances, fake signatures, or local-storage canonical state.
- No final Project Explorer submission click without explicit action-time authorization.
- No contract redeploy unless the metadata simplification cannot be made compatible with the current contract constraints.

## Acceptance criteria

The upgrade is ready when all of these are true:

1. A fresh reviewer can open the production app and understand the product within the first screen.
2. The app gives exact in-product steps matching the Project Explorer listing instructions.
3. Provider offer submission no longer requires the default user to manually calculate metadata hash/proof fields.
4. Wallet connection requires explicit wallet selection and supports disconnect.
5. Every write action still uses the real selected wallet and reloads canonical onchain state after finalization.
6. Timeout recovery remains visible only when canonical state makes it valid.
7. README, submission docs, and Project Explorer listing text match the actual deployed contract and evidence.
8. `npm run check` passes after implementation.
9. Production deployment is verified in browser with no console errors during the documented flow.
10. Public repo hygiene passes before push: intended repo root, focused diff, no secrets/control files, no parent-workspace files, and no stale claims.
