import { test as base, expect, Page } from "@playwright/test";

// Anvil access + canonical fixtures live in the suite-shared module.
export {
  RPC,
  CANONICAL_USER,
  CANONICAL_ATP,
  CANONICAL_STAKER,
  AZT,
  GOV,
  anvilRpc,
  snapshot,
  revert,
} from "../../shared/anvil";
import { RPC } from "../../shared/anvil";

export const ANVIL_CHAIN_ID = 31337;
export const ANVIL_CHAIN_HEX = "0x7a69";

// EIP-1193 + EIP-6963 provider injected via addInitScript so window.ethereum
// is available before wagmi enumerates providers. Anvil's auto-impersonate
// accepts unsigned eth_sendTransaction from the listed account.
export async function injectMockWallet(
  page: Page,
  account: string
): Promise<void> {
  await page.addInitScript(
    ({ account, rpc, chainHex }) => {
      const accLower = account.toLowerCase();
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

      async function forward(method: string, params: unknown[] = []) {
        const r = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
      }

      function emit(event: string, ...args: unknown[]) {
        for (const fn of listeners[event] || []) {
          try { fn(...args); } catch { /* swallow listener errors */ }
        }
      }

      const provider = {
        isMetaMask: true,
        chainId: chainHex,
        selectedAddress: accLower,
        _isConnected: true,
        async request({ method, params = [] }: { method: string; params?: unknown[] }) {
          switch (method) {
            case "eth_chainId":
              return chainHex;
            case "eth_accounts":
              return [accLower];
            case "eth_requestAccounts":
              // Fire events on next tick so wagmi's late-attached listeners see them.
              setTimeout(() => {
                emit("accountsChanged", [accLower]);
                emit("connect", { chainId: chainHex });
              }, 0);
              return [accLower];
            case "wallet_switchEthereumChain":
              return null;
            case "wallet_addEthereumChain":
              return null;
            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];
            case "wallet_requestPermissions":
              return [{ parentCapability: "eth_accounts" }];
            case "net_version":
              return String(parseInt(chainHex, 16));
            case "eth_sendTransaction": {
              const tx = (params as Array<{ from?: string }>)[0] ?? {};
              if (!tx.from) (tx as { from: string }).from = accLower;
              return forward("eth_sendTransaction", [tx]);
            }
            case "personal_sign":
            case "eth_signTypedData_v4":
              // SIWE isn't enabled; dummy sig is enough.
              return "0x" + "00".repeat(65);
            default:
              return forward(method, params);
          }
        },
        on(event: string, fn: (...args: unknown[]) => void) {
          (listeners[event] ||= []).push(fn);
        },
        removeListener(event: string, fn: (...args: unknown[]) => void) {
          listeners[event] = (listeners[event] || []).filter((x) => x !== fn);
        },
      };

      Object.defineProperty(window, "ethereum", {
        value: provider,
        configurable: true,
        writable: true,
      });

      // EIP-6963 announce so RainbowKit's enumerator discovers the provider.
      const info = {
        uuid: "11111111-1111-1111-1111-111111111111",
        name: "MetaMask",
        icon: "data:image/svg+xml,",
        rdns: "io.metamask",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: Object.freeze({ info, provider }),
          })
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { account, rpc: RPC, chainHex: ANVIL_CHAIN_HEX }
  );
}

// Connects via the NEXT_PUBLIC_E2E=1 wagmi backdoor. RainbowKit's MetaMask
// SDK ignores window.ethereum in headless mode, so we call wagmi `connect`
// against the plain injected() connector directly.
export async function connectWallet(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __wagmiConfig?: { connectors: Array<{ id: string }> };
      };
      return (
        !!w.__wagmiConfig &&
        w.__wagmiConfig.connectors.some((c) => c.id === "injected")
      );
    },
    { timeout: 10_000 }
  );

  await page.evaluate(async () => {
    const w = window as unknown as {
      __wagmiConfig: { connectors: Array<{ id: string }> };
      __wagmiConnect: (
        cfg: unknown,
        opts: { connector: unknown }
      ) => Promise<unknown>;
    };
    const injected = w.__wagmiConfig.connectors.find(
      (c) => c.id === "injected"
    );
    if (!injected) throw new Error("injected connector missing");
    await w.__wagmiConnect(w.__wagmiConfig, { connector: injected });
  });

  // Settled when the navbar shows the truncated address.
  await page.waitForFunction(
    () => /0x[a-f0-9]{4}\.{3}[a-f0-9]{4}/i.test(document.body.innerText),
    { timeout: 10_000 }
  );
}

// Gates downstream assertions on useVotingPower having resolved. The "Your
// Voting Power" label renders eagerly but the AZT value only after isLoading
// flips false. Without this, modal-open clicks race the data load.
export async function waitForDashboardReady(page: Page): Promise<void> {
  const yvpRow = page
    .locator("div", { hasText: /^your voting power/i })
    .first();
  await yvpRow.waitFor({ state: "visible", timeout: 30_000 });
  await expect(
    yvpRow.locator("text=/\\d[\\d,]*(\\.\\d+)?\\s*[KMB]?\\s*AZT/i").first()
  ).toBeVisible({ timeout: 30_000 });
}

export async function openDepositModal(page: Page): Promise<void> {
  await waitForDashboardReady(page);
  const depositBtn = page.getByRole("button", { name: /^deposit$/i }).first();
  await depositBtn.waitFor({ state: "visible", timeout: 30_000 });
  await depositBtn.click();
  await page
    .getByRole("dialog", { name: /deposit azt/i })
    .waitFor({ state: "visible", timeout: 10_000 });
}

export async function openWithdrawModal(page: Page): Promise<void> {
  await waitForDashboardReady(page);
  const withdrawBtn = page.getByRole("button", { name: /^withdraw$/i }).first();
  await withdrawBtn.waitFor({ state: "visible", timeout: 30_000 });
  await withdrawBtn.click();
  await page
    .getByRole("dialog", { name: /withdraw from position/i })
    .waitFor({ state: "visible", timeout: 10_000 });
}

export const test = base;
