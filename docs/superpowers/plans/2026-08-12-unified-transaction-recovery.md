# Unified Transaction Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every SkillSlot frontend action recover safely from transient Studionet failures while treating wallet rejection as cancellation and preventing duplicate writes.

**Architecture:** Add a small transaction-recovery module that classifies nested wallet, SDK, and RPC errors. Keep all eight writes behind the adapter's single `execute()` boundary, emit typed lifecycle events, and let React present cancellation, recovery, and deterministic failure without retaining replay closures. Canonical reads remain bounded and retryable; browser online/focus events trigger reads only.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, GenLayerJS 1.1.8, Viem wallet provider, native CSS, Vite 8, Vercel

## Global Constraints

- The browser wallet remains the only signer. Never auto-approve or repeatedly open confirmation prompts.
- Call `writeContract` at most once for one user action.
- Once a hash exists, recovery may only read the status of that hash.
- Canonical contract views remain the source of truth; never replace the last confirmed snapshot with an invented empty success state.
- Do not add a backend, RPC proxy, service worker queue, durable transaction database, dependency, contract change, or contract redeployment.
- Preserve all eight existing write methods and their current GEN values.
- Preserve navigation, form order, labels, brand tokens, Phosphor icons, and the existing light trust-first visual system.
- UI copy contains no em dash or en dash characters.
- Run `npm run check` after frontend changes and verify production through Chrome after deploying to the existing Vercel project.

## File Structure

- Create `frontend/src/transactionRecovery.ts`: normalized error classes, nested error inspection, and retry predicates.
- Create `frontend/src/transactionRecovery.test.ts`: focused classification tests for wallet cancellation, transient transport, status indexing, and deterministic failures.
- Modify `frontend/src/domain.ts`: typed `cancelled` and `recovering` progress states plus recovery reasons.
- Modify `frontend/src/contractAdapter.ts`: apply the shared policy to canonical reads and the single execution boundary used by all eight writes.
- Modify `frontend/src/contractAdapter.test.ts`: prove cancellation behavior, uncertain submission, known-hash recovery, terminal status handling, and wrapper coverage.
- Modify `frontend/src/App.tsx`: remove replay closures, handle cancellation silently, preserve canonical data, and refresh on online/focus.
- Modify `frontend/src/app.test.tsx`: prove the user-facing lifecycle and no-write recovery triggers.
- Modify `frontend/src/styles.css` only if the existing transaction strip lacks a distinguishable recovery state after the behavior tests pass.

---

### Task 1: Normalize wallet and RPC failures

**Files:**
- Create: `frontend/src/transactionRecovery.ts`
- Create: `frontend/src/transactionRecovery.test.ts`

**Interfaces:**
- Produces: `TransactionErrorKind`, `TransactionCancelledError`, `classifyTransactionError(error)`, `isTransactionCancelled(error)`, `isTransientReadError(error)`, and `isTransientStatusError(error)`.
- Consumes: unknown provider/SDK/RPC errors. No browser or React dependency.

- [ ] **Step 1: Write the failing classification tests**

Create `frontend/src/transactionRecovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  classifyTransactionError,
  isTransactionCancelled,
  isTransientReadError,
  isTransientStatusError,
  TransactionCancelledError,
} from "./transactionRecovery";

describe("transaction recovery classification", () => {
  it.each([
    Object.assign(new Error("User rejected the request"), { code: 4001 }),
    { cause: { code: 4001, message: "denied" } },
    { data: { cause: new Error("Request Signature: User denied request signature") } },
  ])("maps wallet rejection to cancellation", (error) => {
    expect(classifyTransactionError(error)).toBe("wallet_cancelled");
    expect(isTransactionCancelled(new TransactionCancelledError(error))).toBe(true);
  });

  it.each([
    new Error("Failed to fetch"),
    new Error("429 Too Many Requests"),
    new Error("503 Service Unavailable"),
    { cause: new Error("network timeout") },
  ])("maps transient read failures", (error) => {
    expect(isTransientReadError(error)).toBe(true);
  });

  it("treats indexing misses as status-only transient failures", () => {
    const error = new Error("transaction not found while indexing");
    expect(isTransientStatusError(error)).toBe(true);
    expect(isTransientReadError(error)).toBe(false);
  });

  it("does not retry deterministic contract failures", () => {
    const error = new Error("Contract method not found");
    expect(classifyTransactionError(error)).toBe("deterministic_failure");
    expect(isTransientReadError(error)).toBe(false);
    expect(isTransientStatusError(error)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/transactionRecovery.test.ts`

