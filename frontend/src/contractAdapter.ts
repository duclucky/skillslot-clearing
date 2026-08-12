import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import type {
  ContractAdapter,
  OfferInput,
  OpenRoundInput,
  PositionView,
  RequestInput,
  TransactionProgress,
  TransactionReceipt,
  WorkspaceSnapshot,
} from "./domain";
import {
  connectStudionetWallet,
  getActiveWalletSession,
  restoreStudionetWallet,
  type WalletSession,
} from "./wallet";

export const ONE_GEN_WEI = 10n ** 18n;

export interface GenLayerClientLike {
  readContract(args: {
    address: `0x${string}`;
    functionName: string;
    args?: unknown[];
    jsonSafeReturn?: boolean;
  }): Promise<unknown>;
  writeContract(args: {
    address: `0x${string}`;
    functionName: string;
    args?: unknown[];
    value: bigint;
  }): Promise<unknown>;
  request(args: { method: string; params: unknown[] }): Promise<unknown>;
}

interface RoundRecord {
  round_id: string;
  creator: string;
  title: string;
  phase: WorkspaceSnapshot["round"] extends infer _ ? string : never;
  booking_fee_wei: string;
  provider_bond_wei: string;
  offer_ids_csv: string;
  request_ids_csv: string;
  offer_count: string;
  request_count: string;
}

interface OfferRecord {
  offer_id: string;
  provider: string;
  label: string;
  matched_request_id: string;
  active: boolean;
}

interface RequestRecord {
  request_id: string;
  requester: string;
  label: string;
  matched_offer_id: string;
  outcome: string;
}

interface MatchRecord {
  offer_id?: string;
  request_id?: string;
  provider?: string;
  requester?: string;
  grant_status?: string;
}

type Clients = {
  readClient: GenLayerClientLike;
  writeClient: GenLayerClientLike | null;
  account: `0x${string}` | null;
  onStudionet?: boolean;
};

type AdapterOptions = {
  contractAddress: `0x${string}`;
  clients: () => Clients;
  connect?: () => Promise<WalletSession>;
  restore?: () => Promise<WalletSession | null>;
  onTransaction?: (progress: TransactionProgress) => void;
  pollIntervalMs?: number;
  maxPolls?: number;
};

