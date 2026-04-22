"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import {
  GovernanceAbi,
  ERC20Abi,
  StakerAbi,
  governanceAddress,
  stakingAssetAddress,
} from "@/lib/contracts";
import { type Address, walletActions } from "viem";
import { TX_RECEIPT_TIMEOUT } from "@/lib/constants";
import { sanitizeTransactionError } from "@/lib/format";

export type VoteStep =
  | "idle"
  | "approving"
  | "waiting-approve"
  | "depositing"
  | "waiting-deposit"
  | "voting"
  | "waiting-vote"
  | "success"
  | "error";

export function useVote() {
  const { connector, chain } = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<VoteStep>("idle");
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | undefined>();
  const [voteError, setVoteError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  const vote = useCallback(
    async (
      proposalId: number,
      amount: bigint,
      support: boolean,
      depositAmount: bigint,
      userAddress: Address,
      stakerAddress?: Address
    ) => {
      if (!connector || !publicClient) {
        setVoteError(new Error("Wallet not connected"));
        setStep("error");
        return;
      }

      if (stakerAddress && depositAmount > 0n) {
        setVoteError(
          new Error("Cannot deposit and vote via a staker in one action")
        );
        setStep("error");
        return;
      }

      abortRef.current = false;
      setVoteError(null);
      setFinalTxHash(undefined);

      try {
        // Get wallet client from the active connector
        const client = await getConnectorClient(config, { connector });
        const walletClient = client.extend(walletActions);

        if (depositAmount > 0n) {
          // Step 1: Approve
          setStep("approving");
          const approveTx = await walletClient.writeContract({
            chain,
            address: stakingAssetAddress,
            abi: ERC20Abi,
            functionName: "approve",
            args: [governanceAddress, depositAmount],
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
            args: [userAddress, depositAmount],
          });
          if (abortRef.current) return;

          setStep("waiting-deposit");
          await publicClient.waitForTransactionReceipt({ hash: depositTx, timeout: TX_RECEIPT_TIMEOUT });
          if (abortRef.current) return;
        }

        // Step 3: Vote — via staker or directly against governance
        setStep("voting");
        const voteTxHash = stakerAddress
          ? await walletClient.writeContract({
              chain,
              address: stakerAddress,
              abi: StakerAbi,
              functionName: "voteInGovernance",
              args: [BigInt(proposalId), amount, support],
            })
          : await walletClient.writeContract({
              chain,
              address: governanceAddress,
              abi: GovernanceAbi,
              functionName: "vote",
              args: [BigInt(proposalId), amount, support],
            });
        if (abortRef.current) return;

        setFinalTxHash(voteTxHash);
        setStep("success");
      } catch (err) {
        if (!abortRef.current) {
          setVoteError(new Error(sanitizeTransactionError(err)));
          setStep("error");
        }
      }
    },
    [connector, chain, config]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStep("idle");
    setFinalTxHash(undefined);
    setVoteError(null);
  }, []);

  return {
    vote,
    step,
    txHash: finalTxHash,
    isPending: step !== "idle" && step !== "success" && step !== "error",
    isSuccess: step === "success",
    isError: step === "error",
    error: voteError,
    reset,
  };
}
