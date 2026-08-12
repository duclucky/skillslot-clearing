export type WorkspaceAvailability = "ready" | "unconfigured" | "wrong_network" | "unavailable";

export type RoundPhase =
  | "OPEN"
  | "LOCKED"
  | "CLEARING"
  | "RETRYABLE"
  | "CLEARED"
  | "CANCELLED";

export interface RoundView {
  id: string;
  creator: string;
  title: string;
  phase: RoundPhase;
  offerCount: number;
  requestCount: number;
  feeGen: string;
  providerBondGen: string;
}

export interface PositionView {
  id: string;
  kind: "offer" | "request" | "grant";
  status: string;
  summary: string;
  roundId: string;
  requestId?: string;
}

export interface WorkspaceSnapshot {
  availability: WorkspaceAvailability;
  account: string | null;
  networkName: string | null;
  contractAddress: string | null;
  rounds: RoundView[];
  positions: PositionView[];
  creditGen: string;
  accountingInvariant: boolean | null;
}

export interface OpenRoundInput {
  roundId: string;
  title: string;
}

export interface OfferInput {
  roundId: string;
  offerId: string;
  label: string;
  promise: string;
  capabilityIds: string;
}

export interface RequestInput {
  roundId: string;
  requestId: string;
  label: string;
  need: string;
  requiredIds: string;
  excludedIds: string;
}

export interface TransactionReceipt {
  hash: string;
}

export type TransactionRecoveryReason = "submission_uncertain" | "status_poll" | "canonical_sync";

export type TransactionStage =
  | "wallet"
  | "submitted"
  | "accepted"
  | "recovering"
  | "finalized"
  | "cancelled"
  | "failed";

export interface TransactionProgress {
  stage: TransactionStage;
  hash: string;
  functionName: string;
  reason?: TransactionRecoveryReason;
  error?: string;
}

export interface ContractAdapter {
  subscribeTransactions(listener: (progress: TransactionProgress) => void): () => void;
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  connectWallet(): Promise<string>;
  openRound(input: OpenRoundInput): Promise<TransactionReceipt>;
  submitOffer(input: OfferInput): Promise<TransactionReceipt>;
  submitRequest(input: RequestInput): Promise<TransactionReceipt>;
  lockRound(roundId: string): Promise<TransactionReceipt>;
  clearRound(roundId: string): Promise<TransactionReceipt>;
  cancelRound(roundId: string): Promise<TransactionReceipt>;
  consumeGrant(input: { roundId: string; requestId: string }): Promise<TransactionReceipt>;
  withdrawCredit(amountWei: string): Promise<TransactionReceipt>;
}
