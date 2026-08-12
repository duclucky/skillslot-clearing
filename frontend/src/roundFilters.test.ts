import { describe, expect, it } from "vitest";

import type { RoundView } from "./domain";
import { defaultRoundId } from "./roundFilters";

const baseRound: RoundView = {
  id: "round-cleared",
  creator: "0x0000000000000000000000000000000000000001",
  title: "Cleared round",
  phase: "CLEARED",
  offerCount: 1,
  requestCount: 1,
  feeGen: "1",
  providerBondGen: "1",
};

describe("default round selection", () => {
  it("prefers useful cleared history over a later cancelled diagnostic round", () => {
    expect(defaultRoundId([
      baseRound,
      { ...baseRound, id: "round-cancelled", title: "Cancelled round", phase: "CANCELLED" },
    ])).toBe("round-cleared");
  });
});