Expected: FAIL because `./transactionRecovery` does not exist.

- [ ] **Step 3: Implement the normalized classifier**

Create `frontend/src/transactionRecovery.ts`:

```ts
export type TransactionErrorKind =
  | "wallet_cancelled"
  | "submission_uncertain"
  | "rpc_transient"
  | "deterministic_failure";

function nestedValues(error: unknown, seen = new Set<unknown>()): unknown[] {
  if (!error || typeof error !== "object" || seen.has(error)) return [error];
  seen.add(error);
  const value = error as Record<string, unknown>;
  return [error, ...[value.cause, value.data, value.error].flatMap((item) => nestedValues(item, seen))];
}

function messages(error: unknown) {
  return nestedValues(error)
    .map((item) => item instanceof Error ? item.message : typeof item === "string" ? item : "")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function codes(error: unknown) {
  return nestedValues(error)
    .map((item) => item && typeof item === "object" ? Number((item as { code?: unknown }).code) : NaN)
    .filter(Number.isFinite);
}

export function classifyTransactionError(error: unknown): TransactionErrorKind {
  const message = messages(error);
  if (error && typeof error === "object") {
    const tagged = error as { kind?: unknown; name?: unknown };
    if (tagged.kind === "wallet_cancelled" || tagged.name === "TransactionCancelledError") return "wallet_cancelled";
  }
  if (codes(error).includes(4001) || ["user rejected", "user denied", "request signature: user denied"].some((part) => message.includes(part))) {
    return "wallet_cancelled";
  }
  if (["failed to fetch", "network", "timeout", "temporarily", "429", "502", "503", "504"].some((part) => message.includes(part))) {
    return "rpc_transient";
  }
  return "deterministic_failure";
}

export class TransactionCancelledError extends Error {
  readonly kind = "wallet_cancelled";
  constructor(readonly originalError: unknown) {
    super("Wallet confirmation was cancelled");
    this.name = "TransactionCancelledError";
  }
}

export function isTransactionCancelled(error: unknown): error is TransactionCancelledError {
  return error instanceof TransactionCancelledError || classifyTransactionError(error) === "wallet_cancelled";
}

export function isTransientReadError(error: unknown) {
  return classifyTransactionError(error) === "rpc_transient";
}

export function isTransientStatusError(error: unknown) {
  const message = messages(error);
  return isTransientReadError(error) || message.includes("not found") || message.includes("index");
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/transactionRecovery.test.ts`

Expected: 1 test file passes with all classification cases green.

- [ ] **Step 5: Commit the classification boundary**

```powershell
git add -- frontend/src/transactionRecovery.ts frontend/src/transactionRecovery.test.ts
git commit -m "feat: classify wallet and RPC recovery errors"
```

---

### Task 2: Apply one execution policy to all eight writes

**Files:**
- Modify: `frontend/src/domain.ts`
- Modify: `frontend/src/contractAdapter.ts`
- Modify: `frontend/src/contractAdapter.test.ts`

**Interfaces:**
- Consumes: `TransactionCancelledError`, `classifyTransactionError`, `isTransientReadError`, and `isTransientStatusError` from Task 1.
- Produces: `TransactionProgress` stages `wallet`, `submitted`, `accepted`, `recovering`, `finalized`, `cancelled`, and `failed`; `TransactionRecoveryReason = "submission_uncertain" | "status_poll" | "canonical_sync"`.

- [ ] **Step 1: Write failing adapter tests for cancellation and uncertain submission**

Append to `frontend/src/contractAdapter.test.ts`:

