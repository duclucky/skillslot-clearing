# Unified Transaction Recovery Design

**Date:** 2026-08-12

**Status:** Approved for implementation planning

**Scope:** Production frontend transaction and canonical-state recovery for all eight SkillSlot write actions

## Objective

Remove user-facing retry loops without weakening wallet safety or inventing transaction success. All frontend writes must use one recovery policy that distinguishes wallet cancellation, uncertain submission, transaction finality, transient RPC failure, and deterministic contract failure.

The eight covered actions are `open_round`, `submit_offer`, `submit_request`, `lock_round`, `clear_round`, `cancel_round`, `consume_grant`, and `withdraw_credit`.

## Constraints

- The browser wallet remains the only signer. The app never signs, auto-approves, or repeatedly opens wallet confirmation prompts.
- A write is never submitted twice merely because the frontend lost connectivity.
- Canonical contract views remain the source of truth. Cached UI state may remain visible during an outage but cannot be presented as newly confirmed state.
- The frontend must continue to expose submitted, accepted, finalized, failed, and recovery states honestly.
- No new backend, Vercel RPC proxy, contract method, storage schema, or deployment is required.
- Existing navigation, forms, round lifecycle, labels, brand tokens, and accessibility behavior remain stable unless this specification explicitly changes them.

## Design Read

This is a trust-first product workflow for technical builders operating value-bearing actions on Studionet. Preserve the existing React and native-CSS system with low motion and standard density. Recovery feedback must be contextual, explicit, and accessible rather than decorative.

Design dials: `DESIGN_VARIANCE=4`, `MOTION_INTENSITY=2`, `VISUAL_DENSITY=5`.

## Architecture

The GenLayer adapter owns transaction classification and network retry. React owns presentation and canonical snapshot selection. All eight public write wrappers continue to call the same private `execute()` method, so the policy cannot drift between actions.

The adapter will expose typed transaction progress rather than an unstructured failed message. The application will consume those events without storing executable write closures for later replay.

### Error classes

The implementation must normalize nested provider, SDK, Viem, and RPC errors into these categories:

1. `wallet_cancelled`
   - Provider code `4001`, nested code `4001`, or an equivalent explicit user-denial message.
   - No transaction hash exists.
   - Result is cancellation, not failure.

2. `submission_uncertain`
   - A transient transport failure occurs while `writeContract` is in progress and no hash is returned.
   - The app cannot prove whether the signed transaction reached Studionet.
   - It must not call `writeContract` again automatically.

3. `rpc_transient`
   - Network failures, timeouts, rate limits, temporary indexing misses, or HTTP 429/502/503/504 errors during status polling or canonical reads.
   - Safe to retry because the operation is read-only or targets an existing hash.

4. `transaction_terminal`
   - Studionet reports `UNDETERMINED`, `CANCELED`, `LEADER_TIMEOUT`, or `VALIDATORS_TIMEOUT`.
   - The write is not reported as finalized.

5. `deterministic_failure`
   - Contract revert, invalid method/arguments, wrong caller/state/value, or another non-transient error.
   - No automatic retry.

## Transaction state flow

### Wallet confirmation

The UI immediately shows `Confirm in wallet` and disables conflicting actions.

If the wallet returns cancellation, the adapter emits `cancelled`. The UI clears the transaction strip, clears any action error, releases `busy`, preserves form values, and restores the original action button. It must not show `Transaction failed` or a retry button.

### Submission before a hash

When `writeContract` throws a transient transport error before returning a hash, the adapter emits `recovering` with reason `submission_uncertain`.

The app must not resend. It reloads canonical state using the normal bounded read-recovery policy. If canonical state proves the intended transition occurred, the UI adopts that state. If it does not prove the transition, the app keeps the latest known snapshot and displays a neutral message explaining that submission could not be confirmed. The user may choose the original action again only after reviewing canonical state.

### Submission with a hash

Once a hash exists, the adapter emits `submitted` and retains that hash for the rest of the execution. Every subsequent retry is a read of `gen_getTransactionStatus(hash)`. `writeContract` must be called exactly once.

Transient status failures use bounded exponential backoff. Indexing misses are transient only in this phase. The adapter emits `recovering` while the same hash is being checked and returns to `accepted` or `finalized` when the network responds.

### Accepted and finalized

`ACCEPTED` emits `accepted` once. Polling continues without user action until a terminal status or timeout budget is reached.

`FINALIZED` emits `finalized`. The application then reloads every required canonical view with bounded exponential backoff. On success it commits the new snapshot, clears transaction UI, runs any post-finality navigation callback, and re-enables actions.

### Retry budget exhaustion

