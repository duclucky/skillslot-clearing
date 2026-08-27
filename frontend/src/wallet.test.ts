import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetWalletForTests,
  connectStudionetWallet,
  discoverWallets,
  restoreStudionetWallet,
  STUDIONET_CHAIN_ID,
  withStudionetFeeCompatibility,
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

  it("switches a restored wallet to Studionet before returning an active session", async () => {
    const calls: string[] = [];
    const restored: WalletProvider = {
      request: vi.fn(async ({ method }) => {
        calls.push(method);
        if (method === "eth_accounts") return ["0x0000000000000000000000000000000000000001"];
        if (method === "eth_chainId") return "0x1";
        return null;
      }),
    };
    window.ethereum = restored;
    window.localStorage.setItem("skillslot.walletId", "browser-wallet");
    window.localStorage.setItem("skillslot.account", "0x0000000000000000000000000000000000000001");

    const session = await restoreStudionetWallet();

    expect(session?.onStudionet).toBe(true);
    expect(calls).toContain("wallet_switchEthereumChain");
    expect(restored.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "eth_requestAccounts" }));
  });

  it("keeps a restored wallet marked wrong-network when the user rejects Studionet switching", async () => {
    const restored: WalletProvider = {
      request: vi.fn(async ({ method }) => {
        if (method === "eth_accounts") return ["0x0000000000000000000000000000000000000001"];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("rejected"), { code: 4001 });
        return null;
      }),
    };
    window.ethereum = restored;
    window.localStorage.setItem("skillslot.walletId", "browser-wallet");
    window.localStorage.setItem("skillslot.account", "0x0000000000000000000000000000000000000001");

    const session = await restoreStudionetWallet();

    expect(session?.onStudionet).toBe(false);
  });

  it("retries Studionet switching from an active restored wrong-network session without requesting accounts again", async () => {
    const calls: string[] = [];
    const restored: WalletProvider = {
      request: vi.fn(async ({ method }) => {
        calls.push(method);
        if (method === "eth_accounts") return ["0x0000000000000000000000000000000000000001"];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain" && calls.filter((item) => item === method).length === 1) {
          throw Object.assign(new Error("rejected"), { code: 4001 });
        }
        return null;
      }),
    };
    window.ethereum = restored;
    window.localStorage.setItem("skillslot.walletId", "browser-wallet");
    window.localStorage.setItem("skillslot.account", "0x0000000000000000000000000000000000000001");

    await restoreStudionetWallet();
    const session = await connectStudionetWallet();

    expect(session.onStudionet).toBe(true);
    expect(calls.filter((item) => item === "wallet_switchEthereumChain")).toHaveLength(2);
    expect(restored.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "eth_requestAccounts" }));
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

  it("requires an explicit wallet option before requesting account permission", async () => {
    const injected = provider((method) => {
      if (method === "eth_requestAccounts") return ["0x0000000000000000000000000000000000000002"];
      if (method === "eth_chainId") return STUDIONET_CHAIN_ID;
      return null;
    });
    window.ethereum = injected;

    await expect(connectStudionetWallet()).rejects.toThrow("Choose a wallet before connecting");

    expect(injected.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "eth_requestAccounts" }));
  });

  it.each([undefined, "0x0", "0x00"])(
    "adds a one-gwei compatibility price when a Studionet wallet receives gasPrice %s",
    async (gasPrice) => {
      const request = vi.fn(async () => "0xhash");
      const compatible = withStudionetFeeCompatibility({ request });
      const transaction = {
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        gas: "0x30d40",
        nonce: "0x182",
        ...(gasPrice === undefined ? {} : { gasPrice }),
      };

      await compatible.request({ method: "eth_sendTransaction", params: [transaction] });

      expect(request).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: [{ ...transaction, gasPrice: "0x3b9aca00" }],
      });
      expect(transaction.gasPrice).toBe(gasPrice);
    },
  );

  it("preserves positive fees and forwards non-send methods unchanged", async () => {
    const request = vi.fn(async () => "ok");
    const compatible = withStudionetFeeCompatibility({ request });
    const transaction = { gasPrice: "0x2", gas: "0x30d40" };

    await compatible.request({ method: "eth_sendTransaction", params: [transaction] });
    await compatible.request({ method: "eth_accounts" });

    expect(request).toHaveBeenNthCalledWith(1, {
      method: "eth_sendTransaction",
      params: [transaction],
    });
    expect(request).toHaveBeenNthCalledWith(2, { method: "eth_accounts" });
  });

  it("logs sanitized transaction diagnostics when Studionet submission fails", async () => {
    const failure = Object.assign(new Error("unknown RPC error"), { code: -32603 });
    const request = vi.fn(async () => {
      throw failure;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const compatible = withStudionetFeeCompatibility({ request });
    const transaction = {
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      data: "0xabcdef",
      value: "0x0",
      gas: "0x30d40",
      nonce: "0x182",
      chainId: "0xf22f",
    };

    await expect(compatible.request({ method: "eth_sendTransaction", params: [transaction] })).rejects.toThrow(
      "unknown RPC error",
    );

    expect(warn).toHaveBeenCalledWith(
      "[SkillSlot] Studionet wallet submission failed",
      {
        error: { code: -32603, message: "unknown RPC error" },
        transaction: {
          chainId: "0xf22f",
          dataLength: 8,
          from: "0x0000000000000000000000000000000000000001",
          gas: "0x30d40",
          gasPrice: "0x3b9aca00",
          nonce: "0x182",
          to: "0x0000000000000000000000000000000000000002",
          value: "0x0",
        },
      },
    );
    expect(warn.mock.calls[0][1].transaction).not.toHaveProperty("data");
    warn.mockRestore();
  });
});
