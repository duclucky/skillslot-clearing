# Reviewer Trust Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address reviewer feedback by binding provider offers to authenticated agent metadata and adding permissionless timeout recovery so locked funds cannot depend indefinitely on the round creator.

**Architecture:** The contract keeps one primitive and adds deterministic proof fields to provider offers. Clearing continues to use GenLayer semantic consensus, but only over capability sets that passed objective metadata checks. Timeout recovery is non-penalizing: any caller can refund locked deposits after the relevant deadline without paying provider fees.

**Tech Stack:** GenVM Python contract, gltest direct tests, Vite React frontend, Vitest adapter/UI tests.

## Global Constraints

- Do not release provider fees from self-authored promises alone.
- Do not use timeout recovery as a payout path; it only refunds locked deposits.
- Preserve the existing marketplace UI system and add only state/action fields required by the reviewer fix.
- Run `npm run check` after contract, tests, docs, and frontend changes.

---

### Task 1: Authenticated Agent Metadata

**Files:**
- Modify: `contracts/skill_slot_clearing.py`
- Modify: `tests/direct/helpers.py`
- Modify: `tests/direct/test_positions.py`
- Modify: `tests/direct/test_semantic_clearing.py`

**Interfaces:**
- `submit_offer(round_id, offer_id, label, promise_text, capability_ids_csv, agent_id, metadata_uri, metadata_hash, metadata_issuer, metadata_signature, metadata_expires_at)`
- `get_offer(round_id, offer_id)` returns the new metadata fields and `metadata_authenticated`.

- [ ] Write failing tests for invalid issuer, provider mismatch, capability mismatch, expired metadata, and valid metadata.
- [ ] Run focused tests and confirm they fail because the contract still has the old `submit_offer` interface.
- [ ] Implement deterministic metadata parsing and validation.
- [ ] Update clearing prompt snapshot so authenticated metadata is load-bearing.
- [ ] Run focused direct tests until green.

### Task 2: Permissionless Timeout Recovery

**Files:**
- Modify: `contracts/skill_slot_clearing.py`
- Modify: `tests/direct/helpers.py`
- Modify: `tests/direct/test_recovery_and_grants.py`
- Modify: `tests/direct/test_round_state.py`

**Interfaces:**
- `open_round(round_id, title, booking_fee_wei, provider_bond_wei, open_timeout_seconds, clear_timeout_seconds)`
- `recover_expired_round(round_id)`
- `get_round(round_id)` returns `open_deadline`, `clear_deadline`, and `expired`.

- [ ] Write failing tests for unauthorized-independent recovery in `OPEN`, `LOCKED`, and `RETRYABLE`.
- [ ] Write failing tests that recovery before deadline rejects and terminal recovery is idempotent/no double credit.
- [ ] Implement deadlines and refund-only recovery.
- [ ] Run focused direct tests until green.

### Task 3: Frontend And Documentation Sync

**Files:**
- Modify: `frontend/src/domain.ts`
- Modify: `frontend/src/contractAdapter.ts`
- Modify: `frontend/src/contractAdapter.test.ts`
- Modify: `frontend/src/Marketplace.tsx`
- Modify: `frontend/src/app.test.tsx`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/SUBMISSION.md`

**Interfaces:**
- `OfferInput` includes metadata fields.
- `ContractAdapter.recoverExpiredRound(roundId)` writes `recover_expired_round`.
- UI shows metadata inputs and a recovery button when canonical state says the round is expired and not terminal.

- [ ] Write failing Vitest cases for new submit offer args and recovery write routing.
- [ ] Update adapter/domain/UI with the smallest functional changes.
- [ ] Update copy so it no longer claims self-authored provider promises settle fees.
- [ ] Run frontend focused tests.

### Task 4: Full Verification

**Files:**
- Review all modified files.

- [ ] Run `npm run check`.
- [ ] Inspect `git diff --check` and `git status --short`.
- [ ] Report local verification separately from Studionet redeployment, because the existing deployed contract will not include these changes until redeployed.
