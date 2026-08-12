export type TransactionErrorKind =
  | "wallet_cancelled"
  | "submission_uncertain"
  | "rpc_transient"
  | "deterministic_failure";

function nestedValues(error: unknown, seen = new Set<unknown>()): unknown[] {
  if (!error || typeof error !== "object" || seen.has(error)) return [error];
  seen.add(error);
  const value = error as Record<string, unknown>;
  return [
    error,
    ...[value.cause, value.data, value.error].flatMap((item) => nestedValues(item, seen)),
  ];
}

function messages(error: unknown) {
  return nestedValues(error)
    .map((item) => (item instanceof Error ? item.message : typeof item === "string" ? item : ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function codes(error: unknown) {
  return nestedValues(error)
    .map((item) =>
      item && typeof item === "object" ? Number((item as { code?: unknown }).code) : Number.NaN,
    )
    .filter(Number.isFinite);
}

export function classifyTransactionError(error: unknown): TransactionErrorKind {
  const message = messages(error);
  if (error && typeof error === "object") {
    const tagged = error as { kind?: unknown; name?: unknown };
    if (tagged.kind === "wallet_cancelled" || tagged.name === "TransactionCancelledError") {
      return "wallet_cancelled";
    }
  }
  if (
    codes(error).includes(4001) ||
    ["user rejected", "user denied", "request signature: user denied"].some((part) =>
      message.includes(part),
    )
  ) {
    return "wallet_cancelled";
  }
  if (
    ["failed to fetch", "network", "timeout", "temporarily", "429", "502", "503", "504"].some(
      (part) => message.includes(part),
    )
  ) {
    return "rpc_transient";
  }
  return "deterministic_failure";
}

export class TransactionCancelledError extends Error {
  readonly kind = "wallet_cancelled";

  constructor(readonly originalError: unknown) {
    super("Wallet confirmation was cancelled");
    this.name = "TransactionCancelledError";
  }
}

export function isTransactionCancelled(error: unknown): error is TransactionCancelledError {
  return error instanceof TransactionCancelledError || classifyTransactionError(error) === "wallet_cancelled";
}

export function isTransientReadError(error: unknown) {
  return classifyTransactionError(error) === "rpc_transient";
}

export function isTransientStatusError(error: unknown) {
  const message = messages(error);
  return (
    isTransientReadError(error) ||
    message.includes("index") ||
    (message.includes("transaction") && message.includes("not found"))
  );
}
