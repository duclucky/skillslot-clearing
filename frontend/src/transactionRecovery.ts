export type TransactionErrorKind =
  | "wallet_cancelled"
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
    .flatMap((item) => {
      if (item instanceof Error) return [item.message];
      if (typeof item === "string") return [item];
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      return [value.message, value.shortMessage, value.details].filter(
        (part): part is string => typeof part === "string",
      );
    })
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function codes(error: unknown) {
  return nestedValues(error)
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as { code?: unknown; status?: unknown };
      return [Number(value.code), Number(value.status)];
    })
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
  if ([429, 502, 503, 504].some((status) => codes(error).includes(status))) {
    return "rpc_transient";
  }
  if ([
    "failed to fetch",
    "network request",
    "network error",
    "network timeout",
    "network connection",
    "connection reset",
    "connection refused",
    "timeout",
    "temporarily",
    "too many requests",
    "rate limit",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "429",
    "502",
    "503",
    "504",
  ].some((part) => message.includes(part))) {
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

export class TransactionSubmissionUncertainError extends Error {
  readonly kind = "submission_uncertain";

  constructor(readonly originalError: unknown) {
    super(
      "Transaction submission could not be confirmed. Canonical state will be checked before another action is allowed.",
    );
    this.name = "TransactionSubmissionUncertainError";
  }
}

export function isTransactionCancelled(error: unknown): error is TransactionCancelledError {
  return error instanceof TransactionCancelledError || classifyTransactionError(error) === "wallet_cancelled";
}

export function isTransactionSubmissionUncertain(
  error: unknown,
): error is TransactionSubmissionUncertainError {
  return (
    error instanceof TransactionSubmissionUncertainError ||
    Boolean(
      error &&
        typeof error === "object" &&
        (error as { kind?: unknown }).kind === "submission_uncertain",
    )
  );
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
