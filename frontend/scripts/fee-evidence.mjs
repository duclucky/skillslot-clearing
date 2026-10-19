const integer = (value) => {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) throw new Error("Missing or invalid fee observation");
  return BigInt(text);
};

// Same receipt fields used by gltest's FeeProfileCollector. No raw receipt is saved.
export function measuredProfileEntry(fees) {
  const distribution = fees?.distribution;
  const consumed = fees?.consumed;
  const headroom = value => ((integer(value) * 125n + 99n) / 100n).toString();
  if (!Array.isArray(distribution?.rotations) || !distribution.rotations.length) throw new Error("Missing fee distribution");
  return {
    leaderTimeunitsAllocation: headroom(distribution.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: headroom(distribution.validatorTimeunitsAllocation),
    executionBudgetPerRound: headroom(consumed?.executionConsumed),
    totalMessageFees: headroom(consumed?.messageFeesConsumed),
    rotationsPerRound: distribution.rotations.map(integer).reduce((a, b) => a > b ? a : b).toString(),
  };
}

export function mergeProfileEntries(previous, next) {
  return Object.fromEntries(Object.keys(next).map(key => [key,
    (integer(previous?.[key] ?? "0") > integer(next[key]) ? integer(previous[key]) : integer(next[key])).toString(),
  ]));
}

export function safeFeeSettlement(fees) {
  const consumed = fees?.consumed;
  // Deposit and consumption are deliberately separate; no inferred refund claim.
  return {
    feeDepositWei: integer(fees?.deposit).toString(),
    applicationValueWei: integer(fees?.userValue).toString(),
    executionConsumedWei: integer(consumed?.executionConsumed).toString(),
    messageFeesConsumedWei: integer(consumed?.messageFeesConsumed).toString(),
  };
}

export function executionOutcome(transaction) {
  const receipts = transaction?.consensus_data?.leader_receipt;
  const leader = Array.isArray(receipts) ? receipts[0] : receipts;
  const raw = leader?.execution_result;
  return {
    status: String(transaction.statusName ?? transaction.status ?? "UNKNOWN").toUpperCase(),
    execution: String(typeof raw === "string" ? raw : raw?.result ?? raw?.status ?? transaction.txExecutionResultName ?? "UNKNOWN").toUpperCase(),
  };
}

export function projectClearingDecision(decoded) {
  const get = (value, key) => value instanceof Map ? value.get(key) : value?.[key];
  const pairs = get(decoded, "pairs");
  const verdict = get(decoded, "verdict");
  if (!["CLEARABLE", "UNVERIFIABLE"].includes(verdict) || !Array.isArray(pairs) || pairs.length > 16) throw new Error("Invalid clearing return");
  return { verdict, pairs: pairs.map(pair => {
    const decision = get(pair, "decision");
    const offerId = get(pair, "offer_id");
    const requestId = get(pair, "request_id");
    if (!["MATCH", "NO_MATCH"].includes(decision) || !/^[A-Za-z0-9._-]{3,80}$/.test(offerId ?? "") || !/^[A-Za-z0-9._-]{3,80}$/.test(requestId ?? "")) throw new Error("Invalid clearing pair");
    return { offerId, requestId, decision };
  }) };
}