Exhausting the network retry budget must not replace the last good snapshot with an empty marketplace. The UI shows a contextual network notice while retaining the last confirmed data.

The app registers bounded refresh triggers for browser `online` and window focus. These triggers reload canonical state only. They never replay a write or open a wallet prompt.

### Deterministic and terminal failures

Deterministic contract failures and terminal network outcomes emit `failed` with a safe normalized message. The UI reloads canonical state once through the normal read-recovery policy, releases `busy`, and shows the failure. It does not retain or display `Retry transaction`.

The original action becomes available only when the reloaded canonical state still permits it.

## UI behavior

Transaction feedback uses the existing compact transaction strip and Phosphor icon family. No modal, toast stack, gradient, glow, or new navigation surface is introduced.

Visible states:

- `Confirm in wallet`
- `Submitted to Studionet`
- `Accepted by the network`
- `Checking network status`
- `Syncing canonical state`
- `Transaction failed`

`cancelled` is intentionally silent after clearing the previous `Confirm in wallet` feedback. Cancellation returns the user to the unchanged form or action surface.

The strip uses `aria-live="polite"`. A deterministic failure remains a `role="alert"`. Loading and recovering states disable only conflicting writes and keep the last confirmed marketplace visible when available. Color is never the only status indicator.

Manual `Retry transaction` is removed. Manual `Retry state read` may remain only as a last-resort control after the automatic read budget is exhausted; ordinary transient failures should resolve without exposing it.

## Data and safety invariants

- One user action calls `writeContract` at most once.
- No retry path calls `writeContract` after a hash is known.
- Wallet cancellation never changes canonical state and never becomes a failed transaction claim.
- A transient read failure never produces an empty successful snapshot.
- Post-finality navigation occurs only after canonical reload succeeds.
- Existing forms retain values after wallet cancellation or uncertain submission.
- Value-bearing inputs remain unchanged: offer and request each send exactly 1 GEN; every other existing action preserves its current value.
- No local-storage value is treated as canonical contract state.

## Testing strategy

### Error normalization

- Direct provider code `4001` maps to `wallet_cancelled`.
- Nested `cause`, `data`, and SDK-wrapped code `4001` map to `wallet_cancelled`.
- Explicit denial messages without a usable code map to `wallet_cancelled`.
- Network, timeout, 429, and 5xx messages map to transient categories.
- Contract reverts remain deterministic failures.

### Adapter tests

- Parameterized coverage proves all eight write wrappers use the same `execute()` policy.
- Wallet cancellation emits `wallet`, then `cancelled`, calls `writeContract` once, and performs no status poll.
- Uncertain submission calls `writeContract` once and never resubmits.
- A known hash survives multiple transient status errors and reaches finalized without another write.
- Accepted is emitted once even when returned by several polls.
- Terminal statuses fail without claiming finality.
- Canonical reads retry transient failures and do not retry deterministic failures.

### React tests

- Wallet cancellation removes the transaction strip, shows no alert, preserves form values, and restores the original CTA.
- No `Retry transaction` control is rendered for any error class.
- Recovery states keep the last confirmed snapshot visible.
- Finality followed by successful canonical reload clears the transaction strip.
- Exhausted canonical reads preserve the last snapshot and show a contextual manual state-read fallback.
- `online` and focus refresh canonical state but never call a write method.

### Runtime verification

- Run the complete project `npm run check` command.
- Deploy the verified frontend to the existing Vercel production project.
- In Chrome with the real wallet, exercise wallet cancellation on a safe action and confirm the original CTA returns without an error or retry button.
- Resume the existing finalized QA lifecycle through `consume_grant` and `withdraw_credit`, signing manually and confirming every submitted/accepted/finalized transition plus canonical state reload.
- Preserve safe evidence fields only: function name, abbreviated transaction hash, lifecycle state, canonical round phase, grant status, and withdrawable GEN.

## Acceptance criteria

1. Ordinary transient Studionet failures require no user retry action across all eight writes and canonical reads.
2. Closing or rejecting a wallet request returns to the original action without an error banner or retry button.
3. No automatic or manual recovery closure can double-submit a transaction.
4. A transaction with a known hash is followed to terminal state using only that hash.
5. Canonical state is reloaded after finality and retained during outages.
6. Existing value, authorization, lifecycle, and accounting semantics are unchanged.
7. Focused regression tests, full project checks, Vercel deployment, and Chrome lifecycle verification all pass before completion is claimed.

## Non-goals

- Automatically approving wallet requests.
- Automatically resubmitting a write with no returned hash.
- Adding a server-side RPC proxy, service worker queue, or durable transaction database.
- Changing the intelligent contract or redeploying it.
- Redesigning marketplace navigation, forms, typography, colors, or round economics.
