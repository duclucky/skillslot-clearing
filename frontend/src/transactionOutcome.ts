// Never forward raw RPC receipts: they may contain validator configuration.
export function projectTransactionOutcome(transaction: Record<string, unknown>) {
  const consensus = transaction.consensus_data as Record<string, unknown> | undefined;
  const receipts = consensus?.leader_receipt;
  const leader = (Array.isArray(receipts) ? receipts[0] : receipts) as Record<string, unknown> | undefined;
  const raw = leader?.execution_result;
  const result = raw && typeof raw === "object" ? raw as Record<string, unknown> : undefined;
  const execution = String(typeof raw === "string" ? raw : result?.result ?? result?.status ?? transaction.txExecutionResultName ?? "UNKNOWN").toUpperCase();
  const status = String(transaction.statusName ?? transaction.status ?? "UNKNOWN").toUpperCase();
  return { status, execution };
}

export function assertSuccessfulExecution(outcome: { status?: string; execution?: string }) {
  if (outcome.status !== "FINALIZED" || !["SUCCESS", "FINISHED_WITH_RETURN"].includes(outcome.execution || "")) {
    throw new Error(`Execution not successful: ${outcome.execution || "UNKNOWN"} (${outcome.status || "UNKNOWN"}). Do not resubmit without checking the transaction.`);
  }
}
