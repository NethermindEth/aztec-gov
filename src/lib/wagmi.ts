"use client";

import type { Chain } from "viem";
import { mainnet, sepolia } from "wagmi/chains";
import { http } from "viem";
import { cookieStorage, createConfig, createStorage } from "wagmi";
import type { Config } from "wagmi";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export function getChains(): readonly [Chain, ...Chain[]] {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
  switch (chainId) {
    case 1:
      return [mainnet];
    case 11155111:
    default:
      return [sepolia];
  }
}

const PUBLIC_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
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

    const connectors = isBrowser
      ? connectorsForWallets(
          [{ groupName: "Popular", wallets }],
          { appName: "Aztec Governance", projectId: WALLETCONNECT_PROJECT_ID }
        )
      : [];

    _config = createConfig({
      connectors,
      chains,
      transports: buildTransports(chains),
      ssr: true,
      storage: createStorage({ storage: cookieStorage }),
    });
  }
  return _config;
}
