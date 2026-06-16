"use client";

import { defineChain, http, type Chain } from "viem";
import { mainnet, sepolia, foundry as foundryBase } from "wagmi/chains";
import { cookieStorage, createConfig, createStorage } from "wagmi";
import { connect as wagmiConnect, disconnect as wagmiDisconnect } from "wagmi/actions";
import type { Config } from "wagmi";
import { injected } from "wagmi/connectors";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { chainId } from "./config";
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

const foundry: Chain = defineChain({
  ...foundryBase,
  contracts: {
    ...foundryBase.contracts,
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export function getChains(): readonly [Chain, ...Chain[]] {
  switch (chainId) {
    case 1:
      return [mainnet];
    case 31337:
      return [foundry];
    case 11155111:
    default:
      return [sepolia];
  }
}

const PUBLIC_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  31337: "http://127.0.0.1:8545",
};

function buildTransports(chains: readonly Chain[]) {
  return chains.reduce(
    (acc, chain) => {
      acc[chain.id] = http(PUBLIC_RPC[chain.id]);
      return acc;
    },
    {} as Record<number, ReturnType<typeof http>>
  );
}

/**
 * Minimal config safe for SSR — no connectors that touch browser APIs.
 * Used as fallback so wagmi hooks never throw during server rendering.
 */
export function createSsrSafeConfig(): Config {
  const chains = getChains();
  return createConfig({
    chains,
    connectors: [],
    transports: buildTransports(chains),
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}

/**
 * Full config with RainbowKit wallet connectors.
 * Safe to call during SSR — wallet connectors are only created in the browser
 * (they depend on indexedDB / localStorage which don't exist on the server).
 */
let _config: Config | undefined;
export function getConfig(): Config {
  if (!_config) {
    const chains = getChains();
    const isBrowser = typeof window !== "undefined";

    const wallets = [metaMaskWallet, rainbowWallet, coinbaseWallet];
    if (WALLETCONNECT_PROJECT_ID) {
      wallets.push(walletConnectWallet);
    } else if (isBrowser) {
      console.warn(
        "[Aztec Gov] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set — WalletConnect disabled"
      );
    }

    const baseConnectors = isBrowser
      ? connectorsForWallets(
          [{ groupName: "Popular", wallets }],
          { appName: "Aztec Governance", projectId: WALLETCONNECT_PROJECT_ID }
        )
      : [];

    // E2E backdoor: adds a plain injected() connector that uses window.ethereum
    // directly. RainbowKit's metaMaskWallet uses the MetaMask SDK which ignores
    // window.ethereum in headless mode. No effect without NEXT_PUBLIC_E2E=1.
    const connectors = [...baseConnectors];
    if (isBrowser && process.env.NEXT_PUBLIC_E2E === "1") {
      connectors.push(injected({ shimDisconnect: true }));
    }

    _config = createConfig({
      connectors,
      chains,
      transports: buildTransports(chains),
      ssr: true,
      storage: createStorage({ storage: cookieStorage }),
    });

    // Expose for E2E test harness only.
    if (isBrowser && process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as {
        __wagmiConfig?: Config;
        __wagmiConnect?: typeof wagmiConnect;
        __wagmiDisconnect?: typeof wagmiDisconnect;
      }).__wagmiConfig = _config;
      (window as unknown as {
        __wagmiConfig?: Config;
        __wagmiConnect?: typeof wagmiConnect;
        __wagmiDisconnect?: typeof wagmiDisconnect;
      }).__wagmiConnect = wagmiConnect;
      (window as unknown as {
        __wagmiConfig?: Config;
        __wagmiConnect?: typeof wagmiConnect;
        __wagmiDisconnect?: typeof wagmiDisconnect;
      }).__wagmiDisconnect = wagmiDisconnect;
    }
  }
  return _config;
}
