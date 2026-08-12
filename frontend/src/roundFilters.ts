import type { RoundView } from "./domain";

export type RoundFilter = "open" | "decision" | "history";

const phasesByFilter: Record<RoundFilter, RoundView["phase"][]> = {
  open: ["OPEN"],
  decision: ["LOCKED", "CLEARING", "RETRYABLE"],
  history: ["CLEARED", "CANCELLED"],
};

export function filterRounds(rounds: RoundView[], filter: RoundFilter) {
  return rounds.filter((round) => phasesByFilter[filter].includes(round.phase));
}

export function defaultRoundId(rounds: RoundView[]) {
  return (
    rounds.find((round) => round.phase === "OPEN") ??
    rounds.find((round) => phasesByFilter.decision.includes(round.phase)) ??
    rounds[rounds.length - 1] ??
    null
  )?.id ?? null;
}

export function roundFilter(round: RoundView): RoundFilter {
  if (round.phase === "OPEN") return "open";
  if (phasesByFilter.decision.includes(round.phase)) return "decision";
  return "history";
}
