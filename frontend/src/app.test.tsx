import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { createUnconfiguredAdapter } from "./contractAdapter";
import type { ContractAdapter, TransactionProgress, WorkspaceSnapshot } from "./domain";
import { TransactionSubmissionUncertainError } from "./transactionRecovery";

function adapterFor(snapshot: WorkspaceSnapshot): ContractAdapter {
  return {
    subscribeTransactions: vi.fn(() => () => undefined),
    loadWorkspace: vi.fn(async () => snapshot),
    connectWallet: vi.fn(async () => "0x0000000000000000000000000000000000000001"),
    openRound: vi.fn(async () => ({ hash: "0xopen" })),
    submitOffer: vi.fn(async () => ({ hash: "0xoffer" })),
    submitRequest: vi.fn(async () => ({ hash: "0xrequest" })),
    lockRound: vi.fn(async () => ({ hash: "0xlock" })),
    clearRound: vi.fn(async () => ({ hash: "0xclear" })),
    cancelRound: vi.fn(async () => ({ hash: "0xcancel" })),
    recoverExpiredRound: vi.fn(async () => ({ hash: "0xrecover" })),
    consumeGrant: vi.fn(async () => ({ hash: "0xconsume" })),
    withdrawCredit: vi.fn(async () => ({ hash: "0xwithdraw" })),
  };
}

const ready: WorkspaceSnapshot = {
  availability: "ready",
  account: "0x0000000000000000000000000000000000000001",
  networkName: "GenLayer Studionet",
  contractAddress: "0x00000000000000000000000000000000000000aa",
  rounds: [{
    id: "round-1",
    creator: "0x0000000000000000000000000000000000000001",
    title: "Research access",
    phase: "OPEN",
    offerCount: 1,
    requestCount: 1,
    feeGen: "1",
    providerBondGen: "1",
    expired: false,
  }],
  positions: [],
  creditGen: "0",
  accountingInvariant: true,
};

