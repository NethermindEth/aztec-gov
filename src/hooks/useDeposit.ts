"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import {
  GovernanceAbi,
  ERC20Abi,
  governanceAddress,
  stakingAssetAddress,
} from "@/lib/contracts";
import { type Address, walletActions } from "viem";
import { TX_RECEIPT_TIMEOUT } from "@/lib/constants";
import { sanitizeTransactionError } from "@/lib/format";

export type DepositStep =
  | "idle"
  | "approving"
  | "waiting-approve"
  | "depositing"
  | "waiting-deposit"
  | "success"
  | "error";

export function useDeposit() {
  const { connector, chain } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<DepositStep>("idle");
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | undefined>();
  const [depositError, setDepositError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const deposit = useCallback(
    async (amount: bigint, userAddress: Address) => {
      if (!connector || !publicClient) {
        setDepositError(new Error("Wallet not connected"));
        setStep("error");
        return;
      }

      abortRef.current = false;
      setDepositError(null);
      setFinalTxHash(undefined);

      try {
        const client = await getConnectorClient(config, { connector });
        const walletClient = client.extend(walletActions);

        // Step 1: Approve
        setStep("approving");
        const approveTx = await walletClient.writeContract({
          chain,
          address: stakingAssetAddress,
          abi: ERC20Abi,
          functionName: "approve",
          args: [governanceAddress, amount],
        });
        if (abortRef.current) return;

        setStep("waiting-approve");
        await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: TX_RECEIPT_TIMEOUT });
        if (abortRef.current) return;

        // Step 2: Deposit
        setStep("depositing");
        const depositTx = await walletClient.writeContract({
          chain,
          address: governanceAddress,
          abi: GovernanceAbi,
          functionName: "deposit",
          args: [userAddress, amount],
        });
        if (abortRef.current) return;

        setStep("waiting-deposit");
        await publicClient.waitForTransactionReceipt({ hash: depositTx, timeout: TX_RECEIPT_TIMEOUT });
        if (abortRef.current) return;

        setFinalTxHash(depositTx);
        setStep("success");
      } catch (err) {
        if (!abortRef.current) {
          setDepositError(new Error(sanitizeTransactionError(err)));
          setStep("error");
        }
      }
    },
    [connector, chain, config, publicClient]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStep("idle");
    setFinalTxHash(undefined);
    setDepositError(null);
  }, []);

  return {
    deposit,
    step,
    txHash: finalTxHash,
    isPending: step !== "idle" && step !== "success" && step !== "error",
    isSuccess: step === "success",
    isError: step === "error",
    error: depositError,
    reset,
  };
}
