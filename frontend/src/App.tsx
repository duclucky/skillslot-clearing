import {
  ArrowsClockwise,
  ArrowsLeftRight,
  CheckCircle,
  Compass,
  LockKey,
  Plus,
  ShieldWarning,
  Wallet,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  configuredContractAddress,
  createConfiguredAdapter,
  createUnconfiguredAdapter,
} from "./contractAdapter";
import { Activity } from "./Activity";
import type { ContractAdapter, TransactionProgress, WalletChoice, WorkspaceSnapshot } from "./domain";
import { CreateRound, Marketplace, type RunWrite } from "./Marketplace";
import { defaultRoundId } from "./roundFilters";
import {
  isTransactionCancelled,
  isTransactionSubmissionUncertain,
} from "./transactionRecovery";
import { discoverWallets } from "./wallet";
import "./styles.css";

type Destination = "overview" | "rounds" | "create" | "activity";

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

const BACKGROUND_VIDEO_URL = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

const destinations: Array<{ id: Destination; label: string; icon: typeof ArrowsLeftRight }> = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "rounds", label: "Rounds", icon: ArrowsLeftRight },
  { id: "create", label: "Create round", icon: Plus },
  { id: "activity", label: "My activity", icon: LockKey },
];

const mechanismSteps = [
  {
    title: "Providers publish authenticated offers",
    body: "Each provider binds wallet identity, agent metadata, capability IDs, expiry, and bond before a promise can participate in clearing.",
  },
  {
    title: "Requesters escrow exact needs",
    body: "A requester states the needed capabilities and locks value inside the round, so matching can settle without private side deals.",
  },
  {
    title: "Validators clear semantic compatibility",
    body: "GenLayer validators compare the authenticated offer with the requester need, exclusions, and objective capability fields.",
  },
  {
    title: "Settlement releases value deterministically",
    body: "Compatible matches issue grants and provider credits; unmatched or expired locked value has refund and permissionless recovery paths.",
  },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type WalletUiOverride = { kind: "connected"; account: string } | { kind: "disconnected" } | null;
type RefreshOptions = { force?: boolean };

function sameAccount(left: string | null, right: string) {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

function snapshotWithConnectedWallet(snapshot: WorkspaceSnapshot, account: string): WorkspaceSnapshot {
  const sameWallet = sameAccount(snapshot.account, account);
  return {
    ...snapshot,
    account,
    availability: snapshot.availability === "unconfigured" || snapshot.availability === "unavailable" ? snapshot.availability : "ready",
    positions: sameWallet ? snapshot.positions : [],
    creditGen: sameWallet ? snapshot.creditGen : "0",
  };
}

function snapshotWithDisconnectedWallet(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    account: null,
    availability: snapshot.availability === "wrong_network" ? "ready" : snapshot.availability,
    positions: [],
    creditGen: "0",
  };
}

function applyWalletUiOverride(snapshot: WorkspaceSnapshot, override: WalletUiOverride): WorkspaceSnapshot {
  if (override?.kind === "connected") return snapshotWithConnectedWallet(snapshot, override.account);
  if (override?.kind === "disconnected") return snapshotWithDisconnectedWallet(snapshot);
  return snapshot;
}

export function App({ adapter: suppliedAdapter }: AppProps) {
  const [destination, setDestination] = useState<Destination>("overview");
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TransactionProgress | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletOptions, setWalletOptions] = useState<WalletChoice[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const transactionRef = useRef<TransactionProgress | null>(null);
  const walletUiOverrideRef = useRef<WalletUiOverride>(null);
  const refreshInFlightRef = useRef<Promise<WorkspaceSnapshot | null> | null>(null);
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

  const refresh = useCallback((options?: RefreshOptions) => {
    if (!options?.force && refreshInFlightRef.current) return refreshInFlightRef.current;
    setLoadError(null);
    const request = adapter.loadWorkspace()
      .then((next) => {
        const visibleSnapshot = applyWalletUiOverride(next, walletUiOverrideRef.current);
        setSnapshot(visibleSnapshot);
        setSelectedRoundId((current) => current && visibleSnapshot.rounds.some((round) => round.id === current) ? current : defaultRoundId(visibleSnapshot.rounds));
        return visibleSnapshot;
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Workspace could not be loaded.");
        return null;
      })
      .finally(() => {
        if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
        setLoading(false);
      });
    refreshInFlightRef.current = request;
    return request;
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

  async function openWalletModal() {
    setWalletModalOpen(true);
    setWalletLoading(true);
    setActionError(null);
    setRecoveryMessage(null);
    try {
      setWalletOptions(await discoverWallets());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Wallet discovery failed.");
      setWalletOptions([]);
    } finally {
      setWalletLoading(false);
    }
  }

  async function connect(selected: WalletChoice) {
    setBusy(true);
    setActionError(null);
    setRecoveryMessage(null);
    try {
      const account = await adapter.connectWallet(selected);
      walletUiOverrideRef.current = { kind: "connected", account };
      setSnapshot((current) => snapshotWithConnectedWallet(current, account));
      setWalletModalOpen(false);
      setWalletOptions([]);
      void refresh({ force: true });
    } catch (error) {
      if (isTransactionCancelled(error)) return;
      setActionError(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function switchToStudionet() {
    setBusy(true);
    setActionError(null);
    setRecoveryMessage(null);
    setAccountMenuOpen(false);
    try {
      const account = await adapter.connectWallet(undefined);
      walletUiOverrideRef.current = { kind: "connected", account };
      setSnapshot((current) => snapshotWithConnectedWallet(current, account));
      void refresh({ force: true });
    } catch (error) {
      if (isTransactionCancelled(error)) return;
      setActionError(error instanceof Error ? error.message : "Wallet network switch failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    adapter.disconnectWallet?.();
    walletUiOverrideRef.current = { kind: "disconnected" };
    setAccountMenuOpen(false);
    setSnapshot((current) => snapshotWithDisconnectedWallet(current));
    void refresh();
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
      const next = await refresh({ force: true });
      if (next) {
        updateTransaction(null);
        if (afterFinalized) afterFinalized(next);
      }
    } catch (error) {
      if (isTransactionCancelled(error)) {
        updateTransaction(null);
        return;
      }
      const next = await refresh({ force: true });
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

  function openRounds() {
    setDestination("rounds");
  }

  function showCreated(roundId: string) {
    setSelectedRoundId(roundId);
    setDestination("rounds");
  }

  const unconfigured = snapshot.availability === "unconfigured";
  const canUseWalletControl = !unconfigured && !busy;

  return (
    <div className="app-shell">
      <div className="bg" aria-hidden="true">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source src={BACKGROUND_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="bg-scrim" />
      </div>
      <a className="skip-link" href="#workspace">Skip to workspace</a>

      <header className="topbar">
        <a className="brand" href="/" aria-label="SkillSlot Clearing home">
          <span className="brand-mark brand-mark-transparent"><img src="/skillslot-logo.svg" alt="SkillSlot Clearing logo" /></span>
          <span><strong>SkillSlot</strong><small>Semantic access clearing</small></span>
        </a>
        <div className="connection-cluster">
          <div className="network-state" aria-label="Network and contract status">
            <span className="status-dot" aria-hidden="true" />
            <span>{snapshot.networkName ?? "Network unavailable"}</span>
          </div>
          <div className="account-control">
            <button
              className="button button-secondary"
              type="button"
              disabled={!canUseWalletControl}
              aria-expanded={snapshot.account ? accountMenuOpen : undefined}
              onClick={() => {
                if (snapshot.account && snapshot.availability === "wrong_network") {
                  void switchToStudionet();
                  return;
                }
                if (snapshot.account) {
                  setAccountMenuOpen((open) => !open);
                } else {
                  void openWalletModal();
                }
              }}
            >
              <Wallet aria-hidden="true" />
              {snapshot.availability === "wrong_network" ? "Switch to Studionet" : snapshot.account ? shortAddress(snapshot.account) : busy ? "Waiting for wallet" : "Connect wallet"}
            </button>
            {snapshot.account && accountMenuOpen ? <AccountMenu account={snapshot.account} onDisconnect={() => void disconnect()} /> : null}
          </div>
        </div>
      </header>
      {walletModalOpen ? (
        <WalletModal
          wallets={walletOptions}
          loading={walletLoading}
          busy={busy}
          onClose={() => setWalletModalOpen(false)}
          onChoose={(wallet) => void connect(wallet)}
        />
      ) : null}

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
        {destination === "overview" ? (
          <Overview
            snapshot={snapshot}
            onOpenRounds={openRounds}
            onCreateRound={openCreate}
          />
        ) : null}
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

function Overview({
  snapshot,
  onOpenRounds,
  onCreateRound,
}: {
  snapshot: WorkspaceSnapshot;
  onOpenRounds: () => void;
  onCreateRound: () => void;
}) {
  return (
    <section className="overview-view" aria-labelledby="overview-title">
      <div className="landing-stage">
        <div className="trust-row anim" style={{ "--d": "0.05s" } as CSSProperties}>
          <span className="trust-avatar trust-avatar-1"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
          <span className="trust-avatar trust-avatar-2"><i className="fa-solid fa-route" aria-hidden="true" /></span>
          <span className="trust-avatar trust-avatar-3"><i className="fa-solid fa-scale-balanced" aria-hidden="true" /></span>
          <span className="trust-pill">GenLayer validators</span>
        </div>

        <div className="hero-panel">
          <h1 id="overview-title" className="headline">
            <span>SkillSlot</span>
            <span>Clearing</span>
          </h1>
          <p className="hero-line anim" style={{ "--d": "0.24s" } as CSSProperties}>Validator-cleared access marketplace</p>
          <p className="lede">
            A GenLayer marketplace for clearing scarce agent access. Providers bond authenticated agent offers, requesters escrow exact needs, and GenLayer validators clear semantic compatibility before deterministic settlement moves grants, refunds, and credits.
          </p>
          <div className="hero-actions anim" style={{ "--d": "0.4s" } as CSSProperties}>
            <button className="button button-primary" type="button" onClick={onOpenRounds}>
              <ArrowsLeftRight aria-hidden="true" /> Browse rounds
            </button>
            <button className="button button-secondary" type="button" onClick={onCreateRound}>
              <Plus aria-hidden="true" /> Create a round
            </button>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="explainer-card immersive-card" aria-label="Why GenLayer" aria-labelledby="why-genlayer-title">
          <p className="eyebrow">Why GenLayer</p>
          <h2 id="why-genlayer-title">Semantic matching with bounded evidence</h2>
          <p>
            GenLayer validators inspect authenticated metadata, needs, capability IDs, and exclusions before deterministic settlement.
          </p>
          <ul className="evidence-list">
            <li><CheckCircle aria-hidden="true" /> Provider fees require metadata authentication before clearing.</li>
            <li><CheckCircle aria-hidden="true" /> Requester deposits are refunded when no compatible slot clears.</li>
            <li><CheckCircle aria-hidden="true" /> Expired locked funds can be recovered permissionlessly.</li>
          </ul>
        </section>

        <section className="mechanism-card immersive-card" aria-label="How SkillSlot clears access" aria-labelledby="mechanism-title">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Clearing mechanism</p>
              <h2 id="mechanism-title">How SkillSlot clears access</h2>
            </div>
          </div>
          <ol className="mechanism-list" aria-label="SkillSlot clearing mechanism">
            {mechanismSteps.map((step, index) => (
              <li key={step.title} className="mechanism-step">
                <span className="mechanism-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}

function WalletModal({
  wallets,
  loading,
  busy,
  onClose,
  onChoose,
}: {
  wallets: WalletChoice[];
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onChoose: (wallet: WalletChoice) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Wallet required for writes</p>
            <h2 id="wallet-modal-title">Choose wallet</h2>
          </div>
          <button className="text-action" type="button" onClick={onClose}>Close</button>
        </div>
        <p className="wallet-modal-copy">Select the EVM wallet that should sign Studionet transactions. The app will not choose a provider automatically.</p>
        {loading ? <p className="form-status">Detecting browser wallets...</p> : null}
        {!loading && wallets.length === 0 ? (
          <div className="empty-state compact-empty">
            <ShieldWarning aria-hidden="true" />
            <h2>No wallet detected</h2>
            <p>No EVM wallet extension was detected. Install or unlock a Studionet-compatible wallet, then try again.</p>
          </div>
        ) : null}
        {wallets.length ? (
          <div className="wallet-list" aria-label="Detected wallets">
            {wallets.map((wallet) => (
              <button key={wallet.id} className="wallet-option" type="button" aria-label={wallet.name} disabled={busy} onClick={() => onChoose(wallet)}>
                {wallet.icon ? <img src={wallet.icon} alt="" /> : <span aria-hidden="true">{wallet.name.slice(0, 1).toUpperCase()}</span>}
                <strong>{wallet.name}</strong>
                <small>{wallet.id}</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AccountMenu({ account, onDisconnect }: { account: string; onDisconnect: () => void }) {
  const explorerUrl = `https://explorer-studio.genlayer.com/address/${account}`;
  return (
    <div className="account-menu" role="menu" aria-label="Wallet account">
      <p>{account}</p>
      <button role="menuitem" type="button" onClick={() => void navigator.clipboard?.writeText(account)}>Copy address</button>
      <a role="menuitem" href={explorerUrl} target="_blank" rel="noreferrer">View account</a>
      <button role="menuitem" type="button" onClick={onDisconnect}>Disconnect</button>
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
  return <section className="loading-state" role="status" aria-label="Loading canonical marketplace"><span>Loading canonical marketplace…</span><div /><div /><div /></section>;
}

function ConfigurationNotice({ availability }: { availability: WorkspaceSnapshot["availability"] }) {
  return <section className="notice" aria-labelledby="configuration-title"><ShieldWarning aria-hidden="true" /><div><h2 id="configuration-title" className="notice-title">{availability === "wrong_network" ? "Wallet is on the wrong network" : "Contract not configured"}</h2><p>No address, wallet state, balance, transaction, or finality is being simulated.</p></div></section>;
}
