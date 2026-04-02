"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePublicClient } from "wagmi";
import { GovernanceAbi, governanceAddress } from "@/lib/contracts";
import type { Address } from "viem";
import { REFETCH_INTERVAL } from "@/lib/constants";

export interface WithdrawalInfo {
  id: bigint;
  amount: bigint;
  unlocksAt: bigint;
  recipient: string;
  claimed: boolean;
  status: "pending" | "ready";
}

export function useWithdrawals(address: Address | undefined) {
  const publicClient = usePublicClient();
  const [withdrawals, setWithdrawals] = useState<WithdrawalInfo[]>([]);
  const [withdrawalDelay, setWithdrawalDelay] = useState<bigint | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const fetchWithdrawals = useCallback(async () => {
    if (!address || !publicClient) {
      setWithdrawals([]);
      return;
    }

    const id = ++fetchIdRef.current;

    try {
      // Read withdrawal count and governance config in parallel
      const [countResult, configResult] = await publicClient.multicall({
        contracts: [
          {
            address: governanceAddress,
            abi: GovernanceAbi,
            functionName: "withdrawalCount" as const,
          },
          {
            address: governanceAddress,
            abi: GovernanceAbi,
            functionName: "getConfiguration" as const,
          },
        ],
      });

      if (id !== fetchIdRef.current) return;

      // Compute withdrawal delay from config: votingDelay/5 + votingDuration + executionDelay
      if (configResult.status === "success" && configResult.result) {
        const config = configResult.result as unknown as {
          votingDelay: bigint;
          votingDuration: bigint;
          executionDelay: bigint;
        };
        const delay =
          config.votingDelay / 5n +
          config.votingDuration +
          config.executionDelay;
        setWithdrawalDelay(delay);
      }

      const total = Number(
        countResult.status === "success" ? countResult.result : 0n
      );
      if (total === 0) {
        setWithdrawals([]);
        setIsLoading(false);
        return;
      }

      // Multicall getWithdrawal for all IDs
      const ids = Array.from({ length: total }, (_, i) => BigInt(i));
      const results = await publicClient.multicall({
        contracts: ids.map((wId) => ({
          address: governanceAddress,
          abi: GovernanceAbi,
          functionName: "getWithdrawal" as const,
          args: [wId] as const,
        })),
      });

      if (id !== fetchIdRef.current) return;

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const userAddress = address.toLowerCase();
      const infos: WithdrawalInfo[] = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "success" || !r.result) continue;
        const w = r.result as unknown as {
          amount: bigint;
          unlocksAt: bigint;
          recipient: string;
          claimed: boolean;
        };
        // Only show this user's unclaimed withdrawals
        if (w.recipient.toLowerCase() !== userAddress) continue;
        if (w.claimed) continue;
        infos.push({
          id: ids[i],
          amount: w.amount,
          unlocksAt: w.unlocksAt,
          recipient: w.recipient,
          claimed: w.claimed,
          status: w.unlocksAt <= nowSec ? "ready" : "pending",
        });
      }

      setWithdrawals(infos);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (!address) {
      setWithdrawals([]);
      return;
    }

    setIsLoading(true);
    fetchWithdrawals();
    const interval = setInterval(fetchWithdrawals, REFETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [address, fetchWithdrawals]);

  return { withdrawals, withdrawalDelay, isLoading, refetch: fetchWithdrawals };
}