const terminalFailures = new Set(["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);

function isTransientStatusError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return ["not found", "index", "failed to fetch", "network", "timeout", "temporarily", "502", "503", "504"].some((part) => message.includes(part));
}

function splitCsv(value: string | undefined) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function sameAddress(left: string | undefined, right: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function formatGen(wei: string | bigint): string {
  const value = BigInt(wei);
  const whole = value / ONE_GEN_WEI;
  const remainder = value % ONE_GEN_WEI;
  if (remainder === 0n) return whole.toString();
  return `${whole}.${remainder.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

async function read<T>(client: GenLayerClientLike, address: `0x${string}`, functionName: string, args: unknown[] = []) {
  return (await client.readContract({ address, functionName, args, jsonSafeReturn: true })) as T;
}

function pause(milliseconds: number) {
  if (milliseconds === 0) return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function createGenLayerAdapter(options: AdapterOptions): ContractAdapter {
  const { contractAddress, onTransaction = () => undefined, pollIntervalMs = 5_000, maxPolls = 240 } = options;

  async function currentClients() {
    let result = options.clients();
    if (!result.account && options.restore) {
      await options.restore();
      result = options.clients();
    }
    return result;
  }

  async function loadWorkspace(): Promise<WorkspaceSnapshot> {
    const { readClient, account, onStudionet = true } = await currentClients();
    const roundIds = await read<string[]>(readClient, contractAddress, "get_round_ids");
    const roundId = roundIds[roundIds.length - 1];
    const round = roundId ? await read<RoundRecord>(readClient, contractAddress, "get_round", [roundId]) : null;
    const [creditWei, accounting] = await Promise.all([
      account ? read<string>(readClient, contractAddress, "get_credit", [account]) : Promise.resolve("0"),
      read<{ invariant_holds?: boolean }>(readClient, contractAddress, "get_accounting"),
    ]);
    const positions: PositionView[] = [];

    if (round) {
      const offers = await Promise.all(
        splitCsv(round.offer_ids_csv).map((id) => read<OfferRecord>(readClient, contractAddress, "get_offer", [round.round_id, id])),
      );
      const requests = await Promise.all(
        splitCsv(round.request_ids_csv).map((id) => read<RequestRecord>(readClient, contractAddress, "get_request", [round.round_id, id])),
      );
      const matches = await Promise.all(
        requests.map((request) => read<MatchRecord>(readClient, contractAddress, "get_match", [round.round_id, request.request_id])),
      );

      offers.filter((offer) => sameAddress(offer.provider, account)).forEach((offer) => {
        positions.push({
          id: offer.offer_id,
          roundId: round.round_id,
          kind: "offer",
          status: offer.active ? "ACTIVE" : offer.matched_request_id ? "MATCHED" : "CLOSED",
          summary: offer.label,
        });
      });
      requests.filter((request) => sameAddress(request.requester, account)).forEach((request) => {
        positions.push({
          id: request.request_id,
          requestId: request.request_id,
          roundId: round.round_id,
          kind: "request",
          status: request.outcome,
          summary: request.label,
        });
      });
      for (const match of matches) {
        if (!match.request_id || !sameAddress(match.requester, account)) continue;
        const canRoute = await read<boolean>(readClient, contractAddress, "can_route", [round.round_id, match.request_id, account]);
        positions.push({
          id: `${round.round_id}:${match.request_id}`,
          requestId: match.request_id,
          roundId: round.round_id,
          kind: "grant",
          status: canRoute ? "ACTIVE" : match.grant_status || "INACTIVE",
          summary: `Route to ${match.offer_id || "matched provider"}`,
        });
      }
    }

    return {
      availability: account && !onStudionet ? "wrong_network" : "ready",
      account,
      networkName: "GenLayer Studionet",
      contractAddress,
      round: round
        ? {
            id: round.round_id,
            creator: round.creator,
            title: round.title,
            phase: round.phase as NonNullable<WorkspaceSnapshot["round"]>["phase"],
            offerCount: Number(round.offer_count),
            requestCount: Number(round.request_count),
            feeGen: formatGen(round.booking_fee_wei),
            providerBondGen: formatGen(round.provider_bond_wei),
          }
        : null,
      positions,
      creditGen: formatGen(creditWei),
      accountingInvariant: Boolean(accounting.invariant_holds),
    };
  }

  async function execute(functionName: string, args: unknown[], value = 0n): Promise<TransactionReceipt> {
    const { readClient, writeClient } = await currentClients();
    if (!writeClient) throw new Error("Connect a Studionet wallet before sending a transaction");
    let hash = "";
    try {
      hash = String(await writeClient.writeContract({ address: contractAddress, functionName, args, value }));
      onTransaction({ stage: "submitted", hash, functionName });
      let accepted = false;
      for (let poll = 0; poll < maxPolls; poll += 1) {
        let status = "";
        try {
          status = String(
            await readClient.request({ method: "gen_getTransactionStatus", params: [hash] }),
          ).toUpperCase();
        } catch (error) {
          if (!isTransientStatusError(error) || poll === maxPolls - 1) throw error;
          await pause(pollIntervalMs);
          continue;
        }
        if ((status === "ACCEPTED" || status === "FINALIZED") && !accepted) {
          accepted = true;
          onTransaction({ stage: "accepted", hash, functionName });
        }
        if (status === "FINALIZED") {
          onTransaction({ stage: "finalized", hash, functionName });
          return { hash };
        }
        if (terminalFailures.has(status)) throw new Error(`Transaction reached ${status}`);
        await pause(pollIntervalMs);
      }
      throw new Error("Transaction did not finalize before timeout");
    } catch (error) {
      onTransaction({
        stage: "failed",
        hash,
        functionName,
        error: error instanceof Error ? error.message : "Transaction failed",
      });
      throw error;
    }
  }

  return {
    loadWorkspace,
    connectWallet: async () => {
      if (!options.connect) throw new Error("No browser wallet connector is configured");
      return (await options.connect()).account;
    },
    openRound: (input: OpenRoundInput) => execute("open_round", [input.roundId, input.title, ONE_GEN_WEI, ONE_GEN_WEI]),
    submitOffer: (input: OfferInput) =>
      execute("submit_offer", [input.roundId, input.offerId, input.label, input.promise, input.capabilityIds], ONE_GEN_WEI),
    submitRequest: (input: RequestInput) =>
      execute(
        "submit_request",
        [input.roundId, input.requestId, input.label, input.need, input.requiredIds, input.excludedIds],
        ONE_GEN_WEI,
      ),
    lockRound: (roundId: string) => execute("lock_round", [roundId]),
    clearRound: (roundId: string) => execute("clear_round", [roundId]),
    cancelRound: (roundId: string) => execute("cancel_round", [roundId]),
    consumeGrant: ({ roundId, requestId }) => execute("consume_grant", [roundId, requestId]),
    withdrawCredit: (amountWei: string) => execute("withdraw_credit", [BigInt(amountWei)]),
  };
}

const unconfiguredWorkspace: WorkspaceSnapshot = {
  availability: "unconfigured",
  account: null,
  networkName: null,
  contractAddress: null,
  round: null,
  positions: [],
  creditGen: "0",
  accountingInvariant: null,
};

function unavailable(): Promise<never> {
  return Promise.reject(new Error("Contract not configured"));
}

export function createUnconfiguredAdapter(): ContractAdapter {
  return {
    loadWorkspace: async () => ({ ...unconfiguredWorkspace, positions: [] }),
    connectWallet: unavailable,
    openRound: unavailable,
    submitOffer: unavailable,
    submitRequest: unavailable,
    lockRound: unavailable,
    clearRound: unavailable,
    cancelRound: unavailable,
    consumeGrant: unavailable,
    withdrawCredit: unavailable,
  };
}

export function createConfiguredAdapter(
  contractAddress: `0x${string}`,
  onTransaction?: (progress: TransactionProgress) => void,
) {
  const readClient = createClient({ chain: studionet }) as unknown as GenLayerClientLike;
  return createGenLayerAdapter({
    contractAddress,
    restore: restoreStudionetWallet,
    connect: connectStudionetWallet,
    onTransaction,
    clients: () => {
      const session = getActiveWalletSession();
      return {
        readClient,
        writeClient: session
          ? (createClient({
              chain: studionet,
              account: session.account,
              provider: session.provider,
            }) as unknown as GenLayerClientLike)
          : null,
        account: session?.account ?? null,
        onStudionet: session?.onStudionet ?? true,
      };
    },
  });
}

export function configuredContractAddress() {
  const value = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(value || "") ? (value as `0x${string}`) : null;
}
