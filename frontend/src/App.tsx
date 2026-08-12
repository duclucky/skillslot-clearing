import {
  ArrowsClockwise,
  ArrowsLeftRight,
  LockKey,
  Plus,
  ShieldWarning,
  Wallet,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  configuredContractAddress,
  createConfiguredAdapter,
  createUnconfiguredAdapter,
} from "./contractAdapter";
import { Activity } from "./Activity";
import type { ContractAdapter, TransactionProgress, WorkspaceSnapshot } from "./domain";
import { CreateRound, Marketplace, type RunWrite } from "./Marketplace";
import { defaultRoundId } from "./roundFilters";
import {
  isTransactionCancelled,
  isTransactionSubmissionUncertain,
} from "./transactionRecovery";
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

export function App({ adapter: suppliedAdapter }: AppProps) {
  const [destination, setDestination] = useState<Destination>("rounds");
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TransactionProgress | null>(null);
  const transactionRef = useRef<TransactionProgress | null>(null);
  const updateTransaction = useCallback((next: TransactionProgress | null) => {
    transactionRef.current = next;
    setTransaction(next);
  }, []);

  const adapter = useMemo(() => {
    if (suppliedAdapter) return suppliedAdapter;
    const address = configuredContractAddress();
    return address ? createConfiguredAdapter(address) : createUnconfiguredAdapter();
  }, [suppliedAdapter]);

  useEffect(
    () =>
      adapter.subscribeTransactions(updateTransaction),
    [adapter, updateTransaction],
  );

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

  useEffect(() => {
    const recoverCanonicalState = async () => {
      const next = await refresh();
      if (
        next &&
        (transactionRef.current?.reason === "canonical_sync" ||
          transactionRef.current?.reason === "submission_uncertain")
      ) {
        updateTransaction(null);
      }
    };
    const recover = () => void recoverCanonicalState();
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    return () => {
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
    };
  }, [refresh, updateTransaction]);

  async function connect() {
    setBusy(true);
    setActionError(null);
    setRecoveryMessage(null);
    try {
      await adapter.connectWallet();
      await refresh();
    } catch (error) {
      if (isTransactionCancelled(error)) return;
      setActionError(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  const runWrite: RunWrite = async (action, afterFinalized) => {
    setBusy(true);
    setActionError(null);
    setRecoveryMessage(null);
    try {
      await action();
      const current = transactionRef.current;
      if (current) {
        updateTransaction({ ...current, stage: "recovering", reason: "canonical_sync" });
      }
      const next = await refresh();
      if (next) {
        updateTransaction(null);
        if (afterFinalized) afterFinalized(next);
      }
    } catch (error) {
      if (isTransactionCancelled(error)) {
        updateTransaction(null);
        return;
      }
      const next = await refresh();
      if (transactionRef.current?.reason === "submission_uncertain" && next) {
        updateTransaction(null);
      }
      if (isTransactionSubmissionUncertain(error)) {
        setRecoveryMessage(error.message);
        return;
      }
      setActionError(error instanceof Error ? error.message : "Transaction failed.");
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
            <div><p className="notice-title">Canonical state unavailable</p><p>{loadError}</p><button className="text-action" type="button" onClick={() => void refresh()}>Retry state read</button></div>
          </section>
        ) : null}
        {actionError ? (
          <section className="notice notice-danger" role="alert">
            <ShieldWarning aria-hidden="true" />
            <div><p className="notice-title">Transaction did not complete</p><p>{actionError}</p></div>
          </section>
        ) : null}
        {recoveryMessage ? (
          <section className="notice" role="status" aria-live="polite">
            <ArrowsClockwise aria-hidden="true" />
            <div><p className="notice-title">Submission status uncertain</p><p>{recoveryMessage}</p></div>
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
    wallet: "Confirm in wallet",
    submitted: "Submitted to Studionet",
    accepted: "Accepted by the network",
    recovering: transaction.reason === "canonical_sync" ? "Syncing canonical state" : "Checking network status",
    finalized: "Finalized",
    cancelled: "Cancelled",
    failed: "Transaction failed",
  };
  if (transaction.stage === "cancelled") return null;
  return (
    <section className={transaction.stage === "failed" ? "transaction-strip transaction-failed" : "transaction-strip"} aria-live="polite">
      <ArrowsClockwise aria-hidden="true" />
      <span><strong>{labels[transaction.stage]}</strong><small>{transaction.functionName}{transaction.hash ? ` ${shortAddress(transaction.hash)}` : ""}</small></span>
    </section>
  );
}

function LoadingState() {
  return <section className="loading-state" aria-label="Loading canonical marketplace"><div /><div /><div /></section>;
}

function ConfigurationNotice({ availability }: { availability: WorkspaceSnapshot["availability"] }) {
  return <section className="notice" aria-labelledby="configuration-title"><ShieldWarning aria-hidden="true" /><div><h2 id="configuration-title" className="notice-title">{availability === "wrong_network" ? "Wallet is on the wrong network" : "Contract not configured"}</h2><p>No address, wallet state, balance, transaction, or finality is being simulated.</p></div></section>;
}
