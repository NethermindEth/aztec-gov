"use client";

import { useAccount, useDisconnect } from "wagmi";
import {
  useConnectModal,
  useAccountModal,
} from "@rainbow-me/rainbowkit";

export function useWallet() {
  const { isConnected, address, chain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { disconnect } = useDisconnect();

  return {
    isConnected,
    address,
    chain,
    connect: openConnectModal,
    openAccount: openAccountModal,
    disconnect,
  };
}
