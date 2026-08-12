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
}

export interface WorkspaceSnapshot {
  availability: WorkspaceAvailability;
  account: string | null;
  networkName: string | null;
  contractAddress: string | null;
  round: RoundView | null;
  positions: PositionView[];
  creditGen: string;
}

export interface OfferInput {
  roundId: string;
  promise: string;
  exclusions: string;
}

export interface RequestInput {
  roundId: string;
  need: string;
  exclusions: string;
}

export interface TransactionReceipt {
  hash: string;
}

export interface ContractAdapter {
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  connectWallet(): Promise<string>;
  openRound(): Promise<TransactionReceipt>;
  submitOffer(input: OfferInput): Promise<TransactionReceipt>;
  submitRequest(input: RequestInput): Promise<TransactionReceipt>;
  lockRound(roundId: string): Promise<TransactionReceipt>;
  clearRound(roundId: string): Promise<TransactionReceipt>;
  cancelRound(roundId: string): Promise<TransactionReceipt>;
  consumeGrant(roundId: string): Promise<TransactionReceipt>;
  withdrawCredit(): Promise<TransactionReceipt>;
}
