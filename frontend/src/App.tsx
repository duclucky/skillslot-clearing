import {
  ArrowRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  CheckCircle,
  Coins,
  LockKey,
  PaperPlaneTilt,
  Plugs,
  ShieldWarning,
  Wallet,
} from "@phosphor-icons/react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  configuredContractAddress,
  createConfiguredAdapter,
  createUnconfiguredAdapter,
  ONE_GEN_WEI,
} from "./contractAdapter";
import type { ContractAdapter, TransactionProgress, WorkspaceSnapshot } from "./domain";
import "./styles.css";

type Destination = "floor" | "positions";

interface AppProps {
  adapter?: ContractAdapter;
}

const initialSnapshot: WorkspaceSnapshot = {
  availability: "unavailable",
  account: null,
  networkName: null,
  contractAddress: null,
  round: null,
  positions: [],
  creditGen: "0",
  accountingInvariant: null,
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function genToWei(value: string) {
  const [whole = "0", decimal = ""] = value.split(".");
  return (BigInt(whole) * ONE_GEN_WEI + BigInt(decimal.padEnd(18, "0").slice(0, 18) || "0")).toString();
}

export function App({ adapter: suppliedAdapter }: AppProps) {
  const [destination, setDestination] = useState<Destination>("floor");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TransactionProgress | null>(null);

  const adapter = useMemo(() => {
    if (suppliedAdapter) return suppliedAdapter;
    const address = configuredContractAddress();
    return address ? createConfiguredAdapter(address, setTransaction) : createUnconfiguredAdapter();
  }, [suppliedAdapter]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setSnapshot(await adapter.loadWorkspace());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    setBusy(true);
    setLoadError(null);
    try {
      await adapter.connectWallet();
      await refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runWrite(action: () => Promise<unknown>) {
    setBusy(true);
    setLoadError(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  const unconfigured = snapshot.availability === "unconfigured";
  const canConnect = !unconfigured && !loading && !busy && (!snapshot.account || snapshot.availability === "wrong_network");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>

      <header className="topbar">
        <a className="brand" href="/" aria-label="SkillSlot Clearing home">
          <span className="brand-mark" aria-hidden="true"><ArrowsLeftRight weight="bold" /></span>
          <span><strong>SkillSlot</strong><small>Semantic access clearing</small></span>
        </a>
        <div className="connection-cluster">
          <div className="network-state" aria-label="Network and contract status">
            <span className="status-dot" aria-hidden="true" />
            <span>{snapshot.networkName ?? "Network unavailable"}</span>
          </div>
          <button className="button button-secondary" type="button" disabled={!canConnect} onClick={() => void connect()}>
            <Wallet aria-hidden="true" />
            {snapshot.availability === "wrong_network" ? "Switch to Studionet" : snapshot.account ? shortAddress(snapshot.account) : busy ? "Waiting for wallet" : "Connect wallet"}
          </button>
        </div>
      </header>

      <nav className="primary-nav" aria-label="Workspace destinations">
        <button className={destination === "floor" ? "nav-item nav-item-active" : "nav-item"} type="button" aria-pressed={destination === "floor"} onClick={() => setDestination("floor")}>
          <ArrowsLeftRight aria-hidden="true" /> Clearing floor
        </button>
        <button className={destination === "positions" ? "nav-item nav-item-active" : "nav-item"} type="button" aria-pressed={destination === "positions"} onClick={() => setDestination("positions")}>
          <LockKey aria-hidden="true" /> My access &amp; credits
        </button>
      </nav>

      <main id="workspace" className="workspace" tabIndex={-1}>
        {transaction ? <TransactionNotice transaction={transaction} /> : null}
        {loadError ? (
          <section className="notice notice-danger" role="alert">
            <ShieldWarning aria-hidden="true" />
            <div><p className="notice-title">Action unavailable</p><p>{loadError}</p></div>
          </section>
        ) : null}
        {destination === "floor" ? (
          <ClearingFloor snapshot={snapshot} adapter={adapter} loading={loading} busy={busy} runWrite={runWrite} />
        ) : (
          <Positions snapshot={snapshot} adapter={adapter} loading={loading} busy={busy} runWrite={runWrite} />
        )}
      </main>
    </div>
  );
}

function TransactionNotice({ transaction }: { transaction: TransactionProgress }) {
  return (
    <section className={transaction.stage === "failed" ? "transaction-strip transaction-failed" : "transaction-strip"} aria-live="polite">
      <ArrowsClockwise aria-hidden="true" />
      <span><strong>{transaction.stage}</strong> · {transaction.functionName} {transaction.hash ? `· ${shortAddress(transaction.hash)}` : ""}</span>
    </section>
  );
}

type ActionProps = {
  snapshot: WorkspaceSnapshot;
  adapter: ContractAdapter;
  loading: boolean;
  busy: boolean;
  runWrite: (action: () => Promise<unknown>) => Promise<void>;
};

function ClearingFloor(props: ActionProps) {
  const { snapshot, loading } = props;
  const unavailable = snapshot.availability !== "ready";
  return (
    <div className="workspace-grid">
      <section className="canonical-column" aria-labelledby="round-title">
        <p className="eyebrow">Canonical round state</p>
        <div className="title-row">
          <div>
            <h1 id="round-title">{snapshot.round?.title ?? "No clearing round loaded"}</h1>
            <p className="lede">Bounded offers and needs are judged by meaning. Matching, access rights, and GEN accounting stay deterministic onchain.</p>
          </div>
          <span className="phase-badge"><span className="status-dot" aria-hidden="true" />{loading ? "Loading" : snapshot.round?.phase ?? "Unavailable"}</span>
        </div>
        {unavailable && !loading ? <ConfigurationNotice availability={snapshot.availability} /> : null}
        <div className="metric-strip" aria-label="Round limits and economics">
          <Metric label="Offer slots" value={snapshot.round ? `${snapshot.round.offerCount}/4` : "—/4"} />
          <Metric label="Request slots" value={snapshot.round ? `${snapshot.round.requestCount}/4` : "—/4"} />
          <Metric label="Provider bond" value={snapshot.round ? `${snapshot.round.providerBondGen} GEN` : "1 GEN"} />
          <Metric label="Booking fee" value={snapshot.round ? `${snapshot.round.feeGen} GEN` : "1 GEN"} />
        </div>
        <section className="process-panel" aria-labelledby="process-title">
          <p className="eyebrow">What the contract owns</p><h2 id="process-title">One bounded clearing lifecycle</h2>
          <ol className="process-list">
            <ProcessStep number="01" title="Commit a position" text="Providers bond a promise; requesters escrow a booking fee." />
            <ProcessStep number="02" title="Lock and judge" text="Validators decide semantic compatibility across the complete bounded set." />
            <ProcessStep number="03" title="Settle deterministically" text="The contract assigns one route grant per match and credits refunds or fees." />
          </ol>
        </section>
      </section>
      <ActionRail {...props} />
    </div>
  );
}

function ActionRail({ snapshot, adapter, busy, runWrite }: ActionProps) {
  const round = snapshot.round;
  const account = snapshot.account;
  const creator = Boolean(account && round && account.toLowerCase() === round.creator.toLowerCase());
  if (snapshot.availability !== "ready" || !account) {
    return (
      <aside className="action-rail" aria-labelledby="action-title">
        <p className="eyebrow">Next available action</p><h2 id="action-title">Connect canonical state first</h2>
        <p>A configured public contract and a Studionet wallet are required. No wallet or finality is simulated.</p>
        <button className="button button-primary button-full" type="button" disabled><Plugs />Awaiting wallet connection</button>
        <BoundaryNote />
      </aside>
    );
  }
  return (
    <aside className="action-rail" aria-labelledby="action-title">
      <div className="rail-heading"><p className="eyebrow">Available onchain actions</p><span className="availability-label">Live</span></div>
      <h2 id="action-title">{round ? `${round.phase.toLowerCase()} round` : "Open a round"}</h2>
      {!round ? <OpenRoundForm adapter={adapter} busy={busy} runWrite={runWrite} /> : null}
      {round?.phase === "OPEN" ? (
        <>
          <OfferForm roundId={round.id} adapter={adapter} busy={busy} runWrite={runWrite} />
          <RequestForm roundId={round.id} adapter={adapter} busy={busy} runWrite={runWrite} />
          {creator ? <div className="button-row"><button className="button button-primary" disabled={busy} onClick={() => void runWrite(() => adapter.lockRound(round.id))}>Lock round</button><button className="button button-danger" disabled={busy} onClick={() => void runWrite(() => adapter.cancelRound(round.id))}>Cancel round</button></div> : null}
        </>
      ) : null}
      {creator && (round?.phase === "LOCKED" || round?.phase === "RETRYABLE") ? (
        <button className="button button-primary button-full" disabled={busy} onClick={() => void runWrite(() => adapter.clearRound(round.id))}>
          {round.phase === "RETRYABLE" ? "Retry semantic clearing" : "Clear round semantically"}
        </button>
      ) : null}
      {round && !["OPEN", "LOCKED", "RETRYABLE"].includes(round.phase) ? <p>This round has no remaining clearing-floor write for this wallet.</p> : null}
      <BoundaryNote />
    </aside>
  );
}

function OpenRoundForm({ adapter, busy, runWrite }: Pick<ActionProps, "adapter" | "busy" | "runWrite">) {
  const [roundId, setRoundId] = useState("");
  const [title, setTitle] = useState("");
  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); void runWrite(() => adapter.openRound({ roundId, title })); }}>
    <Field label="Round ID" value={roundId} onChange={setRoundId} required />
    <Field label="Round title" value={title} onChange={setTitle} required />
    <button className="button button-primary button-full" disabled={busy} type="submit">Open round</button>
  </form>;
}

function OfferForm({ roundId, adapter, busy, runWrite }: Pick<ActionProps, "adapter" | "busy" | "runWrite"> & { roundId: string }) {
  const [offerId, setOfferId] = useState(""); const [label, setLabel] = useState(""); const [promise, setPromise] = useState(""); const [capabilityIds, setCapabilityIds] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); void runWrite(() => adapter.submitOffer({ roundId, offerId, label, promise, capabilityIds })); }
  return <details className="action-disclosure" open><summary>Submit provider offer</summary><form className="action-form" onSubmit={submit}>
    <Field label="Offer ID" value={offerId} onChange={setOfferId} required /><Field label="Offer label" value={label} onChange={setLabel} required />
    <Field label="Promise" value={promise} onChange={setPromise} multiline required /><Field label="Capability IDs" value={capabilityIds} onChange={setCapabilityIds} hint="Comma-separated stable IDs" />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt />Submit offer / 1 GEN</button>
  </form></details>;
}