```ts
it("treats wallet rejection as cancellation without polling or retrying the write", async () => {
  const { readClient, writeClient } = clients();
  vi.mocked(writeClient.writeContract).mockRejectedValue(Object.assign(new Error("User rejected"), { code: 4001 }));
  const progress = vi.fn();
  const adapter = createGenLayerAdapter({
    contractAddress: address,
    clients: () => ({ readClient, writeClient, account }),
    onTransaction: progress,
    pollIntervalMs: 0,
  });

  await expect(adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" })).rejects.toMatchObject({ name: "TransactionCancelledError" });
  expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
  expect(readClient.request).not.toHaveBeenCalled();
  expect(progress.mock.calls.map(([event]) => event.stage)).toEqual(["wallet", "cancelled"]);
});

it("marks a transient pre-hash write failure uncertain and never resubmits", async () => {
  const { readClient, writeClient } = clients();
  vi.mocked(writeClient.writeContract).mockRejectedValue(new Error("Failed to fetch"));
  const progress = vi.fn();
  const adapter = createGenLayerAdapter({
    contractAddress: address,
    clients: () => ({ readClient, writeClient, account }),
    onTransaction: progress,
    pollIntervalMs: 0,
  });

  await expect(adapter.withdrawCredit(ONE_GEN_WEI.toString())).rejects.toThrow("Transaction submission could not be confirmed");
  expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
  expect(readClient.request).not.toHaveBeenCalled();
  expect(progress.mock.calls.map(([event]) => [event.stage, event.reason])).toEqual([
    ["wallet", undefined],
    ["recovering", "submission_uncertain"],
  ]);
});
```

- [ ] **Step 2: Write failing tests for known-hash recovery and all wrapper mappings**

Add these cases:

```ts
it("keeps one known hash through transient status failures", async () => {
  const { readClient, writeClient } = clients();
  vi.mocked(readClient.request)
    .mockRejectedValueOnce(new Error("503 Service Unavailable"))
    .mockResolvedValueOnce("ACCEPTED")
    .mockResolvedValueOnce("FINALIZED");
  const progress = vi.fn();
  const adapter = createGenLayerAdapter({
    contractAddress: address,
    clients: () => ({ readClient, writeClient, account }),
    onTransaction: progress,
    pollIntervalMs: 0,
    maxPolls: 3,
  });

  await expect(adapter.lockRound("round-1")).resolves.toEqual({ hash: "0xhash" });
  expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
  expect(progress.mock.calls.map(([event]) => event.stage)).toEqual([
    "wallet", "submitted", "recovering", "accepted", "finalized",
  ]);
});

it.each([
  ["open_round", (adapter: ContractAdapter) => adapter.openRound({ roundId: "round-2", title: "Round" })],
  ["submit_offer", (adapter: ContractAdapter) => adapter.submitOffer({ roundId: "round-1", offerId: "offer-2", label: "Agent", promise: "Find sources", capabilityIds: "web" })],
  ["submit_request", (adapter: ContractAdapter) => adapter.submitRequest({ roundId: "round-1", requestId: "request-2", label: "Need", need: "Find sources", requiredIds: "web", excludedIds: "" })],
  ["lock_round", (adapter: ContractAdapter) => adapter.lockRound("round-1")],
  ["clear_round", (adapter: ContractAdapter) => adapter.clearRound("round-1")],
  ["cancel_round", (adapter: ContractAdapter) => adapter.cancelRound("round-1")],
  ["consume_grant", (adapter: ContractAdapter) => adapter.consumeGrant({ roundId: "round-1", requestId: "request-1" })],
  ["withdraw_credit", (adapter: ContractAdapter) => adapter.withdrawCredit(ONE_GEN_WEI.toString())],
])("routes %s through the shared cancellation policy", async (functionName, invoke) => {
  const { readClient, writeClient } = clients();
  vi.mocked(writeClient.writeContract).mockRejectedValue(Object.assign(new Error("User denied"), { code: 4001 }));
  const adapter = createGenLayerAdapter({ contractAddress: address, clients: () => ({ readClient, writeClient, account }), pollIntervalMs: 0 });

  await expect(invoke(adapter)).rejects.toMatchObject({ name: "TransactionCancelledError" });
  expect(writeClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName }));
  expect(writeClient.writeContract).toHaveBeenCalledTimes(1);
});
```

