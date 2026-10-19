import { describe, expect, it } from "vitest";
import { parseBookingPolicy, validateBookingPolicy } from "./bookingPolicy";

describe("request reputation policy", () => {
  it("defaults to unrestricted and converts decimal scores without floating point arithmetic", () => {
    expect(parseBookingPolicy("", "")).toEqual({ minimumReviewCount: 0, minimumAverageMilli: 0 });
    expect(parseBookingPolicy("2", "4.125")).toEqual({ minimumReviewCount: 2, minimumAverageMilli: 4125 });
    expect(parseBookingPolicy("1", "5")).toEqual({ minimumReviewCount: 1, minimumAverageMilli: 5000 });
  });
  it.each([["0", "4"], ["1.5", "4"], ["1001", "0"], ["1", "5.001"], ["1", "4.1234"], ["1", "1e2"], ["-1", "0"]])("rejects invalid text policy %s/%s", (count, average) => {
    expect(() => parseBookingPolicy(count, average)).toThrow(/Reputation policy/);
  });
  it.each([[NaN, 0], [1, Infinity], [1.5, 3000], [1, 4000.5], [0, 1], [-1, 0]])("rejects invalid adapter integers %s/%s", (count, score) => {
    expect(() => validateBookingPolicy(count, score)).toThrow(/Reputation policy/);
  });
});
