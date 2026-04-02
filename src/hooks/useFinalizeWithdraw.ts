"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import { GovernanceAbi, governanceAddress } from "@/lib/contracts";
import { walletActions } from "viem";
import { TX_RECEIPT_TIMEOUT } from "@/lib/constants";
import { sanitizeTransactionError } from "@/lib/format";

export type FinalizeStep =
  | "idle"
  | "finalizing"
  | "waiting"
  | "success"
  | "error";

export function useFinalizeWithdraw() {
  const { connector } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<FinalizeStep>("idle");
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | undefined>();
  const [finalizeError, setFinalizeError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const finalize = useCallback(
    async (withdrawalId: bigint) => {
      if (!connector || !publicClient) {
        setFinalizeError(new Error("Wallet not connected"));
        setStep("error");
        return;
      }

      abortRef.current = false;
      setFinalizeError(null);
      setFinalTxHash(undefined);

      try {
        const client = await getConnectorClient(config, { connector });
        const walletClient = client.extend(walletActions);

        setStep("finalizing");
        const txHash = await walletClient.writeContract({
          address: governanceAddress,
          abi: GovernanceAbi,
          functionName: "finalizeWithdraw",
          args: [withdrawalId],
        });
        if (abortRef.current) return;

        setStep("waiting");
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: TX_RECEIPT_TIMEOUT });
        if (abortRef.current) return;

        setFinalTxHash(txHash);
        setStep("success");
      } catch (err) {
        if (!abortRef.current) {
          setFinalizeError(new Error(sanitizeTransactionError(err)));
          setStep("error");
        }
      }
    },
    [connector, config, publicClient]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStep("idle");
    setFinalTxHash(undefined);
    setFinalizeError(null);
  }, []);

  return {
    finalize,
    step,
    txHash: finalTxHash,
    isPending: step !== "idle" && step !== "success" && step !== "error",
    isSuccess: step === "success",
    isError: step === "error",
    error: finalizeError,
    reset,
  };
}
