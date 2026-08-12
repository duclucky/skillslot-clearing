import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetWalletForTests,
  connectStudionetWallet,
  discoverWallets,
  restoreStudionetWallet,
  STUDIONET_CHAIN_ID,
  type WalletProvider,
} from "./wallet";

function provider(handler: (method: string) => unknown): WalletProvider {
  return { request: vi.fn(({ method }) => Promise.resolve(handler(method))) };
}

describe("browser wallet integration", () => {
  beforeEach(() => {
    __resetWalletForTests();
    window.localStorage.clear();
    delete window.ethereum;
  });

  it("discovers an EIP-6963 provider without adding a duplicate legacy proxy", async () => {
    const announced = provider(() => []);
    window.ethereum = announced;
    window.addEventListener(
      "eip6963:requestProvider",
      () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: { uuid: "wallet-1", name: "Test Wallet", icon: "", rdns: "org.test.wallet" },
              provider: announced,
            },
          }),
      ),
      { once: true },
    );

    const wallets = await discoverWallets();

    expect(wallets).toHaveLength(1);
    expect(wallets[0].name).toBe("Test Wallet");
  });

  it("restores with eth_accounts and never requests wallet permission", async () => {
    const restored = provider((method) => {
      if (method === "eth_accounts") return ["0x0000000000000000000000000000000000000001"];
      if (method === "eth_chainId") return STUDIONET_CHAIN_ID;
      return null;
    });
    window.ethereum = restored;
    window.localStorage.setItem("skillslot.walletId", "browser-wallet");
    window.localStorage.setItem("skillslot.account", "0x0000000000000000000000000000000000000001");

    const session = await restoreStudionetWallet();

    expect(session?.account).toBe("0x0000000000000000000000000000000000000001");
    expect(restored.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "eth_requestAccounts" }));
    expect(restored.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "wallet_switchEthereumChain" }));
  });

  it("adds an unknown Studionet chain and switches before returning the connected account", async () => {
    const calls: string[] = [];
    const injected: WalletProvider = {
      request: vi.fn(async ({ method }) => {
        calls.push(method);
        if (method === "eth_requestAccounts") return ["0x0000000000000000000000000000000000000002"];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain" && calls.filter((item) => item === method).length === 1) {
          throw Object.assign(new Error("unknown chain"), { code: 4902 });
        }
        return null;
      }),
    };

    const session = await connectStudionetWallet({ id: "test", name: "Test", provider: injected });

    expect(session.account).toBe("0x0000000000000000000000000000000000000002");
    expect(calls).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
  });
});
