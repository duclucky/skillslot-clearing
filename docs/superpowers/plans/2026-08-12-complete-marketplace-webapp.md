# Complete Marketplace Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the latest-round result dashboard with a complete self-service marketplace that browses all rounds, creates new rounds, supports every valid wallet action, and aggregates wallet activity across rounds.

**Architecture:** Keep the deployed contract, React/Vite stack, and Vercel project. Deepen the contract adapter so it owns all-round canonical reconstruction, then render three task-oriented destinations from a typed workspace snapshot. Keep transaction truth in the adapter and UI selection/retry state in React.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest, Testing Library, genlayer-js 1.1.8, Phosphor Icons, native CSS, Vercel.

## Global Constraints

- Do not change or redeploy the contract.
- Studionet state is canonical; no fixture, browser storage, or hosting database may represent market state or finality.
- Any connected Studionet wallet may create a round.
- Every write must surface wallet, submitted, accepted, finalized, failed, and retry behavior.
- Every finalized write must reload canonical state.
- Use GEN in all human-facing value labels.
- Keep the existing warm editorial utility system with one green accent, Phosphor icons, flat surfaces, and no decorative motion.
- Preserve the existing public Vercel alias and contract address.
- Run `npm run check` before deployment.

---

### Task 1: Canonical all-round workspace model

**Files:**
- Modify: `frontend/src/domain.ts`
- Modify: `frontend/src/contractAdapter.ts`
- Modify: `frontend/src/contractAdapter.test.ts`

**Interfaces:**
- Produces: `WorkspaceSnapshot.rounds: RoundView[]`
- Produces: `PositionView` records from every round for the active account
- Produces: `TransactionProgress.stage` including `wallet`
- Preserves: all eight `ContractAdapter` write signatures

- [ ] **Step 1: Write failing adapter tests**

Add tests that return three rounds with different phases, positions belonging to the account in two rounds, and assert:

```ts
expect(snapshot.rounds.map((round) => round.id)).toEqual([
  "round-open",
  "round-cleared",
  "round-cancelled",
]);
expect(snapshot.positions.map((position) => position.roundId)).toEqual([
  "round-open",
  "round-cleared",
]);
```

Update the write-progress assertion to require the exact first stages:

```ts
expect(progress.mock.calls.slice(0, 4).map(([event]) => event.stage)).toEqual([
  "wallet",
  "submitted",
  "accepted",
  "finalized",
]);
```

- [ ] **Step 2: Verify RED**

Run: `npm --prefix frontend test -- src/contractAdapter.test.ts`

Expected: FAIL because `rounds` and the `wallet` progress stage do not exist.

- [ ] **Step 3: Implement the model and adapter**

Change the snapshot contract to:

```ts
export interface WorkspaceSnapshot {
  availability: WorkspaceAvailability;
  account: string | null;
  networkName: string | null;
  contractAddress: string | null;
  rounds: RoundView[];
  positions: PositionView[];
  creditGen: string;
  accountingInvariant: boolean | null;
}
```

Make `loadWorkspace` map all `get_round_ids` records into `rounds`, then gather account-owned offers, requests, and grants per round. Emit `{ stage: "wallet", hash: "", functionName }` immediately before `writeContract`.

- [ ] **Step 4: Verify GREEN and regression scope**

Run: `npm --prefix frontend test -- src/contractAdapter.test.ts src/txState.test.ts`

Expected: all adapter and transaction tests pass.

- [ ] **Step 5: Commit**

```text
feat: load canonical activity across rounds
```

---

### Task 2: Marketplace navigation, round explorer, and creation

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/Marketplace.tsx`
- Create: `frontend/src/marketplace.ts`
- Modify: `frontend/src/app.test.tsx`

**Interfaces:**
- Produces: `Destination = "rounds" | "create" | "activity"`
- Produces: `groupRounds(rounds, filter)` for `open`, `decision`, and `history`
- Produces: round selection keyed by canonical `roundId`
- Consumes: `WorkspaceSnapshot.rounds`

- [ ] **Step 1: Write failing UI and helper tests**

Cover terminal-only snapshots, grouping, selection, and creation:

```ts
expect(screen.getByRole("button", { name: "Create round" })).toBeEnabled();
fireEvent.click(screen.getByRole("button", { name: "History" }));
expect(screen.getByRole("button", { name: /Completed allocation/i })).toBeVisible();
fireEvent.click(screen.getByRole("button", { name: "Create round" }));
expect(screen.getByRole("heading", { name: "Start a clearing round" })).toBeVisible();
```

Assert a finalized creation reloads the workspace and selects the returned round ID.

- [ ] **Step 2: Verify RED**

Run: `npm --prefix frontend test -- src/app.test.tsx`

Expected: FAIL because the new destinations, filters, and all-round model are missing.

- [ ] **Step 3: Implement the app shell and marketplace**

Keep `App` responsible for adapter lifecycle, destination, selected round, transaction, load failure, and retry action. Move round browsing, detail, creator controls, and position forms into `Marketplace.tsx`. Put only pure phase grouping and contract-compatible input validation in `marketplace.ts`.

The permanent navigation labels are:

```ts
const destinations = [
  ["rounds", "Rounds"],
  ["create", "Create round"],
  ["activity", "My activity"],
] as const;
```

After `openRound` finalizes, reload, select the submitted round ID, and return to Rounds. Terminal round detail always exposes Create another round.

- [ ] **Step 4: Verify GREEN and refactor**

Run: `npm --prefix frontend test -- src/app.test.tsx`

Expected: all application tests pass.

- [ ] **Step 5: Commit**

```text
feat: add self-service round marketplace
```

---

### Task 3: Activity, lifecycle recovery, and form safety

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/Marketplace.tsx`
- Create: `frontend/src/Activity.tsx`
- Modify: `frontend/src/marketplace.ts`
- Modify: `frontend/src/app.test.tsx`
- Modify: `frontend/src/txState.ts`
- Modify: `frontend/src/txState.test.ts`

