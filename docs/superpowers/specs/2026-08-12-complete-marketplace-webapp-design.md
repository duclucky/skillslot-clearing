# SkillSlot Clearing Complete Marketplace Webapp Design

**Date:** 2026-08-12

**Status:** Approved for implementation

## Objective

Turn the existing result-oriented frontend into a self-service marketplace where any Studionet wallet can create a clearing round, join as a provider or requester, operate rounds it created, and manage grants and credits across all rounds.

The webapp must preserve the deployed contract as the only source of canonical round, position, grant, credit, and accounting state. No browser database, fixture, or hosting storage may simulate onchain state or finality.

## Product boundary

This increment changes the frontend, its typed adapter, frontend tests, and public documentation. It does not change or redeploy the Intelligent Contract.

The product reserves a one-time access route after semantic compatibility clearing. It does not certify provider identity, agent performance, fulfillment, or service quality. This limitation remains visible near every grant or consumption action.

## Users and jobs

### Round creator

- Create a round with a stable ID and plain-language title.
- See it immediately after finalization.
- Monitor offer and request capacity.
- Lock only after both sides have at least one position.
- Clear a locked round, retry a retryable round, or cancel an open round.
- Start another round after a terminal round.

### Provider

- Browse open rounds.
- Open a round and inspect its economics and available capacity.
- Submit one bonded offer with a stable capability ID set.
- Track the offer and resulting credit across rounds.

### Requester

- Browse open rounds.
- Submit one paid need with required and excluded capability IDs.
- Track the request outcome.
- Consume an active one-time route grant.
- Withdraw canonical credit.

One wallet may perform more than one role across different rounds. The UI must not invent a persistent role selection.

## Information architecture

The application has three top-level destinations and one contextual detail surface.

### Rounds

This is the default destination. It presents all canonical rounds grouped and filtered by user-relevant lifecycle:

- Open now: `OPEN`
- In decision: `LOCKED`, `CLEARING`, `RETRYABLE`
- History: `CLEARED`, `CANCELLED`

Each round summary shows its title, ID, phase, filled offer and request slots, 1 GEN economics, creator identity, and the next meaningful action. Selecting a summary opens the round detail without losing the list context.

### Create round

This destination is always available to a connected Studionet wallet, including when every existing round is terminal. It explains that the creator controls lock, clear, retry, and safe cancellation. After a finalized `open_round`, the app selects the new canonical round and opens its detail.

### My activity

This destination aggregates the connected wallet's offers, requests, grants, and withdrawable credit across all canonical rounds. Entries link back to their round. An active grant exposes `consume_grant`; positive credit exposes `withdraw_credit`.

### Round detail

The detail surface contains:

- lifecycle phase and creator;
- exact offer/request capacity;
- bond and booking fee in GEN;
- actions allowed for the current wallet and phase;
- existing position summaries;
- a concise explanation of the next state transition;
- a terminal-state action to create another round.

## Core journeys

### New participant

1. Arrive at Rounds and see canonical public state without granting wallet permission.
2. Read a compact three-role onboarding block.
3. Connect a browser wallet or switch to Studionet.
4. Choose an open round or create a new one.

### Create and operate a round

1. Open Create round.
2. Enter a unique stable round ID and descriptive title.
3. Confirm the transaction in the wallet.
4. Observe submitted, accepted, and finalized states.
5. Land on the new round detail after canonical reload.
6. Lock only when at least one offer and one request exist.
7. Clear, retry, or cancel only when the contract phase permits it.

### Submit a position

1. Select an `OPEN` round.
2. Choose Offer an agent or Request access.
3. Complete a focused form with visible labels, field guidance, and inline validation.
4. Review the exact 1 GEN value before opening the wallet.
5. Observe the full transaction lifecycle.
6. See the new position from a canonical reload, then access it from My activity.

### Use a grant and recover value

