import { skillSlotAgentCard } from "../src/a2aAgentCard.js";

type VercelRequest = { method?: string };
type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
};

export default function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("cache-control", "public, max-age=300");
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, error: "Use GET for the Agent Card" });
    return;
  }
  response.status(200).json(skillSlotAgentCard("https://skillslot-clearing.vercel.app"));
}
