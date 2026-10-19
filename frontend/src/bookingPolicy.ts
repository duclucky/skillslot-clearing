export function validateBookingPolicy(minimumReviewCount: number, minimumAverageMilli: number) {
  if (!Number.isSafeInteger(minimumReviewCount) || minimumReviewCount < 0 || minimumReviewCount > 1000
    || !Number.isSafeInteger(minimumAverageMilli) || minimumAverageMilli < 0 || minimumAverageMilli > 5000
    || (minimumAverageMilli > 0 && minimumReviewCount === 0)) {
    throw new Error("Reputation policy: use 0–1000 whole reviews and a score from 0–5 (up to 3 decimals). A positive score requires at least one review.");
  }
  return { minimumReviewCount, minimumAverageMilli };
}

export function parseBookingPolicy(count: string, score: string) {
  const normalizedCount = count.trim() || "0";
  const normalizedScore = score.trim() || "0";
  if (!/^\d{1,4}$/.test(normalizedCount) || !/^\d(?:\.\d{1,3})?$/.test(normalizedScore)) {
    throw new Error("Reputation policy: enter whole reviews and a score from 0–5 with at most 3 decimals.");
  }
  const [whole, decimal = ""] = normalizedScore.split(".");
  return validateBookingPolicy(Number(normalizedCount), Number(whole) * 1000 + Number(decimal.padEnd(3, "0")));
}
