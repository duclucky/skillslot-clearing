export const STUDIONET_CHAIN_ID = "0xf22f" as const;

const STUDIONET_CONFIGURATION = {
  chainId: STUDIONET_CHAIN_ID,
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

const storageKeys = {
  walletId: "skillslot.walletId",
  account: "skillslot.account",
};

export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  providers?: WalletProvider[];
}

export interface WalletOption {
  id: string;
  name: string;
  provider: WalletProvider;
  icon?: string;
}

export interface WalletSession {
  account: `0x${string}`;
  walletId: string;
  walletName: string;
  provider: WalletProvider;
  onStudionet: boolean;
}

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

interface Eip6963Detail {
  info?: { uuid?: string; name?: string; icon?: string; rdns?: string };
  provider?: WalletProvider;
}

const announced: Eip6963Detail[] = [];
let listening = false;
let activeSession: WalletSession | null = null;

function startDiscovery() {
  if (!listening) {
    window.addEventListener("eip6963:announceProvider", ((event: CustomEvent<Eip6963Detail>) => {
      const detail = event.detail;
      if (detail?.provider?.request && !announced.some((item) => item.provider === detail.provider)) {
        announced.push(detail);
      }
    }) as EventListener);
    listening = true;
  }
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function walletFromDetail(detail: Eip6963Detail, index: number): WalletOption | null {
  if (!detail.provider?.request) return null;
  return {
    id: detail.info?.rdns || detail.info?.uuid || `announced-wallet-${index}`,
    name: detail.info?.name || "Browser wallet",
    icon: detail.info?.icon,
    provider: detail.provider,
  };
}

export async function discoverWallets(): Promise<WalletOption[]> {
  if (typeof window === "undefined") return [];
  startDiscovery();
  await Promise.resolve();
  const result = announced.map(walletFromDetail).filter((item): item is WalletOption => Boolean(item));
  const providers = new Set(result.map((item) => item.provider));
  const legacy = window.ethereum;
  const legacyProviders = legacy?.providers?.length ? legacy.providers : legacy ? [legacy] : [];
  legacyProviders.forEach((provider, index) => {
    if (!providers.has(provider)) {
      result.push({
        id: legacyProviders.length === 1 ? "browser-wallet" : `browser-wallet-${index + 1}`,
        name: legacyProviders.length === 1 ? "Browser wallet" : `Browser wallet ${index + 1}`,
        provider,
      });
    }
  });
  return result;
}

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = Number((error as { code?: unknown }).code);
  if (Number.isFinite(code)) return code;
  const nested = (error as { data?: unknown; cause?: unknown }).data ?? (error as { cause?: unknown }).cause;
  return nested ? errorCode(nested) : undefined;
}

async function ensureStudionet(provider: WalletProvider) {
  const current = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (current === STUDIONET_CHAIN_ID) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_ID }] });
  } catch (error) {
    if (errorCode(error) !== 4902 && errorCode(error) !== -32603) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [STUDIONET_CONFIGURATION] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_ID }] });
  }
}

function accountList(value: unknown): `0x${string}`[] {
  return Array.isArray(value) ? value.map(String).filter((item): item is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(item)) : [];
}

function persist(session: WalletSession) {
  window.localStorage.setItem(storageKeys.walletId, session.walletId);
  window.localStorage.setItem(storageKeys.account, session.account);
  activeSession = session;
}

export async function connectStudionetWallet(selected?: WalletOption): Promise<WalletSession> {
  const wallet = selected ?? (activeSession ? { id: activeSession.walletId, name: activeSession.walletName, provider: activeSession.provider } : (await discoverWallets())[0]);
  if (!wallet) throw new Error("No browser wallet was detected");
  const account = accountList(await wallet.provider.request({ method: "eth_requestAccounts" }))[0];
  if (!account) throw new Error("Wallet did not return an account");
  await ensureStudionet(wallet.provider);
  const session = { account, walletId: wallet.id, walletName: wallet.name, provider: wallet.provider, onStudionet: true };
  persist(session);
  return session;
}

export async function restoreStudionetWallet(): Promise<WalletSession | null> {
  const walletId = window.localStorage.getItem(storageKeys.walletId);
  const storedAccount = window.localStorage.getItem(storageKeys.account);
  if (!walletId || !storedAccount) return null;
  const wallet = (await discoverWallets()).find((item) => item.id === walletId);
  if (!wallet) return null;
  const accounts = accountList(await wallet.provider.request({ method: "eth_accounts" }));
  const account = accounts.find((item) => item.toLowerCase() === storedAccount.toLowerCase()) ?? accounts[0];
  if (!account) return null;
  const chainId = String(await wallet.provider.request({ method: "eth_chainId" })).toLowerCase();
  const session = { account, walletId, walletName: wallet.name, provider: wallet.provider, onStudionet: chainId === STUDIONET_CHAIN_ID };
  persist(session);
  return session;
}

export function getActiveWalletSession() {
  return activeSession;
}

export function __resetWalletForTests() {
  announced.length = 0;
  activeSession = null;
}