1. Open My activity.
2. Select an active grant and inspect its scope limitation.
3. Consume it once and reload its canonical status.
4. Withdraw a positive GEN credit and reload the resulting credit and accounting state.

## Frontend architecture

The existing React, TypeScript, Vite, `genlayer-js`, and Phosphor stack remains. Native CSS remains the single visual system. No new state, routing, animation, or component framework dependency is required.

### Domain model

`WorkspaceSnapshot` changes from one selected round to:

- `rounds: RoundView[]`
- `positions: PositionView[]` across all rounds for the connected account
- `creditGen`
- `accountingInvariant`
- existing availability, network, account, and contract identity

`RoundView` adds the canonical fields needed by list and detail views. Selection remains UI state keyed by `roundId`; it is never canonical state.

### Contract adapter

`loadWorkspace` reads `get_round_ids`, then `get_round` for every ID. It reads offers, requests, matches, and route permission for the connected account across rounds. The adapter returns stable domain models and never applies a hidden "latest round" product rule.

Writes retain the existing eight wrappers. A finalized write triggers one fresh workspace load. `openRound` returns enough context for the UI to select the newly created round after finalization.

### View composition

The application is decomposed into focused units:

- app shell, network state, wallet action, and top-level destination state;
- rounds explorer, lifecycle filters, round summary, and round detail;
- create-round form;
- provider and requester forms;
- creator controls;
- transaction lifecycle panel;
- wallet activity and credit actions;
- shared loading, empty, unavailable, and inline error states.

The implementation may place small units in one file initially, but data access, transaction behavior, and view logic must remain separately testable.

## Transaction lifecycle and recovery

Every write exposes these stages:

1. `wallet`: waiting for the wallet confirmation.
2. `submitted`: transaction hash received.
3. `accepted`: the network accepted the transaction.
4. `finalized`: canonical state may be reloaded.
5. `failed`: the wallet rejected or the network returned a terminal or polling error.

The lifecycle panel uses the actual reported stage. It must not advance on timers or optimistic local state. A failed write keeps the action and form input available and offers an explicit retry. Retrying creates a new wallet request; it never assumes the earlier transaction failed if canonical state shows it finalized.

Canonical-load errors render contextually with a Retry state-read action. Wrong-network and missing-contract states remain honest and distinct.

## Validation and constraints

- Round, offer, and request IDs are 3-80 characters, start with an ASCII letter or digit, and contain only ASCII letters, digits, hyphens, underscores, or periods.
- Round titles are 3-120 characters. Offer/request labels are 3-120 characters. Promise and need text are 1-600 characters. Each capability CSV is at most 600 characters.
- Capability IDs are normalized as comma-separated stable identifiers and are explained with concrete examples.
- A creator cannot press Lock until both position counts are positive.
- Position submission actions disappear when the round is full or no longer open.
- Destructive Cancel is visually separated and states that it credits existing deposits for withdrawal.
- Every value-facing control displays GEN, never raw base units.

## Visual system

**Design Read:** a self-service agent-access marketplace for technical wallet users, using a calm editorial utility language with a flat, trust-first product system.

**Dials:** `DESIGN_VARIANCE 6`, `MOTION_INTENSITY 3`, `VISUAL_DENSITY 7`.

The offline UI engine returned a marketplace pattern and flat design, but its generic purple palette and Jakarta pairing conflict with the existing brand and the workspace anti-default rule. The implementation therefore retains the established accessible system:

- warm light canvas and flat cream surfaces;
- charcoal ink and one green action accent;
- Newsreader for editorial headings, justified by the market-clearing document metaphor;
- Public Sans for UI and IBM Plex Mono for exact IDs and values;
- Phosphor icons only;
- 6 px controls and 10-12 px structural surfaces;
- no gradients, glass, decorative shadows, fake screenshots, or ornamental motion.

