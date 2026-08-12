import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { createUnconfiguredAdapter } from "./contractAdapter";
import type { ContractAdapter, TransactionProgress, WorkspaceSnapshot } from "./domain";

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
    fireEvent.click(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i }));
    await waitFor(() => expect(adapter.submitOffer).toHaveBeenCalledTimes(1));

    fireEvent.click(within(detail).getByText("Request access"));
    fireEvent.change(within(detail).getByLabelText("Request ID"), { target: { value: "request-2" } });
    fireEvent.change(within(detail).getByLabelText("Request label"), { target: { value: "Need sources" } });
    fireEvent.change(within(detail).getByLabelText("Access need"), { target: { value: "Find authoritative sources" } });
    fireEvent.click(within(detail).getByRole("button", { name: /Submit request for 1 GEN/i }));
    await waitFor(() => expect(adapter.submitRequest).toHaveBeenCalledTimes(1));

    fireEvent.click(within(detail).getByRole("button", { name: "Lock round" }));
    await waitFor(() => expect(adapter.lockRound).toHaveBeenCalledWith("round-1"));
  });

  it("preserves form values and retries the same failed transaction", async () => {
    const adapter = adapterFor(ready);
    vi.mocked(adapter.submitOffer)
      .mockRejectedValueOnce(new Error("Wallet rejected the first attempt"))
      .mockResolvedValueOnce({ hash: "0xoffer" });
    render(<App adapter={adapter} />);
    const detail = await screen.findByRole("complementary", { name: "Research access" });

    fireEvent.change(within(detail).getByLabelText("Offer ID"), { target: { value: "offer-2" } });
    fireEvent.change(within(detail).getByLabelText("Offer label"), { target: { value: "Source finder" } });
    fireEvent.change(within(detail).getByLabelText("Access promise"), { target: { value: "Find primary sources" } });
    fireEvent.change(within(detail).getByLabelText("Capability IDs"), { target: { value: "web" } });
    fireEvent.click(within(detail).getByRole("button", { name: /Submit offer for 1 GEN/i }));

    expect(await screen.findByText("Wallet rejected the first attempt")).toBeVisible();
    expect(within(detail).getByLabelText("Offer ID")).toHaveValue("offer-2");
    fireEvent.click(screen.getByRole("button", { name: "Retry transaction" }));
    await waitFor(() => expect(adapter.submitOffer).toHaveBeenCalledTimes(2));
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
    expect(screen.getByText("Waiting for wallet confirmation")).toBeVisible();
    act(() => emit?.({ stage: "finalized", hash: "0x1234567890abcdef", functionName: "submit_offer" }));
    expect(screen.getByText("Finalized and reloading canonical state")).toBeVisible();
  });
});
