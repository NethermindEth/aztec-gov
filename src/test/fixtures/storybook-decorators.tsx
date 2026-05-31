"use client";

import React, { useEffect, useState } from "react";
import type { Decorator } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, createStorage } from "wagmi";
import { connect as wagmiConnect } from "wagmi/actions";
import { sepolia } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { custom, createClient, encodeAbiParameters, decodeAbiParameters, type Hex } from "viem";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// ─── Mock values (matching Figma design) ────────────────────────────────────

const MOCK_ADDRESS = "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f67890" as const;

// Values from Figma: Wallet Balance 50,000 AZT, Staked 60,000 AZT, Delegated 15,000 AZT
const MOCK_WALLET_BALANCE = 50000n * 10n ** 18n;
const MOCK_GOVERNANCE_POWER = 60000n * 10n ** 18n;
const MOCK_GSE_POWER = 15000n * 10n ** 18n;

// Function selectors (first 4 bytes of keccak256 of function signature)
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const POWER_NOW_SELECTOR = "0xe1d74644"; // powerNow(address)
const GET_VOTING_POWER_SELECTOR = "0xbb4d4436"; // getVotingPower(address)
const AGGREGATE3_SELECTOR = "0x82ad56cb"; // aggregate3((address,bool,bytes)[])

function encodeUint256(value: bigint): Hex {
  return encodeAbiParameters([{ type: "uint256" }], [value]);
}

function resolveCall(callData: string): Hex {
  const selector = callData.slice(0, 10).toLowerCase();
  if (selector === BALANCE_OF_SELECTOR) return encodeUint256(MOCK_WALLET_BALANCE);
  if (selector === POWER_NOW_SELECTOR) return encodeUint256(MOCK_GOVERNANCE_POWER);
  if (selector === GET_VOTING_POWER_SELECTOR) return encodeUint256(MOCK_GSE_POWER);
  return encodeUint256(0n);
}

// Multicall3 aggregate3 ABI types for decoding/encoding
const aggregate3InputType = [{
  type: "tuple[]" as const,
  components: [
    { name: "target", type: "address" as const },
    { name: "allowFailure", type: "bool" as const },
    { name: "callData", type: "bytes" as const },
  ],
}];

const aggregate3OutputType = [{
  type: "tuple[]" as const,
  components: [
    { name: "success", type: "bool" as const },
    { name: "returnData", type: "bytes" as const },
  ],
}];

// ─── Mock transport ─────────────────────────────────────────────────────────

const mockTransport = custom({
  async request({ method, params }: { method: string; params?: unknown[] }) {
    if (method === "eth_chainId") return "0xaa36a7"; // sepolia
    if (method === "eth_blockNumber") return "0x1";
    if (method === "eth_getBalance") return "0x0";
    if (method === "eth_accounts") return [MOCK_ADDRESS];
    if (method === "eth_requestAccounts") return [MOCK_ADDRESS];

    if (method === "eth_call" && params) {
      const callParams = params[0] as { data?: string; to?: string };
      const data = callParams.data ?? "";
      const selector = data.slice(0, 10).toLowerCase();

      // Handle multicall3 aggregate3
      if (selector === AGGREGATE3_SELECTOR) {
        const callsData = `0x${data.slice(10)}` as Hex;
        const [calls] = decodeAbiParameters(aggregate3InputType, callsData);
        const results = (calls as { target: string; allowFailure: boolean; callData: Hex }[]).map(
          (call) => ({
            success: true,
            returnData: resolveCall(call.callData),
          })
        );
        return encodeAbiParameters(aggregate3OutputType, [results]);
      }

      // Handle individual calls
      return resolveCall(data);
    }

    if (method === "wallet_switchEthereumChain") return null;
    if (method === "wallet_addEthereumChain") return null;
    if (method === "eth_getCode") return "0x";
    if (method === "eth_getLogs") return [];

    // Throw for unhandled methods to prevent real data fetches
    // (ensures React Query falls back to initialData)
    throw new Error(`[MockTransport] unhandled method: ${method}`);
  },
});

// ─── Mock wagmi config ──────────────────────────────────────────────────────

function createMockConfig() {
  return createConfig({
    chains: [sepolia],
    connectors: [
      mock({
        accounts: [MOCK_ADDRESS],
      }),
    ],
    client({ chain }) {
      return createClient({
        chain,
        transport: mockTransport,
        batch: { multicall: false },
      });
    },
    storage: createStorage({ storage: localStorage }),
  });
}

const rkTheme = darkTheme({
  accentColor: "#d4ff28",
  accentColorForeground: "#1a1400",
  borderRadius: "none",
});

// ─── Auto-connect wrapper ───────────────────────────────────────────────────

function AutoConnect({
  config,
  children,
}: {
  config: ReturnType<typeof createMockConfig>;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(() => {
    // If no connectors, ready immediately
    return config.connectors.length === 0;
  });

  useEffect(() => {
    if (ready) return;
    const connector = config.connectors[0];
    if (!connector) return;
    wagmiConnect(config, { connector })
      .finally(() => setReady(true));
  }, [config, ready]);

  if (!ready) return null;
  return <>{children}</>;
}

// ─── Decorator ──────────────────────────────────────────────────────────────

const mockConfig = createMockConfig();
const connectedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
      retry: false,
    },
  },
});

function ConnectedWalletWrapper({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={mockConfig}>
      <QueryClientProvider client={connectedQueryClient}>
        <RainbowKitProvider theme={rkTheme}>
          <AutoConnect config={mockConfig}>
            {children}
          </AutoConnect>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export const connectedWalletDecorator: Decorator = (Story) => (
  <ConnectedWalletWrapper>
    <Story />
  </ConnectedWalletWrapper>
);
