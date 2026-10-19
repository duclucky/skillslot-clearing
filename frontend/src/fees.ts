export interface TransactionFees {
  distribution: Record<string, bigint | bigint[]>;
  feeValue: bigint;
}

const fields = ["leaderTimeunitsAllocation", "validatorTimeunitsAllocation", "appealRounds", "executionBudgetPerRound", "totalMessageFees", "maxPriceGenPerTimeUnit", "storageFeeMaxGasPrice", "receiptFeeMaxGasPrice"];
function unsigned(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid fee quote");
  return BigInt(value);
}

export function decodeFeeQuote(raw: unknown, now = Date.now()): TransactionFees {
  const quote = raw as { chainId?: number; quotedAt?: number; feeValue?: string; distribution?: Record<string, unknown> };
  if (quote.chainId !== 61997 || !quote.quotedAt || now < quote.quotedAt || now - quote.quotedAt > 60_000) throw new Error("Fee quote expired or belongs to another network");
  const feeValue = unsigned(quote.feeValue);
  if (feeValue > 2n * 10n ** 17n) throw new Error("Fee budget exceeds the 0.2 GEN safety cap; no wallet request was sent");
  const distribution = Object.fromEntries(fields.map(key => [key, unsigned(quote.distribution?.[key])]));
  const rotations = quote.distribution?.rotations;
  if (!Array.isArray(rotations) || rotations.length !== Number(distribution.appealRounds) + 1 || rotations.length > 3) throw new Error("Invalid fee rotations");
  return { distribution: { ...distribution, rotations: rotations.map(unsigned) }, feeValue };
}

export async function quoteMethodFees(functionName: string) {
  const response = await fetch(`/api/fee-quote?method=${encodeURIComponent(functionName)}`);
  if (!response.ok) throw new Error("Live fee quote unavailable. No transaction was sent.");
  return decodeFeeQuote(await response.json());
}