This is a product workspace, not a marketing landing page. Real canonical round data is the primary visual material, so stock or generated imagery would distract and is intentionally omitted. Motion remains limited to hover, focus, press, disclosure, and transaction state feedback. Reduced-motion behavior is therefore naturally static.

The app remains one light theme because the existing product explicitly uses a document-style operational surface. Contrast, 44 px touch targets, keyboard order, visible focus, responsive 375/768/1024/1440 layouts, loading skeletons, and copy audit are mandatory.

## Responsive behavior

- At 1024 px and wider, use a list-detail workspace with a stable contextual action column.
- From 768 px to 1023 px, stack detail below the selected round summary and keep top-level navigation on one line.
- Below 768 px, collapse to one column, use horizontally scrollable top-level navigation when needed, keep controls full-width where labels would wrap, and preserve at least 44 px touch targets.
- No viewport may have horizontal document overflow.

## Accessibility

- Use real buttons, links, fields, headings, regions, status text, and alert semantics.
- Every field has a visible label; helper and error text are associated programmatically.
- Filters and destination controls expose selected state.
- Transaction progress uses polite announcements; failures use alerts.
- Color is never the only phase or error signal.
- Focus returns to the new round detail after a finalized creation and to the relevant status panel after other writes.

## Testing strategy

Implementation follows red-green-refactor.

### Adapter tests

- load all rounds in canonical order;
- preserve terminal rounds instead of hiding them;
- aggregate wallet positions across multiple rounds;
- expose an active grant only when `can_route` is true;
- report wallet, submitted, accepted, finalized, and failed transaction stages;
- reload is initiated only after finalization;
- transient polling errors do not create false failure claims.

### Component tests

- terminal-only data still shows Create round;
- round filters and detail selection work;
- any connected Studionet wallet may open a round;
- creator controls follow role and phase;
- Lock remains disabled until both sides exist;
- provider and requester forms preserve input after a rejected transaction;
- a finalized open selects the new round;
- My activity includes positions from multiple rounds;
- active grants and positive credit expose the correct actions;
- loading, empty, wrong-network, unconfigured, read-error, write-error, and retry states are visible and actionable;
- no reviewer internals or simulated values appear.

### End-to-end verification

- run the project-wide `npm run check` gate;
- run the production Vite build used by Vercel;
- inspect desktop and 375 px mobile layouts in a real browser;
- verify keyboard navigation, minimum target sizes, document overflow, visible canonical values, and browser console cleanliness;
- deploy to the existing Vercel project after a successful build;
- keep any browser-wallet write evidence distinct from existing script-signed Studionet evidence.

## Vercel delivery

The implementation preserves the existing Vite application and linked Vercel project. The root directory remains `frontend`, and the only hosted application configuration is the public Studionet contract address.

No database, app-owned authentication, or hosting persistence is required. Contract state remains public Studionet state. Private keys and wallet material never enter Vercel configuration.

Publish only after the full project check passes. Keep the existing production alias and verify the deployed application with Chrome at desktop and mobile widths.

## Acceptance criteria

- A user is never trapped on the latest completed round.
- Any connected Studionet wallet can start a new round from a permanent destination and from every terminal-round state.
- Users can browse and open every canonical round.
- Users can complete every contract write that is valid for their wallet and the selected phase.
- My activity spans all rounds rather than only the selected round.
- Every write presents actual wallet, submitted, accepted, finalized, failed, and retry behavior, then reloads canonical state.
- Empty, loading, error, wrong-network, disconnected, active, and terminal states remain useful.
- Desktop and mobile pass the UI pre-flight and browser QA.
- Project checks and the Vercel production build pass before deployment.
- The deployed Vercel URL runs against the existing Studionet contract without simulated state.

## Explicit non-goals

- No new contract or deployment revision.
- No provider performance or identity certification.
- No offchain search index, recommendation engine, chat, messaging, or review system.
- No local canonical state, fixture-as-live behavior, or optimistic finality.
- No Portal submission action.
