import { CheckCircle, ClockCounterClockwise, FileArrowUp, Scales } from "@phosphor-icons/react";
import { useState } from "react";

import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

interface Props {
  position: PositionView;
  adapter: ContractAdapter;
  busy: boolean;
  runWrite: RunWrite;
}

const terminal = new Set(["FULFILLED", "FAILED", "RECOVERED"]);

function formatDeadline(value?: string) {
  if (!value || value === "0") return "Not available";
  return new Date(Number(value) * 1000).toLocaleString();
}

export function DeliverySettlement({ position, adapter, busy, runWrite }: Props) {
  const [artifact, setArtifact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestId = position.requestId!;
  const status = position.deliveryStatus || "AWAITING_DELIVERY";
  const deliveryOpen = Number(position.deliveryDeadline || 0) * 1000 > Date.now();
  const canSubmit = deliveryOpen && position.actorRole === "provider" && (status === "AWAITING_DELIVERY" || status === "RETRYABLE");
  const recoveryOpen = Number(position.deliveryRecoveryAt || 0) * 1000 <= Date.now();
  const canResolve = !recoveryOpen && (status === "SUBMITTED" || status === "RETRYABLE") && Boolean(position.deliveryDigest);
  const canRecover = !terminal.has(status) && recoveryOpen;
  const fieldId = `delivery-${position.roundId}-${requestId}-${position.actorRole}`;

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await runWrite(action);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delivery action failed");
    }
  }

  return (
    <section className="delivery-panel" aria-labelledby={`${fieldId}-title`}>
      <div className="delivery-heading">
        <div>
          <p className="eyebrow">Delivery escrow</p>
          <h3 id={`${fieldId}-title`}>{position.actorRole === "provider" ? "Submit the matched result" : "Verify the matched result"}</h3>
        </div>
        <span className="status-badge" role="status" aria-atomic="true">{status.replaceAll("_", " ")}</span>
      </div>
      <p className="a2a-helper">Fee and provider bond remain locked until acceptance, validator settlement, or timeout recovery.</p>
      <dl className="delivery-meta">
        <div><dt>Delivery due</dt><dd>{formatDeadline(position.deliveryDeadline)}</dd></div>
        <div><dt>Recovery opens</dt><dd>{formatDeadline(position.deliveryRecoveryAt)}</dd></div>
      </dl>

      {canSubmit ? <>
        <label htmlFor={fieldId}>Bounded delivery artifact</label>
        <textarea id={fieldId} rows={4} minLength={10} maxLength={600} value={artifact} disabled={busy} onChange={(event) => setArtifact(event.target.value)} />
        <button className="button button-primary" type="button" disabled={busy || artifact.trim().length < 10} onClick={() => void act(() => adapter.submitDelivery({ roundId: position.roundId, requestId, artifact: artifact.trim() }))}>
          <FileArrowUp aria-hidden="true" /> Submit delivery
        </button>
      </> : null}

      {position.deliveryArtifact ? <div className="delivery-artifact"><strong>Submitted artifact</strong><p>{position.deliveryArtifact}</p><small>Digest {position.deliveryDigest}</small></div> : null}
      {position.deliveryReason ? <p className="delivery-reason">{position.deliveryReason}</p> : null}

      {canResolve ? <div className="delivery-actions">
        {position.actorRole === "requester" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void act(() => adapter.acceptDelivery({ roundId: position.roundId, requestId }))}><CheckCircle aria-hidden="true" /> Accept delivery</button> : null}
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void act(() => adapter.reviewDelivery({ roundId: position.roundId, requestId }))}><Scales aria-hidden="true" /> Request validator review</button>
      </div> : null}
      {canRecover ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => void act(() => adapter.recoverDelivery({ roundId: position.roundId, requestId }))}><ClockCounterClockwise aria-hidden="true" /> Recover expired escrow</button> : null}
      {error ? <div className="a2a-error" role="alert"><p>{error}</p></div> : null}
    </section>
  );
}
