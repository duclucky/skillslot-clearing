import { CheckCircle, PaperPlaneTilt, ShieldCheck, X } from "@phosphor-icons/react";
import { useState } from "react";

import { createA2ARequest, taskDigest, type SendMessageRequest } from "./a2aProtocol";
import type { ContractAdapter, PositionView } from "./domain";
import type { RunWrite } from "./Marketplace";

interface PreparedTask {
  request: SendMessageRequest;
  digest: string;
}

interface TaskReceipt {
  id: string;
  state: string;
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

function receiptFrom(value: unknown): TaskReceipt {
  if (!value || typeof value !== "object") throw new Error("Reference agent returned an invalid response");
  const task = (value as { task?: unknown }).task;
  if (!task || typeof task !== "object") throw new Error("Reference agent did not return an A2A task");
  const id = (task as { id?: unknown }).id;
  const status = (task as { status?: unknown }).status;
  const state = status && typeof status === "object" ? (status as { state?: unknown }).state : undefined;
  if (typeof id !== "string" || typeof state !== "string") {
    throw new Error("Reference agent returned an incomplete A2A task");
  }
  return { id, state };
}

export function A2AHandoff({
  position,
  account,
  contractAddress,
  adapter,
  busy,
  runWrite,
}: A2AHandoffProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [prepared, setPrepared] = useState<PreparedTask | null>(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<TaskReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = position.requestId!;
  const helpId = `a2a-task-help-${position.roundId}-${requestId}`;
  const canonicalAuthorized = Boolean(
    prepared &&
    position.dispatchStatus === "AUTHORIZED" &&
    position.dispatchDigest === prepared.digest,
  );

  async function authorize() {
    setError(null);
    setReceipt(null);
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
      const next = { request, digest };
      setPrepared(next);
      await runWrite(() => adapter.authorizeDispatch({
        roundId: position.roundId,
        requestId,
        taskDigest: digest,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task authorization failed");
    }
  }

  async function send() {
    if (!prepared || position.dispatchDigest !== prepared.digest) {
      setError("Canonical dispatch digest does not match this browser task. Do not send it.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/a2a/v1/message:send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prepared.request),
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const message = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
          ? String((body as { error: string }).error)
          : `Reference agent rejected the request (${response.status})`;
        throw new Error(message);
      }
      setReceipt(receiptFrom(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A2A request failed");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button className="button button-primary" type="button" disabled={busy} onClick={() => setOpen(true)}>
        <PaperPlaneTilt aria-hidden="true" /> Prepare A2A task
      </button>
    );
  }

  const step = receipt ? 4 : canonicalAuthorized ? 3 : prepared ? 2 : 1;
  return (
    <section className="a2a-handoff" aria-labelledby={`a2a-title-${position.roundId}-${requestId}`}>
      <div className="a2a-handoff-heading">
        <div>
          <p className="eyebrow">Validator-cleared handoff</p>
          <h3 id={`a2a-title-${position.roundId}-${requestId}`}>Send one bound A2A task</h3>
        </div>
        <button className="icon-button" type="button" aria-label="Close A2A task panel" onClick={() => setOpen(false)}>
          <X aria-hidden="true" />
        </button>
      </div>

      <ol className="a2a-progress" aria-label="A2A handoff progress">
        {["Draft", "Authorize", "Send", "Receipt"].map((label, index) => (
          <li key={label} className={index + 1 < step ? "is-done" : index + 1 === step ? "is-current" : ""}>
            <span>{index + 1 < step ? <CheckCircle aria-hidden="true" /> : index + 1}</span>
            {label}
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
        The wallet commits only this task&apos;s SHA-256 digest. Task text is sent to the fixed SkillSlot reference agent after finalization.
      </p>

      {!canonicalAuthorized ? (
        <button
          className="button button-primary"
          type="button"
          disabled={busy || sending || !text.trim() || Boolean(position.dispatchDigest)}
          onClick={() => void authorize()}
        >
          <ShieldCheck aria-hidden="true" /> Authorize task
        </button>
      ) : null}

      {canonicalAuthorized && !receipt ? (
        <button className="button button-primary" type="button" disabled={busy || sending} onClick={() => void send()}>
          <PaperPlaneTilt aria-hidden="true" /> {sending ? "Sending authorized task" : "Send to reference agent"}
        </button>
      ) : null}

      {receipt ? (
        <div className="a2a-receipt" role="status" aria-live="polite">
          <CheckCircle aria-hidden="true" />
          <div>
            <strong>{receipt.state}</strong>
            <code>{receipt.id}</code>
            <p>This receipt proves the authorized handoff, not service completion or provider performance.</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="a2a-error" role="alert">
          <p>{error}</p>
          {canonicalAuthorized ? (
            <button className="button button-secondary" type="button" disabled={sending} onClick={() => void send()}>
              Try A2A request again
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
