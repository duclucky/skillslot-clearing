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
import { type FormEvent, useMemo, useState } from "react";

import type { ContractAdapter, RoundView, WorkspaceSnapshot } from "./domain";
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
  const ready = snapshot.availability === "ready" && Boolean(snapshot.account);

  function submit(event: FormEvent) {
    event.preventDefault();
    const createdId = roundId.trim();
    void runWrite(
      () => adapter.openRound({ roundId: createdId, title }),
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
          <p>You become the round creator. Only your wallet can lock, clear, retry, or safely cancel it.</p>
        </div>
      </div>
      <form className="create-form" onSubmit={submit}>
        <Field id="create-round-id" label="Round ID" value={roundId} onChange={setRoundId} hint="3-80 characters. Letters, numbers, hyphen, underscore, or period." required />
        <Field id="create-round-title" label="Round title" value={title} onChange={setTitle} hint="Describe the access window in plain language." required />
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

      {round.phase === "OPEN" && account ? (
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

      {creator && (round.phase === "LOCKED" || round.phase === "RETRYABLE") ? (
        <button className="button button-primary button-full" disabled={busy} onClick={() => void runWrite(() => adapter.clearRound(round.id))}>
          {round.phase === "RETRYABLE" ? "Retry semantic clearing" : "Clear round semantically"}
        </button>
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
  function submit(event: FormEvent) {
    event.preventDefault();
    void runWrite(() => adapter.submitOffer({ roundId, offerId, label, promise, capabilityIds }));
  }
  return <details className="action-disclosure" open><summary>Offer an agent</summary><form className="action-form" onSubmit={submit}>
    <Field id="offer-id" label="Offer ID" value={offerId} onChange={setOfferId} required />
    <Field id="offer-label" label="Offer label" value={label} onChange={setLabel} required />
    <Field id="offer-promise" label="Access promise" value={promise} onChange={setPromise} multiline required />
    <Field id="offer-capabilities" label="Capability IDs" value={capabilityIds} onChange={setCapabilityIds} hint="Example: scheduling,flight-search" />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt aria-hidden="true" />Submit offer for 1 GEN</button>
  </form></details>;
}

function RequestForm({ roundId, adapter, busy, runWrite }: Pick<SharedProps, "adapter" | "busy" | "runWrite"> & { roundId: string }) {
  const [requestId, setRequestId] = useState("");
  const [label, setLabel] = useState("");
  const [need, setNeed] = useState("");
  const [requiredIds, setRequiredIds] = useState("");
  const [excludedIds, setExcludedIds] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    void runWrite(() => adapter.submitRequest({ roundId, requestId, label, need, requiredIds, excludedIds }));
  }
  return <details className="action-disclosure"><summary>Request access</summary><form className="action-form" onSubmit={submit}>
    <Field id="request-id" label="Request ID" value={requestId} onChange={setRequestId} required />
    <Field id="request-label" label="Request label" value={label} onChange={setLabel} required />
    <Field id="request-need" label="Access need" value={need} onChange={setNeed} multiline required />
    <Field id="required-capabilities" label="Required capability IDs" value={requiredIds} onChange={setRequiredIds} hint="Example: scheduling,flight-search" />
    <Field id="excluded-capabilities" label="Excluded capability IDs" value={excludedIds} onChange={setExcludedIds} hint="Optional. Example: ticket-purchase" />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt aria-hidden="true" />Submit request for 1 GEN</button>
  </form></details>;
}

function Field({ id, label, value, onChange, required = false, multiline = false, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; multiline?: boolean; hint?: string }) {
  const descriptionId = hint ? `${id}-hint` : undefined;
  return <label className="field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} aria-label={label} aria-describedby={descriptionId} value={value} required={required} onChange={(event) => onChange(event.target.value)} /> : <input id={id} aria-label={label} aria-describedby={descriptionId} value={value} required={required} onChange={(event) => onChange(event.target.value)} />}{hint ? <small id={descriptionId}>{hint}</small> : null}</label>;
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
