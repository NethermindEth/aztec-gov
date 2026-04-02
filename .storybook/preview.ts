import type { Preview } from "@storybook/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, createStorage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { custom, createClient } from "viem";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "../src/app/globals.css";

// Minimal mock transport that returns defaults for basic calls
// and fails for everything else (so React Query keeps initialData)
const noopTransport = custom({
  async request({ method }: { method: string }) {
    if (method === "eth_chainId") return "0xaa36a7";
    if (method === "eth_blockNumber") return "0x1";
    if (method === "eth_accounts") return [];
    if (method === "eth_getBalance") return "0x0";
    if (method === "eth_getCode") return "0x";
    if (method === "eth_getLogs") return [];
    if (method === "wallet_switchEthereumChain") return null;
    throw new Error(`[StorybookTransport] unhandled: ${method}`);
  },
});

const storybookWagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [],
  client({ chain }) {
    return createClient({
      chain,
      transport: noopTransport,
    });
  },
  storage: createStorage({ storage: localStorage }),
});

const rkTheme = darkTheme({
  accentColor: "#d4ff28",
  accentColorForeground: "#1a1400",
  borderRadius: "none",
});

const storybookQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#1a1400" }],
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
  },
  decorators: [
    (Story) =>
      React.createElement(
        WagmiProvider,
        { config: storybookWagmiConfig },
        React.createElement(
          QueryClientProvider,
          { client: storybookQueryClient },
          React.createElement(
            RainbowKitProvider,
            { theme: rkTheme },
            React.createElement(Story)
          )
        )
      ),
  ],
};

export default preview;
