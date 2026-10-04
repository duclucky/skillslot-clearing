import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReputationSettlement } from "./ReputationSettlement";
import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

function adapter() {
  return {
    submitReputation: vi.fn(async () => ({ hash: "0xsubmit" })),
    challengeReputation: vi.fn(async () => ({ hash: "0xchallenge" })),
    resolveReputation: vi.fn(async () => ({ hash: "0xresolve" })),
    finalizeReputation: vi.fn(async () => ({ hash: "0xfinalize" })),
    recoverReputation: vi.fn(async () => ({ hash: "0xrecover" })),
  } as unknown as ContractAdapter;
}

const runWrite: RunWrite = async (action) => {
  await action();
};

function position(overrides: Partial<PositionView> = {}): PositionView {
  return {
    id: "delivery-round-1-request-1",
    kind: "delivery",
    status: "FULFILLED",
    summary: "Delivered research access",
    roundId: "round-1",
    requestId: "request-1",
    actorRole: "requester",
    deliveryStatus: "FULFILLED",
    reputationStatus: "NONE",
    ...overrides,
  };
}

describe("Contestable reputation", () => {
  it("lets the matched requester submit a labeled bounded review", async () => {
    const contract = adapter();
    render(<ReputationSettlement position={position()} adapter={contract} busy={false} runWrite={runWrite} />);

    fireEvent.change(screen.getByLabelText("Reputation score"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Review evidence"), {
      target: { value: "The delivery satisfied every locked capability and included the required proof." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));

    await waitFor(() => expect(contract.submitReputation).toHaveBeenCalledWith({
      roundId: "round-1",
      requestId: "request-1",
      score: 5,
      evidence: "The delivery satisfied every locked capability and included the required proof.",
    }));
  });

  it("shows only the matched provider challenge action while pending", async () => {
    const contract = adapter();
    render(<ReputationSettlement position={position({
      actorRole: "provider",
      reputationStatus: "PENDING",
      reputationScore: "2",
      reputationEvidence: "The delivery omitted a required export.",
      reputationChallengeDeadline: "4102444800",
    })} adapter={contract} busy={false} runWrite={runWrite} />);

    expect(screen.getByRole("status")).toHaveTextContent("PENDING");
    fireEvent.change(screen.getByLabelText("Provider response"), {
      target: { value: "The canonical delivery artifact contains the requested export and checksum." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Challenge review" }));
    await waitFor(() => expect(contract.challengeReputation).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Publish review" })).not.toBeInTheDocument();
  });

  it("offers validator resolution for a challenged review", async () => {
    const contract = adapter();
    render(<ReputationSettlement position={position({
      reputationStatus: "CHALLENGED",
      reputationScore: "2",
      reputationEvidence: "The delivery omitted a required export.",
      reputationResponse: "The artifact includes the export and checksum.",
      reputationRecoveryAt: "4102444800",
    })} adapter={contract} busy={false} runWrite={runWrite} />);

    fireEvent.click(screen.getByRole("button", { name: "Request reputation resolution" }));
    await waitFor(() => expect(contract.resolveReputation).toHaveBeenCalledWith({ roundId: "round-1", requestId: "request-1" }));
  });

  it("offers exact deadline actions and no action after terminal reputation", () => {
    const { rerender } = render(<ReputationSettlement position={position({
      reputationStatus: "PENDING",
      reputationChallengeDeadline: "1",
    })} adapter={adapter()} busy={false} runWrite={runWrite} />);
    expect(screen.getByRole("button", { name: "Finalize unchallenged review" })).toBeEnabled();

    rerender(<ReputationSettlement position={position({
      reputationStatus: "FINALIZED",
      reputationScore: "5",
      reputationReason: "Review finalized without challenge.",
    })} adapter={adapter()} busy={false} runWrite={runWrite} />);
    expect(screen.getByText("Review finalized without challenge.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
