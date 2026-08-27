import type { RoundView, WorkspaceSnapshot } from "./domain";

export type ExplorerGuideStepId =
  | "connect-wallet"
  | "create-or-select-round"
  | "submit-offer"
  | "submit-request"
  | "lock-round"
  | "clear-round"
  | "consume-grant"
  | "withdraw-credit"
  | "recover-timeout";

export type ExplorerGuideStepState = "done" | "available" | "blocked" | "not-applicable";

export interface ExplorerGuideStep {
  id: ExplorerGuideStepId;
  title: string;
  role: string;
  action: string;
  state: ExplorerGuideStepState;
  detail: string;
}

export interface ExplorerGuide {
  selectedRound: RoundView | null;
  nextStep: ExplorerGuideStep | null;
  steps: ExplorerGuideStep[];
}

const terminalPhases = new Set(["CLEARED", "CANCELLED"]);

function hasAccount(snapshot: WorkspaceSnapshot) {
  return snapshot.availability === "ready" && Boolean(snapshot.account);
}

function sameAddress(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function selectedRound(snapshot: WorkspaceSnapshot, selectedRoundId: string | null) {
  return snapshot.rounds.find((round) => round.id === selectedRoundId) ?? snapshot.rounds[0] ?? null;
}

function hasActiveGrant(snapshot: WorkspaceSnapshot, round: RoundView | null) {
  return snapshot.positions.some((position) =>
    position.kind === "grant" &&
    position.status === "ACTIVE" &&
    (!round || position.roundId === round.id),
  );
}

function hasWithdrawableCredit(snapshot: WorkspaceSnapshot) {
  return Number(snapshot.creditGen) > 0;
}

function firstAvailable(steps: ExplorerGuideStep[]) {
  return steps.find((step) => step.state === "available") ?? null;
}

export function getExplorerGuide(snapshot: WorkspaceSnapshot, selectedRoundId: string | null): ExplorerGuide {
  const accountReady = hasAccount(snapshot);
  const round = selectedRound(snapshot, selectedRoundId);
  const creator = sameAddress(round?.creator, snapshot.account);
  const openRound = Boolean(round && round.phase === "OPEN" && !round.expired);
  const terminal = Boolean(round && terminalPhases.has(round.phase));
  const recoverable = Boolean(
    accountReady &&
    round &&
    round.expired &&
    (round.phase === "OPEN" || round.phase === "LOCKED" || round.phase === "RETRYABLE"),
  );
  const grantReady = accountReady && hasActiveGrant(snapshot, round);
  const creditReady = accountReady && hasWithdrawableCredit(snapshot);

  const steps: ExplorerGuideStep[] = [
    {
      id: "connect-wallet",
      title: "Connect a Studionet wallet",
      role: "Any reviewer",
      action: "Choose a detected EVM wallet and switch to Studionet.",
      state: accountReady ? "done" : snapshot.availability === "unconfigured" ? "blocked" : "available",
      detail: accountReady ? `Connected as ${snapshot.account}` : "Required before any write action.",
    },
    {
      id: "create-or-select-round",
      title: "Create or select a round",
      role: "Round creator",
      action: "Open a bounded marketplace round or pick an existing open one.",
      state: round ? "done" : accountReady ? "available" : "blocked",
      detail: round ? `Selected ${round.title}` : "Create round is available after wallet connection.",
    },
    {
      id: "submit-offer",
      title: "Submit provider offer",
      role: "Provider wallet",
      action: "Bond 1 GEN to an authenticated agent metadata promise.",
      state: openRound && accountReady ? "available" : round?.phase === "CLEARED" ? "done" : "blocked",
      detail: openRound ? "Use generated metadata; no manual hash is needed on the default path." : "Needs a live open round.",
    },
    {
      id: "submit-request",
      title: "Submit requester need",
      role: "Requester wallet",
      action: "Escrow 1 GEN with required capabilities and exclusions.",
      state: openRound && accountReady ? "available" : round?.phase === "CLEARED" ? "done" : "blocked",
      detail: openRound ? "Use capability IDs that overlap with the provider offer." : "Needs a live open round.",
    },
    {
      id: "lock-round",
      title: "Lock the round",
      role: "Round creator",
      action: "Freeze submissions so validators can clear compatibility.",
      state: accountReady && creator && openRound && round.offerCount > 0 && round.requestCount > 0
        ? "available"
        : round && round.phase !== "OPEN"
          ? "done"
          : "blocked",
      detail: creator ? "Available after at least one offer and one request." : "Only the round creator can lock.",
    },
    {
      id: "clear-round",
      title: "Clear semantic matches",
      role: "Round creator",
      action: "Ask GenLayer validators to judge bounded compatibility.",
      state: accountReady && creator && round && !round.expired && (round.phase === "LOCKED" || round.phase === "RETRYABLE")
        ? "available"
        : terminal
          ? "done"
          : "blocked",
      detail: "Validators inspect authenticated metadata, needs, capability IDs, and exclusions.",
    },
    {
      id: "consume-grant",
      title: "Consume active grant",
      role: "Matched requester",
      action: "Use the one-time route right after clearing.",
      state: grantReady ? "available" : terminal ? "blocked" : "not-applicable",
      detail: grantReady ? "Open My activity to consume the active grant." : "Appears only for the matched requester wallet.",
    },
    {
      id: "withdraw-credit",
      title: "Withdraw credited GEN",
      role: "Credited wallet",
      action: "Withdraw matched fees, refunds, or recovered deposits.",
      state: creditReady ? "available" : terminal ? "blocked" : "not-applicable",
      detail: creditReady ? `Wallet has ${snapshot.creditGen} GEN withdrawable.` : "Credits appear after settlement or recovery.",
    },
    {
      id: "recover-timeout",
      title: "Recover expired funds",
      role: "Any wallet",
      action: "Refund locked deposits after a deadline without paying provider fees.",
      state: recoverable ? "available" : round?.expired ? "blocked" : "not-applicable",
      detail: recoverable ? "Permissionless recovery is available for this expired round." : "Only appears after a recoverable timeout.",
    },
  ];

  return {
    selectedRound: round,
    nextStep: firstAvailable(steps),
    steps,
  };
}
