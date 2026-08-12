import { Coins, LockKey } from "@phosphor-icons/react";

import { ONE_GEN_WEI } from "./contractAdapter";
import type { ContractAdapter, WorkspaceSnapshot } from "./domain";
import type { RunWrite } from "./Marketplace";

interface ActivityProps {
  snapshot: WorkspaceSnapshot;
  adapter: ContractAdapter;
  busy: boolean;
  runWrite: RunWrite;
  onOpenRound: (roundId: string) => void;
}

function genToWei(value: string) {
  const [whole = "0", decimal = ""] = value.split(".");
  return (BigInt(whole) * ONE_GEN_WEI + BigInt(decimal.padEnd(18, "0").slice(0, 18) || "0")).toString();
}

export function Activity({ snapshot, adapter, busy, runWrite, onOpenRound }: ActivityProps) {
  return (
    <section className="positions-view" aria-labelledby="activity-title">
      <p className="eyebrow">Wallet-scoped canonical state</p>
      <h1 id="activity-title">My activity</h1>
      <p className="lede">Offers, requests, grants, and withdrawable GEN across every clearing round.</p>
      <div className="positions-summary">
        <div><span>Withdrawable credit</span><strong>{snapshot.account ? `${snapshot.creditGen} GEN` : "- GEN"}</strong></div>
        <button className="button button-primary" type="button" disabled={!snapshot.account || busy || snapshot.creditGen === "0"} onClick={() => void runWrite(() => adapter.withdrawCredit(genToWei(snapshot.creditGen)))}><Coins aria-hidden="true" />Withdraw {snapshot.creditGen} GEN</button>
      </div>
      {snapshot.positions.length ? (
        <div className="position-list">
          {snapshot.positions.map((position) => (
            <article className="position-card" key={`${position.kind}:${position.id}`}>
              <button className="position-link" type="button" onClick={() => onOpenRound(position.roundId)}>
                <span>{position.kind}</span><h2>{position.summary}</h2><p>{position.id} {position.status}</p>
              </button>
              {position.kind === "grant" && position.status === "ACTIVE" && position.requestId ? (
                <button className="button button-secondary" type="button" disabled={busy} onClick={() => void runWrite(() => adapter.consumeGrant({ roundId: position.roundId, requestId: position.requestId! }))}>Consume grant</button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><LockKey aria-hidden="true" /><h2>No wallet activity yet</h2><p>Join an open round or create one to begin.</p></div>
      )}
    </section>
  );
}
