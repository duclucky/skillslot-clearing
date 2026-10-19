import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { projectTransactionOutcome } from "../src/transactionOutcome.js";

type Request = { method?: string; query: { hash?: unknown } };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; json(value: unknown): void };

export default async function handler(request: Request, response: Response) {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "GET" || typeof request.query.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(request.query.hash)) {
    response.status(400).json({ error: "A valid transaction hash is required" });
    return;
  }
  try {
    const client = createClient({ chain: { ...studioDevnet } });
    const transaction = await client.getTransaction({ hash: request.query.hash as `0x${string}` });
    response.status(200).json(projectTransactionOutcome(transaction as unknown as Record<string, unknown>));
  } catch {
    response.status(502).json({ error: "Execution verification temporarily unavailable; do not resubmit" });
  }
}
