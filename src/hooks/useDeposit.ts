"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useConfig, usePublicClient } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import {
  GovernanceAbi,
  ERC20Abi,
  ATPAbi,
  StakerAbi,
  governanceAddress,
  stakingAssetAddress,
} from "@/lib/contracts";
import { type Address, walletActions } from "viem";
import { waitForSuccessfulReceipt } from "@/lib/tx";
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

  /**
   * Deposit `amount` of AZT into Governance.
   *
   * Direct (default): wallet approves AZT, then Governance.deposit.
   * Staker: ATP.approveStaker, then Staker.depositIntoGovernance.
   * The approve tx is skipped when existing allowance covers `amount`.
   */
  const deposit = useCallback(
    async (
      amount: bigint,
      userAddress: Address,
      source?: { kind: "staker"; atp: Address; staker: Address }
    ) => {
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

        const isStaker = source?.kind === "staker";
        const spender = isStaker ? source.staker : governanceAddress;
        const allowanceOwner = isStaker ? source.atp : userAddress;

        // Skip the approve tx if the existing allowance already covers
        // `amount`. ATP holders typically have leftover allowance from prior
        // deposits; wallet users may too if they previously approved more.
        const existingAllowance = (await publicClient.readContract({
          address: stakingAssetAddress,
          abi: ERC20Abi,
          functionName: "allowance",
          args: [allowanceOwner, spender],
        })) as bigint;

        if (existingAllowance < amount) {
          setStep("approving");
          const approveTx = isStaker
            ? await walletClient.writeContract({
                chain,
                address: source.atp,
                abi: ATPAbi,
                functionName: "approveStaker",
                args: [amount],
              })
            : await walletClient.writeContract({
                chain,
                address: stakingAssetAddress,
                abi: ERC20Abi,
                functionName: "approve",
                args: [governanceAddress, amount],
              });
          if (abortRef.current) return;

          setStep("waiting-approve");
          await waitForSuccessfulReceipt(publicClient, approveTx);
          if (abortRef.current) return;
        }

        setStep("depositing");
        let depositTx;
        if (isStaker) {
          depositTx = await walletClient.writeContract({
            chain,
            address: source.staker,
            abi: StakerAbi,
            functionName: "depositIntoGovernance",
            args: [amount],
          });
        } else {
          depositTx = await walletClient.writeContract({
            chain,
            address: governanceAddress,
            abi: GovernanceAbi,
            functionName: "deposit",
            args: [userAddress, amount],
          });
        }
        if (abortRef.current) return;

        setStep("waiting-deposit");
        await waitForSuccessfulReceipt(publicClient, depositTx);
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
