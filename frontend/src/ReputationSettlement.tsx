import { CheckCircle, ClockCounterClockwise, Scales, Star, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

interface Props {
  position: PositionView;
  adapter: ContractAdapter;
  busy: boolean;
  runWrite: RunWrite;
}

const terminalDelivery = new Set(["FULFILLED", "FAILED", "RECOVERED"]);
const terminalReputation = new Set(["FINALIZED", "OVERTURNED", "VOID"]);

function formatDeadline(value?: string) {
  if (!value || value === "0") return "Not available";
  return new Date(Number(value) * 1000).toLocaleString();
}

export function ReputationSettlement({ position, adapter, busy, runWrite }: Props) {
  const [score, setScore] = useState("5");
  const [evidence, setEvidence] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestId = position.requestId!;
  const status = position.reputationStatus || "NONE";
  const deliverySettled = terminalDelivery.has(position.deliveryStatus || "");
  const challengeOpen = Number(position.reputationChallengeDeadline || 0) * 1000 > Date.now();
  const recoveryOpen = Number(position.reputationRecoveryAt || 0) * 1000 <= Date.now();
  const canSubmit = deliverySettled && status === "NONE" && position.actorRole === "requester";
  const canChallenge = status === "PENDING" && challengeOpen && position.actorRole === "provider";
  const canFinalize = status === "PENDING" && !challengeOpen;
  const canResolve = (status === "CHALLENGED" || status === "RETRYABLE") && !recoveryOpen;
  const canRecover = (status === "CHALLENGED" || status === "RETRYABLE") && recoveryOpen;
  const id = `reputation-${position.roundId}-${requestId}-${position.actorRole}`;

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await runWrite(action);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reputation action failed");
    }
  }

  if (!deliverySettled && status === "NONE") return null;

  return (
    <section className="reputation-panel" aria-labelledby={`${id}-title`}>
      <div className="delivery-heading">
        <div>
          <p className="eyebrow">Contestable reputation</p>
          <h3 id={`${id}-title`}>Review the settled delivery</h3>
        </div>
        <span className="status-badge" role="status" aria-atomic="true">{status.replaceAll("_", " ")}</span>
      </div>
      <p className="a2a-helper">One authenticated score per settled delivery. Providers can challenge; only finalized scores enter the canonical aggregate.</p>

      {canSubmit ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          void act(() => adapter.submitReputation({
            roundId: position.roundId,
            requestId,
            score: Number(score),
            evidence: evidence.trim(),
          }));
        }}>
          <label htmlFor={`${id}-score`}>Reputation score</label>
          <select id={`${id}-score`} value={score} disabled={busy} onChange={(event) => setScore(event.target.value)}>
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Good</option>
            <option value="3">3 — Adequate</option>
            <option value="2">2 — Weak</option>
            <option value="1">1 — Poor</option>
          </select>
          <label htmlFor={`${id}-evidence`}>Review evidence</label>
          <textarea id={`${id}-evidence`} rows={4} minLength={10} maxLength={600} value={evidence} disabled={busy} onChange={(event) => setEvidence(event.target.value)} />
          <button className="button button-primary" type="submit" disabled={busy || evidence.trim().length < 10}><Star aria-hidden="true" /> Publish review</button>
        </form>
      ) : null}

      {status !== "NONE" ? (
        <div className="reputation-record">
          <strong>{position.reputationScore || "0"}/5 authenticated score</strong>
          {position.reputationEvidence ? <p>{position.reputationEvidence}</p> : null}
          {position.reputationEvidenceDigest ? <small>Evidence digest {position.reputationEvidenceDigest}</small> : null}
        </div>
      ) : null}

      {canChallenge ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          void act(() => adapter.challengeReputation({ roundId: position.roundId, requestId, response: response.trim() }));
        }}>
          <label htmlFor={`${id}-response`}>Provider response</label>
          <textarea id={`${id}-response`} rows={4} minLength={10} maxLength={600} value={response} disabled={busy} onChange={(event) => setResponse(event.target.value)} />
          <button className="button button-secondary" type="submit" disabled={busy || response.trim().length < 10}><WarningCircle aria-hidden="true" /> Challenge review</button>
        </form>
      ) : null}

      {position.reputationResponse ? <div className="reputation-record"><strong>Provider response</strong><p>{position.reputationResponse}</p></div> : null}
      {status !== "NONE" && !terminalReputation.has(status) ? <dl className="delivery-meta">
        <div><dt>Challenge closes</dt><dd>{formatDeadline(position.reputationChallengeDeadline)}</dd></div>
        <div><dt>Recovery opens</dt><dd>{formatDeadline(position.reputationRecoveryAt)}</dd></div>
      </dl> : null}
      {position.reputationReason ? <p className="delivery-reason">{position.reputationReason}</p> : null}

      <div className="delivery-actions">
        {canFinalize ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void act(() => adapter.finalizeReputation({ roundId: position.roundId, requestId }))}><CheckCircle aria-hidden="true" /> Finalize unchallenged review</button> : null}
        {canResolve ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => void act(() => adapter.resolveReputation({ roundId: position.roundId, requestId }))}><Scales aria-hidden="true" /> Request reputation resolution</button> : null}
        {canRecover ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => void act(() => adapter.recoverReputation({ roundId: position.roundId, requestId }))}><ClockCounterClockwise aria-hidden="true" /> Void unresolved review</button> : null}
      </div>
      {error ? <div className="a2a-error" role="alert"><p>{error}</p></div> : null}
    </section>
  );
}
