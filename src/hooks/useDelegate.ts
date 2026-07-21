"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import { type Address, walletActions } from "viem";
import { GSEAbi, StakerAbi, gseAddress } from "@/lib/contracts";
import { waitForSuccessfulReceipt } from "@/lib/tx";
import { sanitizeTransactionError } from "@/lib/format";
import type { DelegationPosition } from "@/lib/gse-delegation";

export type DelegateStep =
  | "idle"
  | "delegating"
  | "waiting"
  | "success"
  | "error";

export interface DelegateProgress {
  /** 1-based index of the position currently being delegated. */
  current: number;
  total: number;
}

// The GSE has no batch delegate, so "delegate all" is one tx per position,
// submitted sequentially so the wallet prompts arrive in order.
export function useDelegate() {
  const { connector, chain } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<DelegateStep>("idle");
  const [progress, setProgress] = useState<DelegateProgress>({ current: 0, total: 0 });
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();
  const [delegateError, setDelegateError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const delegate = useCallback(
    async (positions: DelegationPosition[], delegatee: Address) => {
      if (!connector || !publicClient) {
        setDelegateError(new Error("Wallet not connected"));
        setStep("error");
        return;
      }
      if (positions.length === 0) {
        setDelegateError(new Error("No positions selected"));
        setStep("error");
        return;
      }
      if (positions.some((p) => p.route.kind === "locked")) {
        setDelegateError(
          new Error("A selected position cannot be re-delegated from this app")
        );
        setStep("error");
        return;
      }

      abortRef.current = false;
      setDelegateError(null);
      setLastTxHash(undefined);
      setProgress({ current: 0, total: positions.length });

      try {
        const client = await getConnectorClient(config, { connector });
        const walletClient = client.extend(walletActions);

        let lastTx: `0x${string}` | undefined;
        for (let i = 0; i < positions.length; i++) {
          const { route, instance, attester } = positions[i];
          setProgress({ current: i + 1, total: positions.length });
          setStep("delegating");
          const tx =
            route.kind === "staker"
              ? await walletClient.writeContract({
                  chain,
                  address: route.staker,
                  abi: StakerAbi,
                  functionName: "delegate",
                  args: [route.version, attester, delegatee],
                })
              : await walletClient.writeContract({
                  chain,
                  address: gseAddress,
                  abi: GSEAbi,
                  functionName: "delegate",
                  args: [instance, attester, delegatee],
                });
          if (abortRef.current) return;

          setStep("waiting");
          await waitForSuccessfulReceipt(publicClient, tx);
          if (abortRef.current) return;
          lastTx = tx;
        }

        setLastTxHash(lastTx);
        setStep("success");
      } catch (err) {
        if (!abortRef.current) {
          setDelegateError(new Error(sanitizeTransactionError(err)));
          setStep("error");
        }
      }
    },
    [connector, chain, config, publicClient]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStep("idle");
    setProgress({ current: 0, total: 0 });
    setLastTxHash(undefined);
    setDelegateError(null);
  }, []);

  return {
    delegate,
    step,
    progress,
    txHash: lastTxHash,
    isPending: step === "delegating" || step === "waiting",
    isSuccess: step === "success",
    isError: step === "error",
    error: delegateError,
    reset,
  };
}
