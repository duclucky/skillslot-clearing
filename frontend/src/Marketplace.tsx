import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  LockKey,
  PaperPlaneTilt,
  Plus,
  ShieldWarning,
  UsersThree,
} from "@phosphor-icons/react";
import { type ChangeEvent, type FormEvent, useState } from "react";

import type { ContractAdapter, RoundView, WorkspaceSnapshot } from "./domain";
import { validateCapabilityCsv, validateIdentifier, validateText } from "./formValidation";
import { filterRounds, type RoundFilter, roundFilter } from "./roundFilters";

export type RunWrite = (
  action: () => Promise<unknown>,
  afterFinalized?: (snapshot: WorkspaceSnapshot) => void,
) => Promise<void>;

type SharedProps = {
  snapshot: WorkspaceSnapshot;
  adapter: ContractAdapter;
  busy: boolean;
  runWrite: RunWrite;
};

type MarketplaceProps = SharedProps & {
  selectedRoundId: string | null;
  onSelectRound: (roundId: string) => void;
  onCreateRound: () => void;
};

const filterLabels: Array<[RoundFilter, string]> = [
  ["open", "Open now"],
  ["decision", "In decision"],
  ["history", "History"],
];

export function Marketplace({
  snapshot,
  adapter,
  busy,
  runWrite,
  selectedRoundId,
  onSelectRound,
  onCreateRound,
}: MarketplaceProps) {
  const selectedRound = snapshot.rounds.find((round) => round.id === selectedRoundId) ?? null;
  const [filter, setFilter] = useState<RoundFilter>(selectedRound ? roundFilter(selectedRound) : "open");
  const visibleRounds = filterRounds(snapshot.rounds, filter);

  function selectRound(round: RoundView) {
    onSelectRound(round.id);
    setFilter(roundFilter(round));
  }

  return (
    <div className="marketplace-layout">
      <section className="round-browser" aria-labelledby="rounds-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Canonical marketplace</p>
            <h1 id="rounds-title">Find a clearing round</h1>
            <p className="lede">Join an open access market or inspect a validator-cleared result.</p>
          </div>
          <button className="button button-primary" type="button" onClick={onCreateRound}>
            <Plus aria-hidden="true" /> Start new round
          </button>
        </div>

        <div className="role-guide" aria-label="How to participate">
          <div><UsersThree aria-hidden="true" /><strong>Create</strong><span>Open and operate a bounded market.</span></div>
          <div><PaperPlaneTilt aria-hidden="true" /><strong>Provide</strong><span>Bond an agent access promise.</span></div>
          <div><LockKey aria-hidden="true" /><strong>Request</strong><span>Escrow a need for semantic matching.</span></div>
        </div>

        <div className="filter-bar" aria-label="Round lifecycle filter">
          {filterLabels.map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "filter-button filter-button-active" : "filter-button"}
              type="button"
              aria-label={label}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}<span>{filterRounds(snapshot.rounds, value).length}</span>
            </button>
          ))}
        </div>

        {visibleRounds.length ? (
          <div className="round-list">
            {visibleRounds.map((round) => (
              <button
                key={round.id}
                className={round.id === selectedRoundId ? "round-row round-row-active" : "round-row"}
                type="button"
                aria-label={`Open round ${round.title}`}
                onClick={() => selectRound(round)}
              >
                <span className="round-row-main"><strong>{round.title}</strong><small>{round.id}</small></span>
                <span className="round-row-capacity">{round.offerCount}/4 offers<br />{round.requestCount}/4 requests</span>
                <span className={`phase-badge phase-${round.phase.toLowerCase()}`}>{round.phase}</span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <ShieldWarning aria-hidden="true" />
            <h2>No rounds in this state</h2>
            <p>Create a round or choose another lifecycle filter.</p>
          </div>
        )}
      </section>

      <RoundDetail
        {...{ snapshot, adapter, busy, runWrite }}
        round={selectedRound}
        onCreateRound={onCreateRound}
      />
    </div>
  );
}

export function CreateRound({ snapshot, adapter, busy, runWrite, onCreated }: SharedProps & { onCreated: (roundId: string) => void }) {
  const [roundId, setRoundId] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ready = snapshot.availability === "ready" && Boolean(snapshot.account);

  function submit(event: FormEvent) {
    event.preventDefault();
    const checkedId = validateIdentifier(roundId, "Round ID");
    const checkedTitle = validateText(title, "Round title", 3, 120);
    const nextErrors = {
      ...(checkedId.error ? { roundId: checkedId.error } : {}),
      ...(checkedTitle.error ? { title: checkedTitle.error } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const createdId = checkedId.value;
    void runWrite(
      () => adapter.openRound({ roundId: createdId, title: checkedTitle.value }),
      () => onCreated(createdId),
    );
  }

  return (
    <section className="create-view" aria-labelledby="create-title">
      <div className="create-intro">
        <p className="eyebrow">Community-created markets</p>
        <h1 id="create-title">Start a clearing round</h1>
        <p className="lede">Choose a stable identity and invite providers and requesters into one bounded semantic decision.</p>
        <div className="creator-responsibility">
          <CheckCircle aria-hidden="true" />
          <p>You become the round creator for normal operation. If a deadline passes, any wallet can trigger refund-only recovery.</p>
        </div>
      </div>
      <form className="create-form" onSubmit={submit} noValidate>
        <Field id="create-round-id" label="Round ID" value={roundId} onChange={setRoundId} hint="3-80 characters. Letters, numbers, hyphen, underscore, or period." error={errors.roundId} maxLength={80} required />
        <Field id="create-round-title" label="Round title" value={title} onChange={setTitle} hint="Describe the access window in plain language." error={errors.title} maxLength={120} required />
        <button className="button button-primary button-full" disabled={!ready || busy} type="submit">
          <Plus aria-hidden="true" /> {busy ? "Waiting for finality" : "Open round"}
        </button>
        {!ready ? <p className="form-status">Connect a Studionet wallet to create a round.</p> : null}
      </form>
    </section>
  );
}

function RoundDetail({ snapshot, adapter, busy, runWrite, round, onCreateRound }: SharedProps & { round: RoundView | null; onCreateRound: () => void }) {
  if (!round) {
    return (
      <aside className="round-detail empty-detail" aria-label="Round detail">
        <ArrowLeft aria-hidden="true" />
        <h2>Select a round</h2>
        <p>Choose a canonical round to inspect its economics and available actions.</p>
      </aside>
    );
  }

  const account = snapshot.account;
  const creator = Boolean(account && account.toLowerCase() === round.creator.toLowerCase());
  const hasOffer = snapshot.positions.some((position) => position.roundId === round.id && position.kind === "offer");
  const hasRequest = snapshot.positions.some((position) => position.roundId === round.id && position.kind === "request");
  const terminal = round.phase === "CLEARED" || round.phase === "CANCELLED";
  const recoverable = Boolean(account && round.expired && (round.phase === "OPEN" || round.phase === "LOCKED" || round.phase === "RETRYABLE"));

  return (
    <aside className="round-detail" aria-labelledby="selected-round-title">
      <div className="detail-header">
        <span className={`phase-badge phase-${round.phase.toLowerCase()}`}>{round.phase}</span>
        <span className="mono-meta">{round.id}</span>
      </div>
      <h2 id="selected-round-title">{round.title}</h2>
      <p className="creator-line">Created by {shortAddress(round.creator)}</p>

      <div className="detail-metrics" aria-label="Selected round economics">
        <Metric label="Offers" value={`${round.offerCount}/4`} />
        <Metric label="Requests" value={`${round.requestCount}/4`} />
        <Metric label="Provider bond" value={`${round.providerBondGen} GEN`} />
        <Metric label="Booking fee" value={`${round.feeGen} GEN`} />
      </div>

      {snapshot.availability !== "ready" || !account ? (
        <div className="inline-guidance"><LockKey aria-hidden="true" /><p>Connect a Studionet wallet to join or operate this round.</p></div>
      ) : null}

      {round.phase === "OPEN" && account && !round.expired ? (
        <div className="participation-stack">
          {!hasOffer && round.offerCount < 4 ? <OfferForm roundId={round.id} adapter={adapter} busy={busy} runWrite={runWrite} /> : null}
          {!hasRequest && round.requestCount < 4 ? <RequestForm roundId={round.id} adapter={adapter} busy={busy} runWrite={runWrite} /> : null}
          {creator ? (
            <div className="creator-controls">
              <div><strong>Creator controls</strong><p>Lock after both sides have joined, or cancel to credit every recorded deposit.</p></div>
              <button className="button button-primary" type="button" disabled={busy || round.offerCount === 0 || round.requestCount === 0} onClick={() => void runWrite(() => adapter.lockRound(round.id))}>Lock round</button>
              <button className="button button-danger" type="button" disabled={busy} onClick={() => void runWrite(() => adapter.cancelRound(round.id))}>Cancel and credit deposits</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {creator && !round.expired && (round.phase === "LOCKED" || round.phase === "RETRYABLE") ? (
        <button className="button button-primary button-full" disabled={busy} onClick={() => void runWrite(() => adapter.clearRound(round.id))}>
          {round.phase === "RETRYABLE" ? "Retry semantic clearing" : "Clear round semantically"}
        </button>
      ) : null}

      {recoverable ? (
        <div className="creator-controls">
          <div><strong>Timeout recovery</strong><p>Deadline passed. Any wallet can refund locked deposits without releasing provider fees.</p></div>
          <button className="button button-danger" type="button" disabled={busy} onClick={() => void runWrite(() => adapter.recoverExpiredRound(round.id))}>Recover expired round</button>
        </div>
      ) : null}

      {terminal ? (
        <div className="terminal-action">
          <p>This round is complete. Its result remains available as canonical history.</p>
          <button className="button button-primary button-full" type="button" onClick={onCreateRound}><Plus aria-hidden="true" />Create another round</button>
        </div>
      ) : null}

      <BoundaryNote />
    </aside>
  );
}

function OfferForm({ roundId, adapter, busy, runWrite }: Pick<SharedProps, "adapter" | "busy" | "runWrite"> & { roundId: string }) {
  const [offerId, setOfferId] = useState("");
  const [label, setLabel] = useState("");
  const [promise, setPromise] = useState("");
  const [capabilityIds, setCapabilityIds] = useState("");
  const [agentId, setAgentId] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [metadataHash, setMetadataHash] = useState("");
  const [metadataIssuer, setMetadataIssuer] = useState("SkillSlotAgentRegistry");
  const [metadataSignature, setMetadataSignature] = useState("");
  const [metadataExpiresAt, setMetadataExpiresAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const checkedId = validateIdentifier(offerId, "Offer ID");
    const checkedLabel = validateText(label, "Offer label", 3, 120);
    const checkedPromise = validateText(promise, "Access promise", 1, 600);
    const checkedCapabilities = validateCapabilityCsv(capabilityIds, "Capability IDs");
    const checkedAgentId = validateIdentifier(agentId, "Agent ID");
    const checkedUri = validateText(metadataUri, "Metadata URI", 10, 600);
    const checkedHash = validateText(metadataHash, "Metadata hash", 64, 64);
    const checkedIssuer = validateText(metadataIssuer, "Metadata issuer", 3, 120);
    const checkedSignature = validateText(metadataSignature, "Metadata signature", 10, 600);
    const checkedExpiresAt = validateText(metadataExpiresAt, "Metadata expiry", 1, 20);
    const nextErrors = {
      ...(checkedId.error ? { offerId: checkedId.error } : {}),
      ...(checkedLabel.error ? { label: checkedLabel.error } : {}),
      ...(checkedPromise.error ? { promise: checkedPromise.error } : {}),
      ...(checkedCapabilities.error ? { capabilityIds: checkedCapabilities.error } : {}),
      ...(checkedAgentId.error ? { agentId: checkedAgentId.error } : {}),
      ...(checkedUri.error ? { metadataUri: checkedUri.error } : {}),
      ...(checkedHash.error ? { metadataHash: checkedHash.error } : {}),
      ...(checkedIssuer.error ? { metadataIssuer: checkedIssuer.error } : {}),
      ...(checkedSignature.error ? { metadataSignature: checkedSignature.error } : {}),
      ...(checkedExpiresAt.error || !/^\d+$/.test(checkedExpiresAt.value) ? { metadataExpiresAt: checkedExpiresAt.error || "Metadata expiry must be a Unix timestamp." } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void runWrite(() => adapter.submitOffer({
      roundId,
      offerId: checkedId.value,
      label: checkedLabel.value,
      promise: checkedPromise.value,
      capabilityIds: checkedCapabilities.value,
      agentId: checkedAgentId.value,
      metadataUri: checkedUri.value,
      metadataHash: checkedHash.value,
      metadataIssuer: checkedIssuer.value,
      metadataSignature: checkedSignature.value,
      metadataExpiresAt: checkedExpiresAt.value,
    }));
  }
  return <details className="action-disclosure" open><summary>Offer an agent</summary><form className="action-form" onSubmit={submit} noValidate>
    <Field id="offer-id" label="Offer ID" value={offerId} onChange={setOfferId} error={errors.offerId} maxLength={80} required />
    <Field id="offer-label" label="Offer label" value={label} onChange={setLabel} error={errors.label} maxLength={120} required />
    <Field id="offer-promise" label="Access promise" value={promise} onChange={setPromise} error={errors.promise} maxLength={600} multiline required />
    <Field id="offer-capabilities" label="Capability IDs" value={capabilityIds} onChange={setCapabilityIds} error={errors.capabilityIds} maxLength={600} hint="Example: scheduling,flight-search" />
    <Field id="agent-id" label="Agent ID" value={agentId} onChange={setAgentId} error={errors.agentId} maxLength={80} hint="Must match the registry metadata." required />
    <Field id="metadata-uri" label="Metadata URI" value={metadataUri} onChange={setMetadataUri} error={errors.metadataUri} maxLength={600} hint="Allowed registry source for this agent." required />
    <Field id="metadata-hash" label="Metadata hash" value={metadataHash} onChange={setMetadataHash} error={errors.metadataHash} maxLength={64} hint="SHA-256 of the fetched metadata body." required />
    <Field id="metadata-issuer" label="Metadata issuer" value={metadataIssuer} onChange={setMetadataIssuer} error={errors.metadataIssuer} maxLength={120} required />
    <Field id="metadata-signature" label="Metadata signature" value={metadataSignature} onChange={setMetadataSignature} error={errors.metadataSignature} maxLength={600} required />
    <Field id="metadata-expiry" label="Metadata expiry" value={metadataExpiresAt} onChange={setMetadataExpiresAt} error={errors.metadataExpiresAt} maxLength={20} hint="Unix seconds. Expired metadata cannot receive fees." required />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt aria-hidden="true" />Submit offer for 1 GEN</button>
  </form></details>;
}

function RequestForm({ roundId, adapter, busy, runWrite }: Pick<SharedProps, "adapter" | "busy" | "runWrite"> & { roundId: string }) {
  const [requestId, setRequestId] = useState("");
  const [label, setLabel] = useState("");
  const [need, setNeed] = useState("");
  const [requiredIds, setRequiredIds] = useState("");
  const [excludedIds, setExcludedIds] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const checkedId = validateIdentifier(requestId, "Request ID");
    const checkedLabel = validateText(label, "Request label", 3, 120);
    const checkedNeed = validateText(need, "Access need", 1, 600);
    const checkedRequired = validateCapabilityCsv(requiredIds, "Required capability IDs");
    const checkedExcluded = validateCapabilityCsv(excludedIds, "Excluded capability IDs");
    const nextErrors = {
      ...(checkedId.error ? { requestId: checkedId.error } : {}),
      ...(checkedLabel.error ? { label: checkedLabel.error } : {}),
      ...(checkedNeed.error ? { need: checkedNeed.error } : {}),
      ...(checkedRequired.error ? { requiredIds: checkedRequired.error } : {}),
      ...(checkedExcluded.error ? { excludedIds: checkedExcluded.error } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void runWrite(() => adapter.submitRequest({
      roundId,
      requestId: checkedId.value,
      label: checkedLabel.value,
      need: checkedNeed.value,
      requiredIds: checkedRequired.value,
      excludedIds: checkedExcluded.value,
    }));
  }
  return <details className="action-disclosure"><summary>Request access</summary><form className="action-form" onSubmit={submit} noValidate>
    <Field id="request-id" label="Request ID" value={requestId} onChange={setRequestId} error={errors.requestId} maxLength={80} required />
    <Field id="request-label" label="Request label" value={label} onChange={setLabel} error={errors.label} maxLength={120} required />
    <Field id="request-need" label="Access need" value={need} onChange={setNeed} error={errors.need} maxLength={600} multiline required />
    <Field id="required-capabilities" label="Required capability IDs" value={requiredIds} onChange={setRequiredIds} error={errors.requiredIds} maxLength={600} hint="Example: scheduling,flight-search" />
    <Field id="excluded-capabilities" label="Excluded capability IDs" value={excludedIds} onChange={setExcludedIds} error={errors.excludedIds} maxLength={600} hint="Optional. Example: ticket-purchase" />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt aria-hidden="true" />Submit request for 1 GEN</button>
  </form></details>;
}

function Field({ id, label, value, onChange, required = false, multiline = false, hint, error, maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; multiline?: boolean; hint?: string; error?: string; maxLength?: number }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    "aria-label": label,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    value,
    required,
    maxLength,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  return <label className="field" htmlFor={id}><span>{label}</span>{multiline ? <textarea {...shared} /> : <input {...shared} />}{hint ? <small id={hintId}>{hint}</small> : null}{error ? <small className="field-error" id={errorId} role="alert">{error}</small> : null}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function BoundaryNote() {
  return <div className="boundary-note"><CheckCircle aria-hidden="true" /><p>A match reserves access. It does not certify performance, fulfillment, identity, or service quality.</p></div>;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