Import `ContractAdapter` from `./domain` for the parameterized test.

- [ ] **Step 3: Run adapter tests and verify RED**

Run: `npm test -- src/contractAdapter.test.ts`

Expected: FAIL because `cancelled`, `recovering`, recovery reasons, and cancellation errors are not implemented.

- [ ] **Step 4: Extend the domain lifecycle types**

Change `frontend/src/domain.ts` to:

```ts
export type TransactionRecoveryReason = "submission_uncertain" | "status_poll" | "canonical_sync";

export type TransactionStage =
  | "wallet"
  | "submitted"
  | "accepted"
  | "recovering"
  | "finalized"
  | "cancelled"
  | "failed";

export interface TransactionProgress {
  stage: TransactionStage;
  hash: string;
  functionName: string;
  reason?: TransactionRecoveryReason;
  error?: string;
}
```

- [ ] **Step 5: Replace local error predicates and implement the shared execute policy**

In `frontend/src/contractAdapter.ts`, import the Task 1 helpers and remove the local `errorMessage`, `isTransientReadError`, and `isTransientStatusError` functions.

Replace the `writeContract` portion of `execute()` with:

```ts
emitTransaction({ stage: "wallet", hash, functionName });
try {
  hash = String(await writeClient.writeContract({ address: contractAddress, functionName, args, value }));
} catch (error) {
  const kind = classifyTransactionError(error);
  if (kind === "wallet_cancelled") {
    emitTransaction({ stage: "cancelled", hash, functionName });
    throw new TransactionCancelledError(error);
  }
  if (kind === "rpc_transient") {
    emitTransaction({ stage: "recovering", hash, functionName, reason: "submission_uncertain" });
    throw new Error("Transaction submission could not be confirmed. Canonical state will be checked before another action is allowed.");
  }
  throw error;
}
emitTransaction({ stage: "submitted", hash, functionName });
```

Inside the status-poll catch, emit recovery before pausing:

```ts
if (!isTransientStatusError(error) || poll === maxPolls - 1) throw error;
emitTransaction({ stage: "recovering", hash, functionName, reason: "status_poll" });
await pause(Math.min(pollIntervalMs * (2 ** Math.min(poll, 4)), 20_000));
continue;
```

In the outer catch, do not emit `failed` for `TransactionCancelledError`, and do not overwrite the earlier `recovering` event for the exact uncertain-submission message:

```ts
if (isTransactionCancelled(error) || (error instanceof Error && error.message.startsWith("Transaction submission could not be confirmed"))) {
  throw error;
}
emitTransaction({
  stage: "failed",
  hash,
  functionName,
  error: error instanceof Error ? error.message : "Transaction failed",
});
throw error;
```

- [ ] **Step 6: Run focused adapter and classifier tests**

Run: `npm test -- src/transactionRecovery.test.ts src/contractAdapter.test.ts`

Expected: both test files pass; all eight wrappers call `writeContract` once on cancellation.

- [ ] **Step 7: Commit the shared adapter policy**

```powershell
git add -- frontend/src/domain.ts frontend/src/contractAdapter.ts frontend/src/contractAdapter.test.ts
git commit -m "feat: unify transaction recovery across writes"
```

---

