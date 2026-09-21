import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeliverySettlement } from "./DeliverySettlement";
import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

function adapter() {
  return {
    submitDelivery: vi.fn(async () => ({ hash: "0xsubmit" })),
    acceptDelivery: vi.fn(async () => ({ hash: "0xaccept" })),
    reviewDelivery: vi.fn(async () => ({ hash: "0xreview" })),
    recoverDelivery: vi.fn(async () => ({ hash: "0xrecover" })),
  } as unknown as ContractAdapter;
}

const runWrite: RunWrite = async (action) => {
  await action();
};

function position(overrides: Partial<PositionView> = {}): PositionView {
  return {
    id: "delivery-round-1-request-1",
    kind: "delivery",
    status: "AWAITING_DELIVERY",
    summary: "Deliver matched research access",
    roundId: "round-1",
    requestId: "request-1",
    actorRole: "provider",
    deliveryStatus: "AWAITING_DELIVERY",
    deliveryDeadline: "1900003600",
    deliveryRecoveryAt: "1900010800",
    ...overrides,
  };
}

describe("Delivery settlement", () => {
  it("lets only the matched provider submit a bounded artifact", async () => {
    const contract = adapter();
    render(<DeliverySettlement position={position()} adapter={contract} busy={false} runWrite={runWrite} />);

    expect(screen.getByRole("status")).toHaveTextContent("AWAITING DELIVERY");
    fireEvent.change(screen.getByLabelText("Bounded delivery artifact"), {
      target: { value: "ipfs://delivery-proof-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit delivery" }));

    await waitFor(() => expect(contract.submitDelivery).toHaveBeenCalledWith({
      roundId: "round-1",
      requestId: "request-1",
      artifact: "ipfs://delivery-proof-001",
    }));
    expect(screen.queryByRole("button", { name: "Accept delivery" })).not.toBeInTheDocument();
  });

  it("lets the requester accept or ask validators to review a submitted artifact", async () => {
    const contract = adapter();
    render(<DeliverySettlement position={position({
      actorRole: "requester",
      deliveryStatus: "SUBMITTED",
      deliveryArtifact: "ipfs://delivery-proof-001",
      deliveryDigest: "a".repeat(64),
    })} adapter={contract} busy={false} runWrite={runWrite} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept delivery" }));
    await waitFor(() => expect(contract.acceptDelivery).toHaveBeenCalledWith({ roundId: "round-1", requestId: "request-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Request validator review" }));
    await waitFor(() => expect(contract.reviewDelivery).toHaveBeenCalledWith({ roundId: "round-1", requestId: "request-1" }));
    expect(screen.queryByLabelText("Bounded delivery artifact")).not.toBeInTheDocument();
  });

  it("shows no value-moving action after terminal settlement", () => {
    render(<DeliverySettlement position={position({
      actorRole: "requester",
      deliveryStatus: "FULFILLED",
      deliveryArtifact: "ipfs://delivery-proof-001",
      deliveryDigest: "a".repeat(64),
      deliveryReason: "Requester accepted the artifact.",
    })} adapter={adapter()} busy={false} runWrite={runWrite} />);

    expect(screen.getByRole("status")).toHaveTextContent("FULFILLED");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Requester accepted the artifact.")).toBeVisible();
  });

  it("offers only permissionless recovery once the recovery boundary opens", () => {
    render(<DeliverySettlement position={position({
      actorRole: "requester",
      deliveryStatus: "SUBMITTED",
      deliveryArtifact: "ipfs://delivery-proof-001",
      deliveryDigest: "a".repeat(64),
      deliveryRecoveryAt: "1",
    })} adapter={adapter()} busy={false} runWrite={runWrite} />);

    expect(screen.getByRole("button", { name: "Recover expired escrow" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Accept delivery" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request validator review" })).not.toBeInTheDocument();
  });
});
