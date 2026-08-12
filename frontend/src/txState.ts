export type TransactionStatus =
  | "idle"
  | "awaiting_signature"
  | "submitted"
  | "accepted"
  | "finalized"
  | "failed"
  | "retryable";

export interface TransactionState {
  status: TransactionStatus;
  hash: string | null;
  message: string | null;
}

export type TransactionEvent =
  | { type: "RESET" }
  | { type: "SIGNATURE_REQUESTED" }
  | { type: "SUBMITTED"; hash: string }
  | { type: "ACCEPTED" }
  | { type: "FINALIZED" }
  | { type: "FAILED"; message: string }
  | { type: "RETRYABLE"; message: string };

export const initialTransaction: TransactionState = {
  status: "idle",
  hash: null,
  message: null,
};

const transitions: Record<TransactionStatus, TransactionEvent["type"][]> = {
  idle: ["RESET", "SIGNATURE_REQUESTED"],
  awaiting_signature: ["RESET", "SUBMITTED", "FAILED", "RETRYABLE"],
  submitted: ["RESET", "ACCEPTED", "FAILED", "RETRYABLE"],
  accepted: ["RESET", "FINALIZED", "FAILED", "RETRYABLE"],
  finalized: ["RESET"],
  failed: ["RESET", "SIGNATURE_REQUESTED"],
  retryable: ["RESET", "SIGNATURE_REQUESTED"],
};

export function advanceTransaction(
  state: TransactionState,
  event: TransactionEvent,
): TransactionState {
  if (!transitions[state.status].includes(event.type)) {
    throw new Error(`Invalid transaction transition: ${state.status} -> ${event.type}`);
  }

  switch (event.type) {
    case "RESET":
      return initialTransaction;
    case "SIGNATURE_REQUESTED":
      return { status: "awaiting_signature", hash: null, message: null };
    case "SUBMITTED":
      return { status: "submitted", hash: event.hash, message: null };
    case "ACCEPTED":
      return { ...state, status: "accepted", message: null };
    case "FINALIZED":
      return { ...state, status: "finalized", message: null };
    case "FAILED":
      return { ...state, status: "failed", message: event.message };
    case "RETRYABLE":
      return { ...state, status: "retryable", message: event.message };
  }
}