### Task 3: Remove write replay and make cancellation silent in React

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/app.test.tsx`

**Interfaces:**
- Consumes: `TransactionProgress` and `isTransactionCancelled()` from Tasks 1 and 2.
- Produces: `runWrite()` with no retained action closure, silent wallet cancellation, canonical reload after uncertain/deterministic failures, and no `Retry transaction` control.

- [ ] **Step 1: Replace the old retry test with failing cancellation and no-replay tests**

Remove `preserves form values and retries the same failed transaction` from `frontend/src/app.test.tsx` and add:

```ts
it("returns to the original action after wallet cancellation without an error or retry control", async () => {
  const adapter = adapterFor(ready);
  let emit: ((progress: TransactionProgress) => void) | undefined;
  vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
    emit = listener;
    return () => undefined;
  });
  vi.mocked(adapter.submitOffer).mockImplementation(async () => {
    emit?.({ stage: "wallet", hash: "", functionName: "submit_offer" });
    emit?.({ stage: "cancelled", hash: "", functionName: "submit_offer" });
    throw Object.assign(new Error("Wallet confirmation was cancelled"), { name: "TransactionCancelledError", kind: "wallet_cancelled" });
  });
  render(<App adapter={adapter} />);
  const detail = await screen.findByRole("complementary", { name: "Research access" });

  fireEvent.change(within(detail).getByLabelText("Offer ID"), { target: { value: "offer-2" } });
  fireEvent.change(within(detail).getByLabelText("Offer label"), { target: { value: "Source finder" } });
  fireEvent.change(within(detail).getByLabelText("Access promise"), { target: { value: "Find primary sources" } });
  fireEvent.change(within(detail).getByLabelText("Capability IDs"), { target: { value: "web" } });
  fireEvent.click(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i }));

  await waitFor(() => expect(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i })).toBeEnabled());
  expect(within(detail).getByLabelText("Offer ID")).toHaveValue("offer-2");
  expect(screen.queryByText("Transaction did not complete")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry transaction" })).not.toBeInTheDocument();
  expect(screen.queryByText("Waiting for wallet confirmation")).not.toBeInTheDocument();
});

