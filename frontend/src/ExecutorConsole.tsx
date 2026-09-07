import { CheckCircle, Key, PaperPlaneTilt } from "@phosphor-icons/react";
import { useState } from "react";

import { executorPermitHeaders, executorPermitMessage, parseExecutorPackage, type ExecutorPackage } from "./executorPermit";
import type { ContractAdapter } from "./domain";

interface TaskReceipt { id: string; state: string }

function receiptFrom(value: unknown): TaskReceipt {
  if (!value || typeof value !== "object") throw new Error("Reference agent returned an invalid response");
  const task = (value as { task?: unknown }).task;
  if (!task || typeof task !== "object") throw new Error("Reference agent did not return an A2A task");
  const id = (task as { id?: unknown }).id;
  const status = (task as { status?: unknown }).status;
  const state = status && typeof status === "object" ? (status as { state?: unknown }).state : undefined;
  if (typeof id !== "string" || typeof state !== "string") throw new Error("Reference agent returned an incomplete A2A task");
  return { id, state };
}

export function ExecutorConsole({ account, adapter }: { account: string; adapter: ContractAdapter }) {
  const [packageText, setPackageText] = useState("");
  const [permit, setPermit] = useState<ExecutorPackage | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<TaskReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accountMatches = Boolean(permit && permit.executor.toLowerCase() === account.toLowerCase());

  async function loadPermit() {
    setError(null);
    setReceipt(null);
    setSignature(null);
    try {
      setPermit(await parseExecutorPackage(packageText));
    } catch (cause) {
      setPermit(null);
      setError(cause instanceof Error ? cause.message : "Executor package is invalid");
    }
  }

  async function sendWithSignature(currentSignature: string) {
    if (!permit) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/a2a/v1/message:send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...executorPermitHeaders({
            executor: permit.executor,
            epoch: permit.epoch,
            expiresAt: permit.expiresAt,
            signature: currentSignature,
          }),
        },
        body: JSON.stringify(permit.request),
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
      setError(cause instanceof Error ? cause.message : "Delegated A2A request failed");
    } finally {
      setSending(false);
    }
  }

  async function signAndSend() {
    if (!permit || !accountMatches) return;
    try {
      const nextSignature = await adapter.signMessage(await executorPermitMessage(permit));
      setSignature(nextSignature);
      await sendWithSignature(nextSignature);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Executor signature failed");
    }
  }

  return (
    <section className="executor-console immersive-card operational-card" aria-labelledby="executor-console-title">
      <div className="executor-console-heading">
        <div><p className="eyebrow">Executor controls</p><h2 id="executor-console-title">Run a delegated task</h2></div>
        <Key aria-hidden="true" />
      </div>
      <p className="executor-console-note">Import public permit data, verify the binding, then sign with the exact delegated EOA. Signatures stay in this page session only.</p>
      <label htmlFor="executor-package-input">Paste executor package</label>
      <textarea id="executor-package-input" rows={7} value={packageText} onChange={(event) => setPackageText(event.target.value)} placeholder="Paste the JSON package from the requester" />
      <button className="button button-secondary" type="button" disabled={!packageText.trim() || sending} onClick={() => void loadPermit()}>Inspect permit</button>

      {permit ? (
        <dl className="executor-permit-summary">
          <div><dt>Executor</dt><dd>{permit.executor}</dd></div>
          <div><dt>Round / request</dt><dd>{permit.request.metadata.skillslot.roundId} / {permit.request.metadata.skillslot.requestId}</dd></div>
          <div><dt>Epoch</dt><dd>{permit.epoch}</dd></div>
          <div><dt>Expires</dt><dd>{new Date(permit.expiresAt * 1000).toLocaleString()}</dd></div>
          <div><dt>Wallet check</dt><dd>{accountMatches ? "Connected wallet matches" : "Connect the delegated executor wallet"}</dd></div>
        </dl>
      ) : null}

      {permit && !receipt ? (
        <button className="button button-primary" type="button" disabled={!accountMatches || sending} onClick={() => void signAndSend()}>
          <PaperPlaneTilt aria-hidden="true" /> {sending ? "Verifying signed permit" : "Sign and send task"}
        </button>
      ) : null}

      {receipt ? (
        <div className="a2a-receipt" role="status" aria-live="polite">
          <CheckCircle aria-hidden="true" /><div><strong>{receipt.state}</strong><code>{receipt.id}</code><p>This proves authorized submission only, not service completion.</p></div>
        </div>
      ) : null}

      {error ? (
        <div className="a2a-error" role="alert">
          <p>{error}</p>
          {permit && signature ? <button className="button button-secondary" type="button" disabled={sending} onClick={() => void sendWithSignature(signature)}>Retry exact signed task</button> : null}
        </div>
      ) : null}
    </section>
  );
}
