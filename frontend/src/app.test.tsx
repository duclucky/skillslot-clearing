import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { createUnconfiguredAdapter } from "./contractAdapter";
import type { ContractAdapter, WorkspaceSnapshot } from "./domain";

function adapterFor(snapshot: WorkspaceSnapshot): ContractAdapter {
  return {
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
  round: {
    id: "round-1",
    creator: "0x0000000000000000000000000000000000000001",
    title: "Research access",
    phase: "OPEN",
    offerCount: 1,
    requestCount: 1,
    feeGen: "1",
    providerBondGen: "1",
  },
  positions: [],
  creditGen: "0",
  accountingInvariant: true,
};

describe("SkillSlot Clearing workspace", () => {
  it("shows an honest unconfigured state and both top-level destinations", async () => {
    render(<App adapter={createUnconfiguredAdapter()} />);

    expect(await screen.findByText("Contract not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clearing floor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My access & credits/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeDisabled();
  });

  it("does not expose reviewer internals or invented market state", async () => {
    const { container } = render(<App adapter={createUnconfiguredAdapter()} />);

    await screen.findByText("Contract not configured");
    expect(container).not.toHaveTextContent(/compatibility matrix/i);
    expect(container).not.toHaveTextContent(/attempt id/i);
    expect(container).not.toHaveTextContent(/sample round/i);
  });

  it("connects a real wallet and reloads canonical state", async () => {
    const disconnected = adapterFor({ ...ready, account: null });
    render(<App adapter={disconnected} />);

    fireEvent.click(await screen.findByRole("button", { name: /Connect wallet/i }));

    await waitFor(() => expect(disconnected.connectWallet).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(disconnected.loadWorkspace).toHaveBeenCalledTimes(2));
  });

  it("exposes and executes every OPEN-round browser action", async () => {
    const adapter = adapterFor(ready);
    render(<App adapter={adapter} />);
    await screen.findByText("Research access");

    fireEvent.change(screen.getByLabelText("Offer ID"), { target: { value: "offer-2" } });
    fireEvent.change(screen.getByLabelText("Offer label"), { target: { value: "Source finder" } });
    fireEvent.change(screen.getByLabelText("Promise"), { target: { value: "Find primary sources" } });
    fireEvent.change(screen.getByLabelText("Capability IDs"), { target: { value: "web" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit offer \/ 1 GEN/i }));

    await waitFor(() => expect(adapter.submitOffer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /Lock round/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Lock round/i }));
    await waitFor(() => expect(adapter.lockRound).toHaveBeenCalledWith("round-1"));
    fireEvent.click(screen.getByRole("button", { name: /Cancel round/i }));
    await waitFor(() => expect(adapter.cancelRound).toHaveBeenCalledWith("round-1"));
  });

  it("supports clear/retry, grant consumption, and withdrawal", async () => {
    const lockedAdapter = adapterFor({ ...ready, round: { ...ready.round!, phase: "RETRYABLE" } });
    const { unmount } = render(<App adapter={lockedAdapter} />);
    fireEvent.click(await screen.findByRole("button", { name: /Retry semantic clearing/i }));
    await waitFor(() => expect(lockedAdapter.clearRound).toHaveBeenCalledWith("round-1"));
    unmount();

    const clearedAdapter = adapterFor({
      ...ready,
      round: { ...ready.round!, phase: "CLEARED" },
      creditGen: "1",
      positions: [{ id: "round-1:request-1", roundId: "round-1", requestId: "request-1", kind: "grant", status: "ACTIVE", summary: "Route to offer-1" }],
    });
    render(<App adapter={clearedAdapter} />);
    fireEvent.click(await screen.findByRole("button", { name: /My access & credits/i }));
    fireEvent.click(screen.getByRole("button", { name: /Consume grant/i }));
    await waitFor(() => expect(clearedAdapter.consumeGrant).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Withdraw 1 GEN/i }));
    await waitFor(() => expect(clearedAdapter.withdrawCredit).toHaveBeenCalledWith("1000000000000000000"));
  });

  it("opens the first round and submits a requester need through browser controls", async () => {
    const emptyAdapter = adapterFor({ ...ready, round: null });
    const { unmount } = render(<App adapter={emptyAdapter} />);
    fireEvent.change(await screen.findByLabelText("Round ID"), { target: { value: "round-2" } });
    fireEvent.change(screen.getByLabelText("Round title"), { target: { value: "New research access" } });
    fireEvent.click(screen.getByRole("button", { name: "Open round" }));
    await waitFor(() => expect(emptyAdapter.openRound).toHaveBeenCalledWith({ roundId: "round-2", title: "New research access" }));
    unmount();

    const requestAdapter = adapterFor(ready);
    render(<App adapter={requestAdapter} />);
    fireEvent.click(await screen.findByText("Submit requester need"));
    fireEvent.change(screen.getByLabelText("Request ID"), { target: { value: "request-2" } });
    fireEvent.change(screen.getByLabelText("Request label"), { target: { value: "Need sources" } });
    fireEvent.change(screen.getByLabelText("Need"), { target: { value: "Find primary sources" } });
    fireEvent.change(screen.getByLabelText("Required IDs"), { target: { value: "web" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit request \/ 1 GEN/i }));
    await waitFor(() => expect(requestAdapter.submitRequest).toHaveBeenCalledTimes(1));
  });
});
