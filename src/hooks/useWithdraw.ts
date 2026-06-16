"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import { GovernanceAbi, StakerAbi, governanceAddress } from "@/lib/contracts";
import { type Address, walletActions, parseEventLogs } from "viem";
import { waitForSuccessfulReceipt } from "@/lib/tx";
import { sanitizeTransactionError } from "@/lib/format";

export type WithdrawStep =
  | "idle"
  | "initiating"
  | "waiting"
  | "success"
  | "error";

/**
 * Initiate a governance withdrawal.
 *
 * When `stakerAddress` is omitted, calls `Governance.initiateWithdraw(to, amount)`
 * directly. When provided, calls `Staker.initiateWithdrawFromGovernance(amount)`
 * — the Staker then calls Governance with the ATP as recipient. Either path
 * emits the same `WithdrawInitiated` event so parsing is shared.
 */
export function useWithdraw() {
  const { connector } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<WithdrawStep>("idle");
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | undefined>();
  const [withdrawalId, setWithdrawalId] = useState<bigint | undefined>();
  const [unlocksAt, setUnlocksAt] = useState<bigint | undefined>();
  const [withdrawError, setWithdrawError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const withdraw = useCallback(
    async (
      amount: bigint,
      userAddress: Address,
      stakerAddress?: Address
    ) => {
      if (!connector || !publicClient) {
        setWithdrawError(new Error("Wallet not connected"));
        setStep("error");
        return;
      }

      abortRef.current = false;
      setWithdrawError(null);
      setFinalTxHash(undefined);
      setWithdrawalId(undefined);
      setUnlocksAt(undefined);

      try {
        const client = await getConnectorClient(config, { connector });
        const walletClient = client.extend(walletActions);

        setStep("initiating");
        let txHash;
        if (stakerAddress) {
          txHash = await walletClient.writeContract({
            address: stakerAddress,
            abi: StakerAbi,
            functionName: "initiateWithdrawFromGovernance",
            args: [amount],
          });
        } else {
          txHash = await walletClient.writeContract({
            address: governanceAddress,
            abi: GovernanceAbi,
            functionName: "initiateWithdraw",
            args: [userAddress, amount],
          });
        }
        if (abortRef.current) return;

        setStep("waiting");
        const receipt = await waitForSuccessfulReceipt(publicClient, txHash);
        if (abortRef.current) return;

        const logs = parseEventLogs({
          abi: GovernanceAbi,
          eventName: "WithdrawInitiated",
          logs: receipt.logs,
        });

        let wId: bigint | undefined;
        if (logs.length > 0) {
          wId = logs[0].args.withdrawalId;
          setWithdrawalId(wId);
        }

        if (wId !== undefined) {
          try {
            const withdrawal = await publicClient.readContract({
              address: governanceAddress,
              abi: GovernanceAbi,
              functionName: "getWithdrawal",
              args: [wId],
            });
            setUnlocksAt((withdrawal as { unlocksAt: bigint }).unlocksAt);
          } catch {
            // unlocksAt is optional on the success screen
          }
        }

        setFinalTxHash(txHash);
        setStep("success");
      } catch (err) {
        if (!abortRef.current) {
          setWithdrawError(new Error(sanitizeTransactionError(err)));
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
    setWithdrawalId(undefined);
    setUnlocksAt(undefined);
    setWithdrawError(null);
  }, []);

  return {
    withdraw,
    step,
    txHash: finalTxHash,
    withdrawalId,
    unlocksAt,
    isPending: step !== "idle" && step !== "success" && step !== "error",
    isSuccess: step === "success",
    isError: step === "error",
    error: withdrawError,
    reset,
  };
}
