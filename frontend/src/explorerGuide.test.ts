import { describe, expect, it } from "vitest";

import type { WorkspaceSnapshot } from "./domain";
import { getExplorerGuide } from "./explorerGuide";

const baseSnapshot: WorkspaceSnapshot = {
  availability: "ready",
  account: null,
  networkName: "GenLayer Studionet",
  contractAddress: "0x00000000000000000000000000000000000000aa",
  rounds: [],
  positions: [],
  creditGen: "0",
  accountingInvariant: true,
};

describe("Project Explorer reviewer guide", () => {
  it("starts a fresh visitor with wallet connection as the available next step", () => {
    const guide = getExplorerGuide(baseSnapshot, null);

    expect(guide.nextStep?.id).toBe("connect-wallet");
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["connect-wallet", "available"]);
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["submit-offer", "blocked"]);
  });

  it("marks round creation and provider/requester submission as available in an open round", () => {
    const guide = getExplorerGuide({
      ...baseSnapshot,
      account: "0x0000000000000000000000000000000000000001",
      rounds: [{
        id: "round-1",
        creator: "0x0000000000000000000000000000000000000001",
        title: "Research access",
        phase: "OPEN",
        offerCount: 0,
        requestCount: 0,
        feeGen: "1",
        providerBondGen: "1",
        expired: false,
      }],
    }, "round-1");

    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["connect-wallet", "done"]);
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["create-or-select-round", "done"]);
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["submit-offer", "available"]);
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["submit-request", "available"]);
  });

  it("surfaces timeout recovery when the selected round is expired and not terminal", () => {
    const guide = getExplorerGuide({
      ...baseSnapshot,
      account: "0x0000000000000000000000000000000000000002",
      rounds: [{
        id: "round-expired",
        creator: "0x0000000000000000000000000000000000000001",
        title: "Expired access",
        phase: "RETRYABLE",
        offerCount: 1,
        requestCount: 1,
        feeGen: "1",
        providerBondGen: "1",
        expired: true,
      }],
    }, "round-expired");

    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["recover-timeout", "available"]);
    expect(guide.nextStep?.id).toBe("recover-timeout");
  });

  it("marks grant consumption and withdrawal as available from wallet activity", () => {
    const guide = getExplorerGuide({
      ...baseSnapshot,
      account: "0x0000000000000000000000000000000000000003",
      creditGen: "1",
      rounds: [{
        id: "round-cleared",
        creator: "0x0000000000000000000000000000000000000001",
        title: "Cleared access",
        phase: "CLEARED",
        offerCount: 1,
        requestCount: 1,
        feeGen: "1",
        providerBondGen: "1",
        expired: false,
      }],
      positions: [{
        id: "round-cleared:request-1",
        kind: "grant",
        status: "ACTIVE",
        summary: "Route to offer-1",
        roundId: "round-cleared",
        requestId: "request-1",
      }],
    }, "round-cleared");

    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["consume-grant", "available"]);
    expect(guide.steps.map((step) => [step.id, step.state])).toContainEqual(["withdraw-credit", "available"]);
  });
});
