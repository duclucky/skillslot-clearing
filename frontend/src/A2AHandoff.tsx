import { CheckCircle, Copy, Key, PaperPlaneTilt, ShieldCheck, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { createA2ARequest, taskDigest, type SendMessageRequest } from "./a2aProtocol";
import { createExecutorPackage } from "./executorPermit";
import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

interface PreparedTask {
  request: SendMessageRequest;
  digest: string;
}

interface A2AHandoffProps {
  position: PositionView;
  account: string;
  contractAddress: string;
  adapter: ContractAdapter;
  busy: boolean;
  runWrite: RunWrite;
}

function randomToken(prefix: string) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex}`;
}

export function A2AHandoff({ position, account, contractAddress, adapter, busy, runWrite }: A2AHandoffProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [prepared, setPrepared] = useState<PreparedTask | null>(null);
  const [executor, setExecutor] = useState("");
  const [duration, setDuration] = useState("3600");
  const [packageText, setPackageText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = position.requestId!;
  const helpId = `a2a-task-help-${position.roundId}-${requestId}`;
  const canonicalAuthorized = Boolean(
    prepared && position.dispatchStatus === "AUTHORIZED" && position.dispatchDigest === prepared.digest,
  );
  const permitActive = Boolean(
    canonicalAuthorized &&
    position.executorStatus === "AUTHORIZED" &&
    position.executor &&
    position.executorEpoch &&
    position.executorExpiresAt,
  );

  useEffect(() => {
    let active = true;
    if (!prepared || !permitActive) {
      setPackageText("");
      return () => { active = false; };
    }
    void createExecutorPackage({
      request: prepared.request,
      executor: position.executor!,
      epoch: Number(position.executorEpoch),
      expiresAt: Number(position.executorExpiresAt),
    }).then((value) => {
      if (active) setPackageText(JSON.stringify(value, null, 2));
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Executor package could not be prepared");
    });
    return () => { active = false; };
  }, [permitActive, position.executor, position.executorEpoch, position.executorExpiresAt, prepared]);

  async function authorizeTask() {
    setError(null);
    setCopied(false);
    try {
      const request = createA2ARequest({
        contract: contractAddress,
        roundId: position.roundId,
        requestId,
        requester: account,
        text,
        messageId: randomToken("message"),
        nonce: randomToken("nonce"),
      });
      const digest = await taskDigest(request);
      setPrepared({ request, digest });
      await runWrite(() => adapter.authorizeDispatch({ roundId: position.roundId, requestId, taskDigest: digest }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task authorization failed");
    }
  }

  async function authorizeExecutor() {
    setError(null);
    setCopied(false);
    const expiresAt = Math.floor(Date.now() / 1000) + Number(duration);
    try {
      await runWrite(() => adapter.authorizeExecutor({
        roundId: position.roundId,
        requestId,
        executor: executor.trim(),
        expiresAt: String(expiresAt),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Executor authorization failed");
    }
  }

  async function revokeExecutor() {
    setError(null);
    try {
      await runWrite(() => adapter.revokeExecutor({ roundId: position.roundId, requestId }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Executor revocation failed");
    }
  }

  async function copyPackage() {
    try {
      await navigator.clipboard.writeText(packageText);
      setCopied(true);
    } catch {
      setError("Clipboard access failed. Select and copy the public package manually.");
    }
  }

  if (!open) {
    return (
      <button className="button button-primary" type="button" disabled={busy} onClick={() => setOpen(true)}>
        <PaperPlaneTilt aria-hidden="true" /> Prepare delegated task
      </button>
    );
  }

  const step = packageText ? 4 : permitActive ? 3 : canonicalAuthorized ? 3 : prepared ? 2 : 1;
  return (
    <section className="a2a-handoff" aria-labelledby={`a2a-title-${position.roundId}-${requestId}`}>
      <div className="a2a-handoff-heading">
        <div>
          <p className="eyebrow">Requester controls</p>
          <h3 id={`a2a-title-${position.roundId}-${requestId}`}>Delegate one exact A2A task</h3>
        </div>
        <button className="icon-button" type="button" aria-label="Close delegated task panel" onClick={() => setOpen(false)}>
          <X aria-hidden="true" />
        </button>
      </div>

      <ol className="a2a-progress" aria-label="Delegated task progress">
        {["Draft", "Authorize task", "Delegate", "Export"].map((label, index) => (
          <li key={label} className={index + 1 < step ? "is-done" : index + 1 === step ? "is-current" : ""}>
            <span>{index + 1 < step ? <CheckCircle aria-hidden="true" /> : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <label htmlFor={`a2a-task-${position.roundId}-${requestId}`}>Task for the reference agent</label>
      <textarea
        id={`a2a-task-${position.roundId}-${requestId}`}
        aria-describedby={helpId}
        rows={4}
        maxLength={600}
        value={text}
        disabled={busy || Boolean(position.dispatchDigest)}
        onChange={(event) => setText(event.target.value)}
      />
      <p id={helpId} className="a2a-helper">
        Your wallet first commits this exact task digest. The separate executor permit never transfers the grant or moves GEN.
      </p>

      {!canonicalAuthorized ? (
        <button className="button button-primary" type="button" disabled={busy || !text.trim() || Boolean(position.dispatchDigest)} onClick={() => void authorizeTask()}>
          <ShieldCheck aria-hidden="true" /> Authorize task
        </button>
      ) : null}

      {canonicalAuthorized && !permitActive ? (
        <fieldset className="executor-fields">
          <legend>Bound executor</legend>
          <label htmlFor={`executor-${position.roundId}-${requestId}`}>Executor wallet address</label>
          <input
            id={`executor-${position.roundId}-${requestId}`}
            value={executor}
            inputMode="text"
            autoComplete="off"
            placeholder="0x..."
            disabled={busy}
            onChange={(event) => setExecutor(event.target.value)}
          />
          <label htmlFor={`executor-duration-${position.roundId}-${requestId}`}>Permit duration</label>
          <select id={`executor-duration-${position.roundId}-${requestId}`} value={duration} disabled={busy} onChange={(event) => setDuration(event.target.value)}>
            <option value="3600">1 hour</option>
            <option value="86400">24 hours</option>
            <option value="604800">7 days</option>
          </select>
          <button className="button button-primary" type="button" disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(executor.trim())} onClick={() => void authorizeExecutor()}>
            <Key aria-hidden="true" /> Authorize executor
          </button>
        </fieldset>
      ) : null}

      {permitActive ? (
        <div className="executor-package" role="status" aria-live="polite">
          <div className="executor-package-heading">
            <div><strong>Execution package ready</strong><p>Public binding data only. Send it to the named executor wallet.</p></div>
            <span className="status-badge status-cleared">Epoch {position.executorEpoch}</span>
          </div>
          <label htmlFor={`executor-package-${position.roundId}-${requestId}`}>Executor package</label>
          <textarea id={`executor-package-${position.roundId}-${requestId}`} rows={7} readOnly value={packageText} />
          <div className="executor-package-actions">
            <button className="button button-primary" type="button" disabled={!packageText} onClick={() => void copyPackage()}>
              <Copy aria-hidden="true" /> {copied ? "Package copied" : "Copy execution package"}
            </button>
            <button className="button button-danger" type="button" disabled={busy} onClick={() => void revokeExecutor()}>
              Revoke executor
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="a2a-error" role="alert"><p>{error}</p></div> : null}
    </section>
  );
}
