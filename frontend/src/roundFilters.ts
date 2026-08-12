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

function latestRound(rounds: RoundView[], phases: RoundView["phase"][]) {
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    if (phases.includes(rounds[index].phase)) return rounds[index];
  }
  return null;
}

export function defaultRoundId(rounds: RoundView[]) {
  return (
    latestRound(rounds, phasesByFilter.open) ??
    latestRound(rounds, phasesByFilter.decision) ??
    latestRound(rounds, ["CLEARED"]) ??
    rounds[rounds.length - 1] ??
    null
  )?.id ?? null;
}

export function roundFilter(round: RoundView): RoundFilter {
  if (round.phase === "OPEN") return "open";
  if (phasesByFilter.decision.includes(round.phase)) return "decision";
  return "history";
}
