import {
  ArrowsClockwise,
  ArrowsLeftRight,
  Coins,
  LockKey,
  Plus,
  ShieldWarning,
  Wallet,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  configuredContractAddress,
  createConfiguredAdapter,
  createUnconfiguredAdapter,
  ONE_GEN_WEI,
} from "./contractAdapter";
import type { ContractAdapter, TransactionProgress, WorkspaceSnapshot } from "./domain";
import { CreateRound, Marketplace, type RunWrite } from "./Marketplace";
import { defaultRoundId } from "./roundFilters";
import "./styles.css";

type Destination = "rounds" | "create" | "activity";

interface AppProps {
  adapter?: ContractAdapter;
}

const initialSnapshot: WorkspaceSnapshot = {
  availability: "unavailable",
  account: null,
  networkName: null,
  contractAddress: null,
  rounds: [],
  positions: [],
  creditGen: "0",
  accountingInvariant: null,
};

const destinations: Array<{ id: Destination; label: string; icon: typeof ArrowsLeftRight }> = [
  { id: "rounds", label: "Rounds", icon: ArrowsLeftRight },
  { id: "create", label: "Create round", icon: Plus },
  { id: "activity", label: "My activity", icon: LockKey },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function genToWei(value: string) {
  const [whole = "0", decimal = ""] = value.split(".");
  return (BigInt(whole) * ONE_GEN_WEI + BigInt(decimal.padEnd(18, "0").slice(0, 18) || "0")).toString();
}

export function App({ adapter: suppliedAdapter }: AppProps) {
  const [destination, setDestination] = useState<Destination>("rounds");
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
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
      const next = await adapter.loadWorkspace();
      setSnapshot(next);
      setSelectedRoundId((current) => current && next.rounds.some((round) => round.id === current) ? current : defaultRoundId(next.rounds));
      return next;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Workspace could not be loaded.");
      return null;
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

  const runWrite: RunWrite = async (action, afterFinalized) => {
    setBusy(true);
    setLoadError(null);
    try {
      await action();
      const next = await refresh();
      if (next && afterFinalized) afterFinalized(next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  };

  function openCreate() {
    setDestination("create");
  }

  function showCreated(roundId: string) {
    setSelectedRoundId(roundId);
    setDestination("rounds");
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
        {destinations.map(({ id, label, icon: Icon }) => (
          <button key={id} className={destination === id ? "nav-item nav-item-active" : "nav-item"} type="button" aria-pressed={destination === id} onClick={() => setDestination(id)}>
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <main id="workspace" className="workspace" tabIndex={-1}>
        {transaction ? <TransactionNotice transaction={transaction} /> : null}
        {loadError ? (
          <section className="notice notice-danger" role="alert">
            <ShieldWarning aria-hidden="true" />
            <div><p className="notice-title">Action unavailable</p><p>{loadError}</p><button className="text-action" type="button" onClick={() => void refresh()}>Retry state read</button></div>
          </section>
        ) : null}
        {unconfigured && !loading ? <ConfigurationNotice availability={snapshot.availability} /> : null}
        {loading ? <LoadingState /> : null}
        {!loading && destination === "rounds" ? (
          <Marketplace
            snapshot={snapshot}
            adapter={adapter}
            busy={busy}
            runWrite={runWrite}
            selectedRoundId={selectedRoundId}
            onSelectRound={setSelectedRoundId}
            onCreateRound={openCreate}
          />
        ) : null}
        {!loading && destination === "create" ? <CreateRound snapshot={snapshot} adapter={adapter} busy={busy} runWrite={runWrite} onCreated={showCreated} /> : null}
        {!loading && destination === "activity" ? <Activity snapshot={snapshot} adapter={adapter} busy={busy} runWrite={runWrite} onOpenRound={(roundId) => { setSelectedRoundId(roundId); setDestination("rounds"); }} /> : null}
      </main>
    </div>
  );
}

function TransactionNotice({ transaction }: { transaction: TransactionProgress }) {
  const labels: Record<TransactionProgress["stage"], string> = {
    wallet: "Waiting for wallet confirmation",
    submitted: "Submitted to Studionet",
    accepted: "Accepted by the network",
    finalized: "Finalized and reloading canonical state",
    failed: "Transaction failed",
  };
  return (
    <section className={transaction.stage === "failed" ? "transaction-strip transaction-failed" : "transaction-strip"} aria-live="polite">
      <ArrowsClockwise aria-hidden="true" />
      <span><strong>{labels[transaction.stage]}</strong><small>{transaction.functionName}{transaction.hash ? ` ${shortAddress(transaction.hash)}` : ""}</small></span>
    </section>
  );
}

function Activity({ snapshot, adapter, busy, runWrite, onOpenRound }: { snapshot: WorkspaceSnapshot; adapter: ContractAdapter; busy: boolean; runWrite: RunWrite; onOpenRound: (roundId: string) => void }) {
  return <section className="positions-view" aria-labelledby="activity-title">
    <p className="eyebrow">Wallet-scoped canonical state</p>
    <h1 id="activity-title">My activity</h1>
    <p className="lede">Offers, requests, grants, and withdrawable GEN across every clearing round.</p>
    <div className="positions-summary"><div><span>Withdrawable credit</span><strong>{snapshot.account ? `${snapshot.creditGen} GEN` : "- GEN"}</strong></div>
      <button className="button button-primary" type="button" disabled={!snapshot.account || busy || snapshot.creditGen === "0"} onClick={() => void runWrite(() => adapter.withdrawCredit(genToWei(snapshot.creditGen)))}><Coins aria-hidden="true" />Withdraw {snapshot.creditGen} GEN</button>
    </div>
    {snapshot.positions.length ? <div className="position-list">{snapshot.positions.map((position) => <article className="position-card" key={`${position.kind}:${position.id}`}><button className="position-link" type="button" onClick={() => onOpenRound(position.roundId)}><span>{position.kind}</span><h2>{position.summary}</h2><p>{position.id} {position.status}</p></button>{position.kind === "grant" && position.status === "ACTIVE" && position.requestId ? <button className="button button-secondary" disabled={busy} onClick={() => void runWrite(() => adapter.consumeGrant({ roundId: position.roundId, requestId: position.requestId! }))}>Consume grant</button> : null}</article>)}</div> : <div className="empty-state"><LockKey aria-hidden="true" /><h2>No wallet activity yet</h2><p>Join an open round or create one to begin.</p></div>}
  </section>;
}

function LoadingState() {
  return <section className="loading-state" aria-label="Loading canonical marketplace"><div /><div /><div /></section>;
}

function ConfigurationNotice({ availability }: { availability: WorkspaceSnapshot["availability"] }) {
  return <section className="notice" aria-labelledby="configuration-title"><ShieldWarning aria-hidden="true" /><div><h2 id="configuration-title" className="notice-title">{availability === "wrong_network" ? "Wallet is on the wrong network" : "Contract not configured"}</h2><p>No address, wallet state, balance, transaction, or finality is being simulated.</p></div></section>;
}