it("never renders a write replay control after a deterministic failure", async () => {
  const adapter = adapterFor(ready);
  vi.mocked(adapter.lockRound).mockRejectedValue(new Error("Only the creator can lock this round"));
  render(<App adapter={adapter} />);

  fireEvent.click(await screen.findByRole("button", { name: "Lock round" }));

  expect(await screen.findByText("Only the creator can lock this round")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Retry transaction" })).not.toBeInTheDocument();
  expect(adapter.lockRound).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add a failing UI lifecycle test for recovering states**

```ts
it("shows recovery feedback without discarding the confirmed marketplace", async () => {
  const adapter = adapterFor(ready);
  let emit: ((progress: TransactionProgress) => void) | undefined;
  vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
    emit = listener;
    return () => undefined;
  });
  render(<App adapter={adapter} />);
  await screen.findByRole("heading", { name: "Find a clearing round" });

  act(() => emit?.({ stage: "recovering", hash: "0x1234567890abcdef", functionName: "clear_round", reason: "status_poll" }));

  expect(screen.getByText("Checking network status")).toBeVisible();
  expect(screen.getByRole("button", { name: "Open round Research access" })).toBeVisible();
});
```

- [ ] **Step 3: Run the React test and verify RED**

Run: `npm test -- src/app.test.tsx`

Expected: FAIL because the old `FailedWrite` replay control exists and `recovering`/`cancelled` labels are missing.

- [ ] **Step 4: Remove replay closures and implement the approved state handling**

In `frontend/src/App.tsx`:

1. Delete `FailedWrite`, `failedWrite`, and all `setFailedWrite` calls.
2. Import `isTransactionCancelled` from `./transactionRecovery`.
3. Change `runWrite` to:

```ts
const runWrite: RunWrite = async (action, afterFinalized) => {
  setBusy(true);
  setActionError(null);
  try {
    await action();
    setTransaction((current) => current ? { ...current, stage: "recovering", reason: "canonical_sync" } : current);
    const next = await refresh();
    if (next) {
      setTransaction(null);
      if (afterFinalized) afterFinalized(next);
    }
  } catch (error) {
    if (isTransactionCancelled(error)) {
      setTransaction(null);
      return;
    }
    const next = await refresh();
    if (transactionRef.current?.reason === "submission_uncertain" && next) {
      setTransaction(null);
    }
    setActionError(error instanceof Error ? error.message : "Transaction failed.");
  } finally {
    setBusy(false);
  }
};
```

Avoid reading stale React state inside the catch. Import `useRef`, replace the direct subscription effect with this exact ref-backed subscription, and use the ref for the `submission_uncertain` check:

```ts
const transactionRef = useRef<TransactionProgress | null>(null);

useEffect(() => adapter.subscribeTransactions((progress) => {
  transactionRef.current = progress;
  setTransaction(progress);
}), [adapter]);
```

4. Replace the action error markup with no replay button:

```tsx
{actionError ? (
  <section className="notice notice-danger" role="alert">
    <ShieldWarning aria-hidden="true" />
    <div><p className="notice-title">Transaction did not complete</p><p>{actionError}</p></div>
  </section>
) : null}
```

5. Extend `TransactionNotice` labels:

```ts
const labels: Record<TransactionProgress["stage"], string> = {
  wallet: "Confirm in wallet",
  submitted: "Submitted to Studionet",
  accepted: "Accepted by the network",
  recovering: transaction.reason === "canonical_sync" ? "Syncing canonical state" : "Checking network status",
  finalized: "Finalized",
  cancelled: "Cancelled",
  failed: "Transaction failed",
};
```

Do not render the notice when `transaction.stage === "cancelled"`.

- [ ] **Step 5: Run React tests and verify GREEN**

Run: `npm test -- src/app.test.tsx`

Expected: all app tests pass, cancellation is silent, and no write replay control exists.

- [ ] **Step 6: Commit the React recovery UX**

```powershell
git add -- frontend/src/App.tsx frontend/src/app.test.tsx
git commit -m "feat: make wallet cancellation non-error UI"
```

---

### Task 4: Refresh canonical state automatically on network return

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/app.test.tsx`
- Modify: `frontend/src/styles.css` only if the recovery strip cannot be distinguished with existing styles.

**Interfaces:**
- Consumes: the existing memoized `refresh()` callback.
- Produces: window `online` and `focus` listeners that call only `adapter.loadWorkspace()` through `refresh()` and clean up on unmount.

- [ ] **Step 1: Write the failing online/focus test**

Add to `frontend/src/app.test.tsx`:

```ts
it("refreshes canonical state on online and focus without replaying a write", async () => {
  const adapter = adapterFor(ready);
  render(<App adapter={adapter} />);
  await waitFor(() => expect(adapter.loadWorkspace).toHaveBeenCalledTimes(1));

  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("focus"));

  await waitFor(() => expect(adapter.loadWorkspace).toHaveBeenCalledTimes(3));
  expect(adapter.openRound).not.toHaveBeenCalled();
  expect(adapter.submitOffer).not.toHaveBeenCalled();
  expect(adapter.submitRequest).not.toHaveBeenCalled();
  expect(adapter.lockRound).not.toHaveBeenCalled();
  expect(adapter.clearRound).not.toHaveBeenCalled();
  expect(adapter.cancelRound).not.toHaveBeenCalled();
  expect(adapter.consumeGrant).not.toHaveBeenCalled();
  expect(adapter.withdrawCredit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/app.test.tsx -t "refreshes canonical state on online and focus"`

Expected: FAIL because the event listeners do not exist.

- [ ] **Step 3: Add bounded read-only recovery triggers**

Add this effect after the initial refresh effect in `frontend/src/App.tsx`:

```ts
useEffect(() => {
  const recoverCanonicalState = () => void refresh();
  window.addEventListener("online", recoverCanonicalState);
  window.addEventListener("focus", recoverCanonicalState);
  return () => {
    window.removeEventListener("online", recoverCanonicalState);
    window.removeEventListener("focus", recoverCanonicalState);
  };
}, [refresh]);
```

Keep the existing last-good `snapshot` when refresh fails. Do not call `setSnapshot(initialSnapshot)` in any error branch.

- [ ] **Step 4: Run focused and full frontend tests**

Run: `npm test -- src/app.test.tsx`

Then run: `npm test`

Expected: all frontend test files pass with no unhandled promise rejection.

- [ ] **Step 5: Run UI pre-flight checks**

Inspect `frontend/src/App.tsx` and `frontend/src/styles.css` and confirm:

- Transaction states use text plus icon, not color alone.
- Buttons remain single-line and disabled during writes.
- `aria-live="polite"` remains on lifecycle feedback; deterministic errors remain `role="alert"`.
- No em dash or en dash exists in visible copy.
- Existing Phosphor icon family, accent color, radius scale, focus states, and responsive navigation remain unchanged.
- No new animation exceeds the approved motion dial of 2.

Run: `rg -n "—|–|Retry transaction" frontend/src`

Expected: no visible-copy dash matches and no `Retry transaction` implementation remains. A historical assertion is allowed only if it proves absence.

- [ ] **Step 6: Commit automatic canonical recovery**

```powershell
git add -- frontend/src/App.tsx frontend/src/app.test.tsx frontend/src/styles.css
git commit -m "feat: refresh canonical state on reconnect"
```

If `frontend/src/styles.css` is unchanged, omit it from `git add`.

---

### Task 5: Verify, deploy, and complete the paused lifecycle

**Files:**
- Review only: all changed frontend files
- Runtime target: `https://skillslot-clearing.vercel.app/`
- Canonical round: `qa-browser-20260812-01`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: fresh local verification, production deployment, Chrome evidence for cancellation and the remaining lifecycle, and a clean public repository state.

- [ ] **Step 1: Run fresh full verification**

From the project root run:

```powershell
npm run check
```

Expected:

- `genvm-lint check` passes for the SkillSlot contract.
- All static, direct-mode, receipt-parser, tooling, and frontend tests pass.
- Frontend TypeScript and Vite production build exit 0.

- [ ] **Step 2: Review the final diff and public hygiene**

Run:

```powershell
git diff --check
git status --short
git diff --name-only ab45516..HEAD
git rev-parse --show-toplevel
git ls-files
```

Confirm the repository root is `skillslot-clearing`, only intended frontend/spec/plan files changed, no `.env`, key, wallet material, `AGENTS.md`, master prompt, parent workspace file, or generated Vercel directory is tracked, and ignored local Vercel linkage still exists.

- [ ] **Step 3: Deploy the verified frontend to production**

Run from `frontend/`:

```powershell
npx vercel deploy --prod --yes
```

Expected: deployment `READY`, target `production`, and alias `https://skillslot-clearing.vercel.app`.

- [ ] **Step 4: Verify wallet cancellation in Chrome**

On the production webapp with the connected authorized wallet:

1. Open any currently safe action that has not been submitted.
2. Close or reject the wallet confirmation.
3. Confirm no transaction hash appears.
4. Confirm the original CTA re-enables.
5. Confirm form values remain if the action uses a form.
6. Confirm no `Transaction did not complete` alert and no `Retry transaction` button appears.

Do not submit a duplicate value-bearing position merely to test cancellation. Prefer the next lifecycle action and reject before signature only if canonical state proves it remains available.

- [ ] **Step 5: Resume the paused canonical lifecycle through the webapp**

Use Chrome and the production app only:

1. Open `My activity` and confirm grant `qa-browser-20260812-01:request-browser-qa` is `ACTIVE` and withdrawable credit is `2 GEN`.
2. Click `Consume grant`, have the user approve the wallet prompt, observe submitted/accepted/finalized, and reload canonical state.
3. Confirm the grant is `CONSUMED` or no longer offers the consume action.
4. Click `Withdraw 2 GEN`, have the user approve, observe submitted/accepted/finalized, and reload canonical state.
5. Confirm withdrawable credit is `0 GEN`, the withdraw button is disabled, and the accounting view still reports its invariant through the loaded snapshot.

Never use a script or CLI write as a substitute for these browser actions.

- [ ] **Step 6: Push and verify CI**

Before push, repeat the exact public-hygiene review required by the project instructions. Then run:

```powershell
git push origin main
gh run list --commit (git rev-parse HEAD) --limit 5 --json databaseId,status,conclusion,name,url,headSha
gh run watch <run-id> --exit-status
```

Expected: the GitHub `check` workflow completes successfully for the final commit.

- [ ] **Step 7: Report evidence and residual limits**

Report:

- Root causes fixed and the wallet-cancellation safety boundary.
- Exact commit, Vercel deployment URL, CI URL, and fresh test counts from command output.
- Safe transaction evidence for consume and withdraw using abbreviated hashes only.
- Final canonical round phase, grant status, and withdrawable GEN.
- Any remaining external Studionet latency or wallet-extension limitation without claiming it is eliminated.