function RequestForm({ roundId, adapter, busy, runWrite }: Pick<ActionProps, "adapter" | "busy" | "runWrite"> & { roundId: string }) {
  const [requestId, setRequestId] = useState(""); const [label, setLabel] = useState(""); const [need, setNeed] = useState(""); const [requiredIds, setRequiredIds] = useState(""); const [excludedIds, setExcludedIds] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); void runWrite(() => adapter.submitRequest({ roundId, requestId, label, need, requiredIds, excludedIds })); }
  return <details className="action-disclosure"><summary>Submit requester need</summary><form className="action-form" onSubmit={submit}>
    <Field label="Request ID" value={requestId} onChange={setRequestId} required /><Field label="Request label" value={label} onChange={setLabel} required />
    <Field label="Need" value={need} onChange={setNeed} multiline required /><Field label="Required IDs" value={requiredIds} onChange={setRequiredIds} hint="Comma-separated stable IDs" /><Field label="Excluded IDs" value={excludedIds} onChange={setExcludedIds} hint="Optional comma-separated IDs" />
    <button className="button button-primary button-full" disabled={busy} type="submit"><PaperPlaneTilt />Submit request / 1 GEN</button>
  </form></details>;
}

function Field({ label, value, onChange, required = false, multiline = false, hint }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; multiline?: boolean; hint?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <label className="field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} aria-label={label} value={value} required={required} onChange={(event) => onChange(event.target.value)} /> : <input id={id} aria-label={label} value={value} required={required} onChange={(event) => onChange(event.target.value)} />}{hint ? <small>{hint}</small> : null}</label>;
}

