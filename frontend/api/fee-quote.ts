import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import profile from "../fee-profile.json";

type Request = { method?: string; query: { method?: unknown } };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; json(value: unknown): void };
const methods = new Set(["open_round", "submit_offer", "submit_request", "lock_round", "clear_round", "cancel_round", "recover_expired_round", "authorize_dispatch", "authorize_executor", "revoke_executor", "submit_delivery", "accept_delivery", "review_delivery", "recover_delivery", "submit_reputation", "challenge_reputation", "resolve_reputation", "finalize_reputation", "recover_reputation", "consume_grant", "withdraw_credit"]);
type Entry = { leaderTimeunitsAllocation: string; validatorTimeunitsAllocation: string; executionBudgetPerRound: string; totalMessageFees: string; rotationsPerRound: string };

export default async function handler(request: Request, response: Response) {
  response.setHeader("cache-control", "no-store");
  const name = request.query.method;
  if (request.method !== "GET" || typeof name !== "string" || !methods.has(name)) {
    response.status(400).json({ error: "Unknown contract write" });
    return;
  }
  try {
    const entry = (profile.methods as Record<string, Entry>)[name];
    // Never guess the budget of the external-message withdrawal path.
    if (!entry && name === "withdraw_credit") {
      response.status(503).json({ error: "Withdrawal fee profile has not been measured" });
      return;
    }
    const client = createClient({ chain: { ...studioDevnet } });
    const policy = await client.getCurrentFeePolicy();
    const measuredBudget = BigInt(entry?.executionBudgetPerRound ?? "0");
    const estimate = await client.estimateTransactionFees({
      ...(entry ? {
        leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
        validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
        executionBudgetPerRound: measuredBudget > policy.executionBudgetFloor ? measuredBudget : policy.executionBudgetFloor,
        totalMessageFees: BigInt(entry.totalMessageFees),
      } : {}),
      appealRounds: 1n,
      rotations: [BigInt(entry?.rotationsPerRound ?? "1"), BigInt(entry?.rotationsPerRound ?? "1")],
    });
    const safe = {
      chainId: 61997, quotedAt: Date.now(), source: entry ? "measured-profile" : "network-default",
      feeValue: estimate.feeValue.toString(),
      distribution: Object.fromEntries(Object.entries(estimate.distribution).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])),
    };
    response.status(200).json(safe);
  } catch {
    response.status(502).json({ error: "Current network fee policy unavailable" });
  }
}
