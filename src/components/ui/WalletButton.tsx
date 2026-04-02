"use client";

import { useWallet } from "@/hooks/useWallet";

function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { isConnected, address, connect, openAccount } = useWallet();

  if (isConnected && address) {
    return (
      <button
        onClick={openAccount}
        className="inline-flex items-center justify-center h-[44px] px-4 py-2.5 text-xs font-bold tracking-wider uppercase border-2 transition-colors hover:opacity-80"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      className="inline-flex items-center justify-center h-[44px] px-4 py-2.5 text-xs font-bold tracking-wider uppercase border-2 transition-opacity hover:opacity-90 active:opacity-75"
      style={{
        backgroundColor: "var(--button-primary-bg)",
        color: "var(--button-primary-text)",
        borderColor: "var(--button-primary-bg)",
      }}
    >
      Connect Wallet
    </button>
  );
}