function Positions({ snapshot, adapter, loading, busy, runWrite }: ActionProps) {
  const activeGrants = snapshot.positions.filter((position) => position.kind === "grant" && position.status === "ACTIVE");
  return <section className="positions-view" aria-labelledby="positions-title">
    <p className="eyebrow">Wallet-scoped canonical state</p><h1 id="positions-title">My access &amp; credits</h1>
    <p className="lede">Route grants, submitted positions, and withdrawable GEN are reloaded from the contract after finalization.</p>
    <div className="positions-summary"><div><span>Withdrawable credit</span><strong>{snapshot.account ? `${snapshot.creditGen} GEN` : "— GEN"}</strong></div>
      <button className="button button-primary" type="button" disabled={!snapshot.account || loading || busy || snapshot.creditGen === "0"} onClick={() => void runWrite(() => adapter.withdrawCredit(genToWei(snapshot.creditGen)))}><Coins />Withdraw {snapshot.creditGen} GEN</button>
    </div>
    {snapshot.positions.length ? <div className="position-list">{snapshot.positions.map((position) => <article className="position-card" key={`${position.kind}:${position.id}`}><div><span>{position.kind}</span><h2>{position.summary}</h2><p>{position.id} · {position.status}</p></div>{position.kind === "grant" && position.status === "ACTIVE" && position.requestId ? <button className="button button-secondary" disabled={busy} onClick={() => void runWrite(() => adapter.consumeGrant({ roundId: position.roundId, requestId: position.requestId! }))}>Consume grant</button> : null}</article>)}</div> : <div className="empty-state"><LockKey /><h2>No wallet positions</h2><p>Connect a wallet or submit a position in an open round.</p></div>}
    {activeGrants.length ? <p className="scope-note">An active grant reserves one route. It does not certify fulfillment or agent quality.</p> : null}
  </section>;
}

function ConfigurationNotice({ availability }: { availability: WorkspaceSnapshot["availability"] }) {
  return <section className="notice" aria-labelledby="configuration-title"><ShieldWarning /><div><h2 id="configuration-title" className="notice-title">{availability === "wrong_network" ? "Wallet is on the wrong network" : "Contract not configured"}</h2><p>No address, wallet state, balance, transaction, or finality is being simulated.</p></div></section>;
}
function BoundaryNote() { return <div className="boundary-note"><CheckCircle /><p>A match reserves access. It does not certify performance, fulfillment, identity, or service quality.</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) { return <li><span className="step-number">{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>; }