**Interfaces:**
- Produces: retryable `runWrite(action, context)` behavior
- Produces: `validateId`, `validateBoundedText`, and `validateCapabilityCsv`
- Consumes: all-round `positions`, `creditGen`, and transaction progress

- [ ] **Step 1: Write failing lifecycle and validation tests**

Add component tests proving:

```ts
expect(screen.getByText("Waiting for wallet confirmation")).toBeVisible();
expect(screen.getByRole("button", { name: "Retry transaction" })).toBeEnabled();
expect(screen.getByDisplayValue("Find authoritative sources")).toBeVisible();
```

Add pure validation assertions for 3-80 character IDs, 120 character titles/labels, 600 character promise/need/CSV fields, duplicate CSV IDs, and invalid characters.

- [ ] **Step 2: Verify RED**

Run: `npm --prefix frontend test -- src/app.test.tsx src/txState.test.ts`

Expected: FAIL because wallet-stage messaging, retry controls, preservation, and inline validation are missing.

- [ ] **Step 3: Implement activity and recovery**

Render all wallet positions grouped by round in `Activity.tsx`. Keep consume and withdraw actions canonical. Store the last failed action callback and expose one Retry transaction control. Do not clear controlled form inputs until a write finalizes. Add inline validation before the wallet call and associate helper/error text with each field.

Disable Lock until both counts are positive. Hide provider/requester submit actions when their side has four positions or the round is not `OPEN`. Separate Cancel visually and explain credit recovery.

- [ ] **Step 4: Verify GREEN and full frontend regression**

Run: `npm --prefix frontend test`

Expected: all frontend tests pass with no unhandled errors.

- [ ] **Step 5: Commit**

```text
feat: complete wallet activity and recovery flows
```

---

### Task 4: Responsive visual system and production delivery

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/index.html`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/POSTMORTEM.md`
- Modify: `docs/SUBMISSION.md`

**Interfaces:**
- Consumes: semantic class names and regions from Tasks 2-3
- Produces: responsive 375/768/1024/1440 layouts and honest public documentation

- [ ] **Step 1: Add static UI assertions before styling**

Extend application tests to assert landmark names, selected navigation state, associated field descriptions/errors, useful loading and empty states, and no simulated market copy.

- [ ] **Step 2: Verify RED where new semantics are absent**

Run: `npm --prefix frontend test -- src/app.test.tsx`

Expected: FAIL only for missing semantic or state content.

- [ ] **Step 3: Implement the visual system**

Use the locked tokens and dials. Build a desktop list-detail layout, stacked tablet layout, and strict single-column mobile layout. Maintain one light theme, one green accent, 44 px targets, visible focus, no horizontal overflow, no em-dash in visible copy, and no decorative animation.

Update metadata and documentation to describe the marketplace rather than the earlier result dashboard. Preserve the distinction between tested controls and browser-wallet transaction evidence.

- [ ] **Step 4: Run complete verification**

Run: `npm run check`

Expected: contract lint, static checks, direct tests, deployment tests, frontend tests, TypeScript, and production build all pass.

- [ ] **Step 5: Review and commit**

Review `git diff --check`, public-file hygiene, visible copy, exact test counts, and documentation claims.

```text
feat: ship complete SkillSlot marketplace webapp
```

- [ ] **Step 6: Deploy and browser QA**

Deploy the linked project to Vercel production. Open the resulting alias in Chrome and verify canonical rounds, all three destinations, desktop and 375 px mobile layouts, minimum target sizes, no document overflow, and no console errors. Do not send a wallet transaction unless separately required for evidence.

Expected: `https://skillslot-clearing.vercel.app` serves the new marketplace UI and canonical Studionet data.
