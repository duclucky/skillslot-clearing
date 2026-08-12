import type { ContractAdapter, WorkspaceSnapshot } from "./domain";

const unconfiguredWorkspace: WorkspaceSnapshot = {
  availability: "unconfigured",
  account: null,
  networkName: null,
  contractAddress: null,
  round: null,
  positions: [],
  creditGen: "0",
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
