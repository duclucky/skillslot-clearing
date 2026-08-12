import {
  ArrowRight,
  ArrowsLeftRight,
  CheckCircle,
  Coins,
  LockKey,
  Plugs,
  ShieldWarning,
  Wallet,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { createUnconfiguredAdapter } from "./contractAdapter";
import type { ContractAdapter, WorkspaceSnapshot } from "./domain";
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
};

export function App({ adapter = createUnconfiguredAdapter() }: AppProps) {
  const [destination, setDestination] = useState<Destination>("floor");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    adapter
      .loadWorkspace()
      .then((next) => {
        if (current) setSnapshot(next);
      })
      .catch((error: unknown) => {
        if (current) {
          setLoadError(error instanceof Error ? error.message : "Workspace could not be loaded.");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [adapter]);

  const unconfigured = snapshot.availability === "unconfigured";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      <header className="topbar">
        <a className="brand" href="/" aria-label="SkillSlot Clearing home">
          <span className="brand-mark" aria-hidden="true">
            <ArrowsLeftRight weight="bold" />
          </span>
          <span>
            <strong>SkillSlot</strong>
            <small>Semantic access clearing</small>
          </span>
        </a>

        <div className="connection-cluster">
          <div className="network-state" aria-label="Network and contract status">
            <span className="status-dot" aria-hidden="true" />
            <span>{snapshot.networkName ?? "Network unavailable"}</span>
          </div>
          <button className="button button-secondary" type="button" disabled={unconfigured || loading}>
            <Wallet aria-hidden="true" />
            Connect wallet
          </button>
        </div>
      </header>

      <nav className="primary-nav" aria-label="Workspace destinations">
        <button
          className={destination === "floor" ? "nav-item nav-item-active" : "nav-item"}
          type="button"
          aria-pressed={destination === "floor"}
          onClick={() => setDestination("floor")}
        >
          <ArrowsLeftRight aria-hidden="true" />
          Clearing floor
        </button>
        <button
          className={destination === "positions" ? "nav-item nav-item-active" : "nav-item"}
          type="button"
          aria-pressed={destination === "positions"}
          onClick={() => setDestination("positions")}
        >
          <LockKey aria-hidden="true" />
          My access &amp; credits
        </button>
      </nav>

      <main id="workspace" className="workspace" tabIndex={-1}>
        {loadError ? (
          <section className="notice notice-danger" role="alert">
            <ShieldWarning aria-hidden="true" />
            <div>
              <p className="notice-title">Workspace unavailable</p>
              <p>{loadError} Check the public network configuration, then reload this page.</p>
            </div>
          </section>
        ) : destination === "floor" ? (
          <ClearingFloor snapshot={snapshot} loading={loading} />
        ) : (
          <Positions snapshot={snapshot} loading={loading} />
        )}
      </main>
    </div>
  );
}

function ClearingFloor({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  const unavailable = snapshot.availability !== "ready";

  return (
    <div className="workspace-grid">
      <section className="canonical-column" aria-labelledby="round-title">
        <p className="eyebrow">Canonical round state</p>
        <div className="title-row">
          <div>
            <h1 id="round-title">{snapshot.round ? `Round ${snapshot.round.id}` : "No clearing round loaded"}</h1>
            <p className="lede">
              Bounded offers and needs are judged by meaning. Matching, access rights, and GEN accounting stay
              deterministic onchain.
            </p>
          </div>
          <span className="phase-badge">
            <span className="status-dot" aria-hidden="true" />
            {loading ? "Loading" : snapshot.round?.phase ?? "Unavailable"}
          </span>
        </div>

        {unavailable && !loading ? <ConfigurationNotice /> : null}

        <div className="metric-strip" aria-label="Round limits and economics">
          <Metric label="Offer slots" value={snapshot.round ? `${snapshot.round.offerCount}/4` : "—/4"} />
          <Metric label="Request slots" value={snapshot.round ? `${snapshot.round.requestCount}/4` : "—/4"} />
          <Metric label="Provider bond" value={snapshot.round ? `${snapshot.round.providerBondGen} GEN` : "1 GEN"} />
          <Metric label="Booking fee" value={snapshot.round ? `${snapshot.round.feeGen} GEN` : "1 GEN"} />
        </div>

        <section className="process-panel" aria-labelledby="process-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">What the contract owns</p>
              <h2 id="process-title">One bounded clearing lifecycle</h2>
            </div>
          </div>
          <ol className="process-list">
            <ProcessStep number="01" title="Commit a position" text="Providers bond a promise; requesters escrow a booking fee." />
            <ProcessStep number="02" title="Lock and judge" text="Validators decide semantic compatibility across the complete bounded set." />
            <ProcessStep number="03" title="Settle deterministically" text="The contract assigns one route grant per match and credits refunds or fees." />
          </ol>
        </section>
      </section>

      <aside className="action-rail" aria-labelledby="action-title">
        <div className="rail-heading">
          <p className="eyebrow">Next available action</p>
          <span className="availability-label">Unavailable</span>
        </div>
        <h2 id="action-title">Connect canonical state first</h2>
        <p>
          A public Studionet contract and wallet client are required before this interface can accept an offer or
          request.
        </p>
        <button className="button button-primary button-full" type="button" disabled>
          <Plugs aria-hidden="true" />
          Awaiting contract configuration
        </button>

        <div className="boundary-note">
          <CheckCircle aria-hidden="true" />
          <p>
            A match reserves access. It does not certify agent performance, fulfillment, identity, or service quality.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Positions({ snapshot, loading }: { snapshot: WorkspaceSnapshot; loading: boolean }) {
  return (
    <section className="positions-view" aria-labelledby="positions-title">
      <p className="eyebrow">Wallet-scoped canonical state</p>
      <h1 id="positions-title">My access &amp; credits</h1>
      <p className="lede">Route grants, submitted positions, and withdrawable GEN appear here after wallet connection.</p>

      <div className="positions-summary">
        <div>
          <span>Withdrawable credit</span>
          <strong>{snapshot.account ? `${snapshot.creditGen} GEN` : "— GEN"}</strong>
        </div>
        <button className="button button-primary" type="button" disabled={!snapshot.account || loading}>
          <Coins aria-hidden="true" />
          Withdraw credit
        </button>
      </div>

      <div className="empty-state">
        <LockKey aria-hidden="true" />
        <h2>No wallet state available</h2>
        <p>Connect a configured Studionet wallet to read positions and route grants from the contract.</p>
        <button className="text-action" type="button" disabled>
          Contract configuration required <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function ConfigurationNotice() {
  return (
    <section className="notice" aria-labelledby="configuration-title">
      <ShieldWarning aria-hidden="true" />
      <div>
        <h2 id="configuration-title" className="notice-title">
          Contract not configured
        </h2>
        <p>
          No address, wallet state, balance, transaction, or finality is being simulated. Deployment will supply the
          public contract configuration.
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li>
      <span className="step-number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </li>
  );
}
