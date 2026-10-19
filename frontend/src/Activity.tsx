import { Coins, LockKey } from "@phosphor-icons/react";

import { ONE_GEN_WEI } from "./contractAdapter";
import type { ContractAdapter, WorkspaceSnapshot } from "./domain";
import type { RunWrite } from "./Marketplace";
import { A2AHandoff } from "./A2AHandoff";
import { ExecutorConsole } from "./ExecutorConsole";
import { DeliverySettlement } from "./DeliverySettlement";
import { ReputationSettlement } from "./ReputationSettlement";

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
      <div className="positions-summary immersive-card operational-card">
        <div><span>Withdrawable credit</span><strong>{snapshot.account ? `${snapshot.creditGen} GEN` : "- GEN"}</strong></div>
        <button className="button button-primary" type="button" disabled={!snapshot.account || busy || snapshot.creditGen === "0"} onClick={() => void runWrite(() => adapter.withdrawCredit(genToWei(snapshot.creditGen)))}><Coins aria-hidden="true" />Withdraw {snapshot.creditGen} GEN</button>
      </div>
      {snapshot.account ? <ExecutorConsole account={snapshot.account} adapter={adapter} /> : null}
      {snapshot.positions.length ? (
        <div className="position-list">
          {snapshot.positions.map((position) => (
            <article className="position-card immersive-card operational-card" key={`${position.kind}:${position.id}`}>
              <button className="position-link" type="button" onClick={() => onOpenRound(position.roundId)}>
                <span>{position.kind}</span><h2>{position.summary}</h2><p>{position.id} {position.status}</p>
              </button>
              {position.kind === "request" && position.minimumReviewCount !== undefined ? (
                <p className="section-note">Booking policy: {position.minimumReviewCount === "0" ? "No reputation minimum." : `At least ${position.minimumReviewCount} finalized reviews, average ${(Number(position.minimumAverageMilli || "0") / 1000).toFixed(3)}/5 at round lock.`}</p>
              ) : null}
              {position.kind === "request" && position.bookingEligibility?.length ? (
                <div className="section-note" aria-label="Canonical reputation eligibility">
                  <p>Reputation gate only — semantic fit and capacity are checked separately.</p>
                  <ul>{position.bookingEligibility.map(pair => <li key={pair.offerId}>{pair.offerId}: {pair.reason === "ELIGIBLE" ? "Meets reputation policy" : pair.reason === "INSUFFICIENT_REVIEWS" ? "Below minimum review count" : pair.reason === "AVERAGE_TOO_LOW" ? "Below minimum average score" : "Awaiting round lock"}{pair.snapshotTaken ? ` (${pair.reviewCount} finalized reviews at lock).` : "."}</li>)}</ul>
                </div>
              ) : null}
              {position.kind === "grant" && position.status === "ACTIVE" && position.requestId ? (
                <div className="position-actions">
                  {snapshot.account && snapshot.contractAddress ? (
                    <A2AHandoff
                      position={position}
                      account={snapshot.account}
                      contractAddress={snapshot.contractAddress}
                      adapter={adapter}
                      busy={busy}
                      runWrite={runWrite}
                    />
                  ) : null}
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => void runWrite(() => adapter.consumeGrant({ roundId: position.roundId, requestId: position.requestId! }))}>Consume grant</button>
                </div>
              ) : null}
              {(position.kind === "delivery" || position.kind === "grant") && position.requestId && position.deliveryStatus ? (
                <>
                  <DeliverySettlement position={position} adapter={adapter} busy={busy} runWrite={runWrite} />
                  <ReputationSettlement position={position} adapter={adapter} busy={busy} runWrite={runWrite} />
                </>
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
