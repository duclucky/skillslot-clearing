# Overview Landing Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Overview a focused SkillSlot landing page by hiding workspace navigation there, adding a clear first-time user journey, and improving contrast in operational empty/header panels.

**Architecture:** Keep destination state and CTA handlers unchanged. Render the shared workspace nav conditionally for operational destinations, and add a presentational usage explainer to `Overview` using existing content/icon patterns and responsive CSS.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Vite, existing CSS tokens and Phosphor icons.

## Global Constraints

- Preserve the current dark immersive video background, Swiss-style spacing, typography, and semantic color tokens.
- Do not add unsourced activity/proof metrics or change contract/RPC behavior.
- Keep wallet control and topbar available on Overview; keep navigation on Rounds, Create round, and My activity.
- Keep new copy readable on narrow viewports with visible keyboard focus states.
- Keep empty states and editorial headers legible against the video background through opaque/tonal surfaces and semantic text colors.
- Run `npm run check` after frontend changes and verify the deployed page in Chrome.

---

### Task 1: Make workspace navigation destination-aware

**Files:**
- Modify: `frontend/src/App.tsx` around the `.primary-nav` render.
- Test: `frontend/src/app.test.tsx` navigation and Overview tests.

**Interfaces:**
- Consumes: existing `destination` state and `destinations` array.
- Produces: `.primary-nav` absent for `overview`, present for `rounds`, `create`, and `activity`.

- [ ] **Step 1: Write the failing tests**

Add `expect(document.querySelector(".primary-nav")).toBeNull()` to the Overview test and assert `.primary-nav` is visible after clicking the Rounds button in the operational navigation test.

- [ ] **Step 2: Run the focused tests to verify the failure**

Run: `npm --prefix frontend test -- app.test.tsx`

Expected: the new Overview assertion fails because `.primary-nav` currently renders on every destination.

- [ ] **Step 3: Implement the minimal conditional render**

Wrap the existing nav block in `{destination !== "overview" ? (...) : null}`. Keep the current button markup, labels, active `aria-pressed` state, and `setDestination` handlers unchanged.

- [ ] **Step 4: Run the focused tests to verify the pass**

Run: `npm --prefix frontend test -- app.test.tsx`

Expected: all App tests pass, including hidden Overview nav and visible operational nav.

- [ ] **Step 5: Commit the navigation change**

Run: `git add frontend/src/App.tsx frontend/src/app.test.tsx; git commit -m "Focus overview as landing page"`

### Task 2: Add the first-time user usage explainer

**Files:**
- Modify: `frontend/src/App.tsx` near `Overview` and its section list.
- Modify: `frontend/src/styles.css` near overview/mechanism styles.
- Test: `frontend/src/app.test.tsx` Overview content test.

**Interfaces:**
- Consumes: existing `onOpenRounds` and `onCreateRound` callbacks.
- Produces: an accessible `How to use SkillSlot` region with three ordered steps and the existing landing CTAs.

- [ ] **Step 1: Write the failing content assertions**

Add assertions for the region and exact headings: `How to use SkillSlot`, `Browse an open round`, `Offer or request access`, and `Review the finalized result`.

- [ ] **Step 2: Run the focused test to verify the failure**

Run: `npm --prefix frontend test -- app.test.tsx`

Expected: the new region assertion fails because the usage explainer does not exist.

- [ ] **Step 3: Implement the usage section**

Add a semantic `section` after the mechanism section with `aria-label="How to use SkillSlot"`, an ordered list of the three steps above, concise first-time-user descriptions, and a final CTA row reusing `onOpenRounds` and `onCreateRound`.

Add `.usage-card`, `.usage-list`, `.usage-step`, and `.landing-cta-row` styles using existing variables, 8px spacing increments, readable contrast, and a single-column mobile breakpoint. Do not add new animation or metrics.

- [ ] **Step 4: Run the focused tests and build**

Run: `npm --prefix frontend test -- app.test.tsx` then `npm --prefix frontend run build`

Expected: all App tests pass and Vite produces a production build.

- [ ] **Step 5: Commit the usage explainer**

Run: `git add frontend/src/App.tsx frontend/src/styles.css frontend/src/app.test.tsx; git commit -m "Add overview usage explainer"`

### Task 3: Restore contrast for empty and editorial panels

**Files:**
- Modify: `frontend/src/styles.css` near `.empty-state` and Create round editorial header styles.
- Test: `frontend/src/app.test.tsx` by asserting the relevant classes on the empty state and Create round header.

- [ ] **Step 1: Write the failing style-hook assertions**

In the Rounds test, assert the empty-state container has `high-contrast-surface`. In the Create round test, assert the “Start a clearing round” heading is inside an element with `editorial-header-surface`.

- [ ] **Step 2: Run the focused tests to verify the failure**

Run: `npm --prefix frontend test -- app.test.tsx`

Expected: the new class assertions fail because these surfaces are not yet marked.

- [ ] **Step 3: Implement the semantic surfaces**

Add the classes to the existing JSX containers without changing state or copy. Define `high-contrast-surface` with a dark opaque/blurred surface, a visible border, and `--text`/`--muted` contrast. Define `editorial-header-surface` with a light neutral translucent panel, dark heading text, and matching muted body text; keep padding and radius aligned to the existing card scale.

- [ ] **Step 4: Run focused tests and visual build**

Run: `npm --prefix frontend test -- app.test.tsx` then `npm --prefix frontend run build`.

Expected: all App tests pass and the production build completes.

- [ ] **Step 5: Commit the contrast change**

Run: `git add frontend/src/App.tsx frontend/src/styles.css frontend/src/app.test.tsx; git commit -m "Improve operational panel contrast"`

### Task 4: Full verification and browser review

**Files:**
- Verify: `frontend/src/App.tsx`, `frontend/src/styles.css`, `frontend/src/app.test.tsx`.

- [ ] **Step 1: Run the required project check**

Run: `npm run check`

Expected: all static/direct/receipt/tooling/frontend tests pass and the production build completes.

- [ ] **Step 2: Inspect responsive behavior in Chrome**

At the deployed URL, confirm Overview has no `.primary-nav`, the topbar wallet control remains, the three explainer steps are visible, and Browse rounds/Create a round still navigate correctly. Check a narrow viewport and confirm no horizontal overflow.

- [ ] **Step 3: Review diff and repository hygiene**

Run: `git status --short`, `git diff --check`, and `git diff HEAD~2..HEAD --stat`.

Expected: only the documented landing/navigation files changed; no secrets, generated artifacts, or unrelated files are staged.