describe("SkillSlot Clearing marketplace", () => {
  it("provides permanent Rounds, Create round, and My activity destinations", async () => {
    render(<App adapter={adapterFor(ready)} />);

    expect(await screen.findByRole("button", { name: "Rounds" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Create round" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "My activity" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Create round" }));
    expect(screen.getByRole("heading", { name: "Start a clearing round" })).toBeVisible();
  });

  it("keeps creation available when every canonical round is terminal", async () => {
    const terminalAdapter = adapterFor({
      ...ready,
      rounds: [{ ...ready.rounds[0], id: "round-finished", title: "Completed allocation", phase: "CLEARED" }],
    });
    render(<App adapter={terminalAdapter} />);

    await screen.findByRole("button", { name: "History" });
    fireEvent.click(screen.getByRole("button", { name: "Open round Completed allocation" }));
    expect(screen.getByRole("heading", { name: "Completed allocation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create another round" })).toBeEnabled();
  });

  it("filters all canonical rounds and opens their detail", async () => {
    const adapter = adapterFor({
      ...ready,
      rounds: [
        ready.rounds[0],
        { ...ready.rounds[0], id: "round-2", title: "Locked allocation", phase: "LOCKED" },
        { ...ready.rounds[0], id: "round-3", title: "Past allocation", phase: "CANCELLED" },
      ],
    });
    render(<App adapter={adapter} />);

    expect(await screen.findByRole("button", { name: "Open round Research access" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "In decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Open round Locked allocation" }));
    expect(screen.getByRole("heading", { name: "Locked allocation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("button", { name: "Open round Past allocation" })).toBeVisible();
  });

  it("opens a new round from the permanent creation destination and reloads canonical state", async () => {
    const next = { ...ready, rounds: [{ ...ready.rounds[0], id: "round-2", title: "New research access" }] };
    const adapter = adapterFor({ ...ready, rounds: [] });
    vi.mocked(adapter.loadWorkspace).mockResolvedValueOnce({ ...ready, rounds: [] }).mockResolvedValue(next);
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create round" }));
    fireEvent.change(screen.getByLabelText("Round ID"), { target: { value: "round-2" } });
    fireEvent.change(screen.getByLabelText("Round title"), { target: { value: "New research access" } });
    fireEvent.click(screen.getByRole("button", { name: "Open round" }));

    await waitFor(() => expect(adapter.openRound).toHaveBeenCalledWith({ roundId: "round-2", title: "New research access" }));
    await waitFor(() => expect(adapter.loadWorkspace).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "New research access" })).toBeVisible();
  });

  it("blocks invalid round identities with an inline, accessible error", async () => {
    const adapter = adapterFor({ ...ready, rounds: [] });
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create round" }));
    fireEvent.change(screen.getByLabelText("Round ID"), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText("Round title"), { target: { value: "Valid title" } });
    fireEvent.click(screen.getByRole("button", { name: "Open round" }));

    expect(await screen.findByText("Round ID must be 3 to 80 characters and use only letters, numbers, periods, underscores, or hyphens.")).toBeVisible();
    expect(adapter.openRound).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Round ID")).toHaveAttribute("aria-invalid", "true");
  });

  it("executes provider, requester, and creator actions in an open round", async () => {
    const adapter = adapterFor(ready);
    render(<App adapter={adapter} />);
    const detail = await screen.findByRole("complementary", { name: "Research access" });

    fireEvent.change(within(detail).getByLabelText("Offer ID"), { target: { value: "offer-2" } });
    fireEvent.change(within(detail).getByLabelText("Offer label"), { target: { value: "Source finder" } });
    fireEvent.change(within(detail).getByLabelText("Access promise"), { target: { value: "Find primary sources" } });
    fireEvent.change(within(detail).getByLabelText("Capability IDs"), { target: { value: "web" } });
    fireEvent.change(within(detail).getByLabelText("Agent ID"), { target: { value: "agent-2" } });
    fireEvent.change(within(detail).getByLabelText("Metadata URI"), { target: { value: "https://skillslot-clearing.vercel.app/agents/agent-2" } });
    fireEvent.change(within(detail).getByLabelText("Metadata hash"), { target: { value: "a".repeat(64) } });
    fireEvent.change(within(detail).getByLabelText("Metadata signature"), { target: { value: `SkillSlotAgentRegistry:v1:${"a".repeat(64)}` } });
    fireEvent.change(within(detail).getByLabelText("Metadata expiry"), { target: { value: "1800000000" } });
    fireEvent.click(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i }));
    await waitFor(() => expect(adapter.submitOffer).toHaveBeenCalledTimes(1));
    expect(adapter.submitOffer).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "agent-2",
      metadataIssuer: "SkillSlotAgentRegistry",
      metadataExpiresAt: "1800000000",
    }));

    fireEvent.click(within(detail).getByText("Request access"));
    fireEvent.change(within(detail).getByLabelText("Request ID"), { target: { value: "request-2" } });
    fireEvent.change(within(detail).getByLabelText("Request label"), { target: { value: "Need sources" } });
    fireEvent.change(within(detail).getByLabelText("Access need"), { target: { value: "Find authoritative sources" } });
    fireEvent.click(within(detail).getByRole("button", { name: /Submit request for 1 GEN/i }));
    await waitFor(() => expect(adapter.submitRequest).toHaveBeenCalledTimes(1));

    fireEvent.click(within(detail).getByRole("button", { name: "Lock round" }));
    await waitFor(() => expect(adapter.lockRound).toHaveBeenCalledWith("round-1"));
  });

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
      throw Object.assign(new Error("Wallet confirmation was cancelled"), {
        name: "TransactionCancelledError",
        kind: "wallet_cancelled",
      });
    });
    render(<App adapter={adapter} />);
    const detail = await screen.findByRole("complementary", { name: "Research access" });

    fireEvent.change(within(detail).getByLabelText("Offer ID"), { target: { value: "offer-2" } });
    fireEvent.change(within(detail).getByLabelText("Offer label"), { target: { value: "Source finder" } });
    fireEvent.change(within(detail).getByLabelText("Access promise"), { target: { value: "Find primary sources" } });
    fireEvent.change(within(detail).getByLabelText("Capability IDs"), { target: { value: "web" } });
    fireEvent.change(within(detail).getByLabelText("Agent ID"), { target: { value: "agent-2" } });
    fireEvent.change(within(detail).getByLabelText("Metadata URI"), { target: { value: "https://skillslot-clearing.vercel.app/agents/agent-2" } });
    fireEvent.change(within(detail).getByLabelText("Metadata hash"), { target: { value: "a".repeat(64) } });
    fireEvent.change(within(detail).getByLabelText("Metadata signature"), { target: { value: `SkillSlotAgentRegistry:v1:${"a".repeat(64)}` } });
    fireEvent.change(within(detail).getByLabelText("Metadata expiry"), { target: { value: "1800000000" } });
    fireEvent.click(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i }));

    await waitFor(() =>
      expect(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i })).toBeEnabled(),
    );
    expect(within(detail).getByLabelText("Offer ID")).toHaveValue("offer-2");
    expect(screen.queryByText("Transaction did not complete")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry transaction" })).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm in wallet")).not.toBeInTheDocument();
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

  it("shows an uncertain submission as neutral recovery while keeping canonical state", async () => {
    const adapter = adapterFor(ready);
    vi.mocked(adapter.lockRound).mockRejectedValue(
      new TransactionSubmissionUncertainError(new Error("Failed to fetch")),
    );
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Lock round" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Submission status uncertain");
    expect(status).toHaveTextContent("Transaction submission could not be confirmed");
    expect(screen.getByRole("button", { name: "Open round Research access" })).toBeVisible();
    expect(screen.queryByText("Transaction did not complete")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry transaction" })).not.toBeInTheDocument();
    expect(adapter.lockRound).toHaveBeenCalledTimes(1);
  });

  it("prevents a creator from locking an empty round", async () => {
    const adapter = adapterFor({ ...ready, rounds: [{ ...ready.rounds[0], offerCount: 0, requestCount: 0 }] });
    render(<App adapter={adapter} />);

    expect(await screen.findByRole("button", { name: "Lock round" })).toBeDisabled();
  });

  it("supports clear, grant consumption, and withdrawal from canonical activity", async () => {
    const lockedAdapter = adapterFor({ ...ready, rounds: [{ ...ready.rounds[0], phase: "RETRYABLE" }] });
    const { unmount } = render(<App adapter={lockedAdapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry semantic clearing" }));
    await waitFor(() => expect(lockedAdapter.clearRound).toHaveBeenCalledWith("round-1"));
    unmount();

    const activityAdapter = adapterFor({
      ...ready,
      rounds: [{ ...ready.rounds[0], phase: "CLEARED" }],
      creditGen: "1",
      positions: [{ id: "round-1:request-1", roundId: "round-1", requestId: "request-1", kind: "grant", status: "ACTIVE", summary: "Route to offer-1" }],
    });
    render(<App adapter={activityAdapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "My activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Consume grant" }));
    await waitFor(() => expect(activityAdapter.consumeGrant).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Withdraw 1 GEN" }));
    await waitFor(() => expect(activityAdapter.withdrawCredit).toHaveBeenCalledWith("1000000000000000000"));
  });

  it("exposes permissionless timeout recovery only after canonical expiry", async () => {
    const adapter = adapterFor({ ...ready, rounds: [{ ...ready.rounds[0], phase: "LOCKED", expired: true }] });
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Recover expired round" }));

    await waitFor(() => expect(adapter.recoverExpiredRound).toHaveBeenCalledWith("round-1"));
  });

  it("shows honest unconfigured state without reviewer internals or invented market state", async () => {
    const { container } = render(<App adapter={createUnconfiguredAdapter()} />);

    expect(await screen.findByText("Contract not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeDisabled();
    expect(container).not.toHaveTextContent(/compatibility matrix|attempt id|sample round/i);
  });

  it("connects a real wallet adapter and reloads canonical state", async () => {
    const disconnected = adapterFor({ ...ready, account: null });
    render(<App adapter={disconnected} />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect wallet" }));
    await waitFor(() => expect(disconnected.connectWallet).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(disconnected.loadWorkspace).toHaveBeenCalledTimes(2));
  });

  it("returns to connect wallet silently when the connection request is cancelled", async () => {
    const disconnected = adapterFor({ ...ready, account: null });
    vi.mocked(disconnected.connectWallet).mockRejectedValue(
      Object.assign(new Error("User rejected the request"), { code: 4001 }),
    );
    render(<App adapter={disconnected} />);

    const connectButton = await screen.findByRole("button", { name: "Connect wallet" });
    fireEvent.click(connectButton);

    await waitFor(() => expect(connectButton).toBeEnabled());
    expect(disconnected.connectWallet).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Transaction did not complete")).not.toBeInTheDocument();
    expect(screen.queryByText("User rejected the request")).not.toBeInTheDocument();
  });

  it("renders lifecycle progress emitted by the supplied wallet adapter", async () => {
    const adapter = adapterFor(ready);
    let emit: ((progress: TransactionProgress) => void) | undefined;
    vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    render(<App adapter={adapter} />);
    await screen.findByRole("heading", { name: "Find a clearing round" });

    act(() => emit?.({ stage: "wallet", hash: "", functionName: "submit_offer" }));
    expect(screen.getByText("Confirm in wallet")).toBeVisible();
    act(() => emit?.({ stage: "finalized", hash: "0x1234567890abcdef", functionName: "submit_offer" }));
    expect(screen.getByText("Finalized")).toBeVisible();
  });

  it("shows recovery feedback without discarding the confirmed marketplace", async () => {
    const adapter = adapterFor(ready);
    let emit: ((progress: TransactionProgress) => void) | undefined;
    vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    render(<App adapter={adapter} />);
    await screen.findByRole("heading", { name: "Find a clearing round" });

    act(() =>
      emit?.({
        stage: "recovering",
        hash: "0x1234567890abcdef",
        functionName: "clear_round",
        reason: "status_poll",
      }),
    );

    expect(screen.getByText("Checking network status")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open round Research access" })).toBeVisible();
  });

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
    expect(adapter.recoverExpiredRound).not.toHaveBeenCalled();
    expect(adapter.consumeGrant).not.toHaveBeenCalled();
    expect(adapter.withdrawCredit).not.toHaveBeenCalled();
  });

  it("finishes canonical sync on reconnect without replaying the finalized write", async () => {
    const adapter = adapterFor(ready);
    let emit: ((progress: TransactionProgress) => void) | undefined;
    vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    vi.mocked(adapter.loadWorkspace)
      .mockResolvedValueOnce(ready)
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({ ...ready, rounds: [{ ...ready.rounds[0], phase: "LOCKED" }] });
    vi.mocked(adapter.lockRound).mockImplementation(async () => {
      emit?.({ stage: "finalized", hash: "0x1234567890abcdef", functionName: "lock_round" });
      return { hash: "0x1234567890abcdef" };
    });
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Lock round" }));

    expect(await screen.findByText("Syncing canonical state")).toBeVisible();
    expect(await screen.findByText("503 Service Unavailable")).toBeVisible();
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(adapter.loadWorkspace).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText("Syncing canonical state")).not.toBeInTheDocument());
    expect(adapter.lockRound).toHaveBeenCalledTimes(1);
  });

  it("clears the finality notice after canonical state reload succeeds", async () => {
    const adapter = adapterFor(ready);
    let emit: ((progress: TransactionProgress) => void) | undefined;
    vi.mocked(adapter.subscribeTransactions).mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    vi.mocked(adapter.lockRound).mockImplementation(async () => {
      emit?.({ stage: "finalized", hash: "0x1234567890abcdef", functionName: "lock_round" });
      return { hash: "0x1234567890abcdef" };
    });
    render(<App adapter={adapter} />);

    fireEvent.click(await screen.findByRole("button", { name: "Lock round" }));

    await waitFor(() => expect(adapter.loadWorkspace).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Finalized")).not.toBeInTheDocument());
  });
});
