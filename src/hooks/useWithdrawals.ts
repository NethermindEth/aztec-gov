"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
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

const CHUNK_SIZE = 50_000n;
const MAX_BLOCKS_BACK = 200_000n;

const withdrawInitiatedEvent = parseAbiItem(
  "event WithdrawInitiated(uint256 indexed withdrawalId, address indexed recipient, uint256 amount)"
);

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
      // Fetch governance config for withdrawal delay
      const configResult = await publicClient.readContract({
        address: governanceAddress,
        abi: GovernanceAbi,
        functionName: "getConfiguration",
      });

      if (id !== fetchIdRef.current) return;

      const config = configResult as unknown as {
        votingDelay: bigint;
        votingDuration: bigint;
        executionDelay: bigint;
      };
      const delay =
        config.votingDelay / 5n +
        config.votingDuration +
        config.executionDelay;
      setWithdrawalDelay(delay);

      // Scan WithdrawInitiated events filtered by recipient
      const blockNumber = await publicClient.getBlockNumber();
      const endBlock =
        blockNumber > MAX_BLOCKS_BACK ? blockNumber - MAX_BLOCKS_BACK : 0n;

      const allIds: bigint[] = [];

      for (
        let toBlock = blockNumber;
        toBlock >= endBlock;
        toBlock -= CHUNK_SIZE
      ) {
        if (id !== fetchIdRef.current) return;

        const fromBlock =
          toBlock - CHUNK_SIZE + 1n < endBlock
            ? endBlock
            : toBlock - CHUNK_SIZE + 1n;

        try {
          const logs = await publicClient.getLogs({
            address: governanceAddress,
            event: withdrawInitiatedEvent,
            args: { recipient: address },
            fromBlock,
            toBlock,
          });

          for (const log of logs) {
            if (log.args.withdrawalId != null) {
              allIds.push(log.args.withdrawalId);
            }
          }
        } catch (chunkError) {
          console.error(
            `Error fetching withdrawal events chunk ${fromBlock}-${toBlock}:`,
            chunkError
          );
        }
      }

      if (id !== fetchIdRef.current) return;

      if (allIds.length === 0) {
        setWithdrawals([]);
        setIsLoading(false);
        return;
      }

      // Deduplicate
      const uniqueIds = [
        ...new Set(allIds.map((i) => i.toString())),
      ].map((i) => BigInt(i));

      // Multicall getWithdrawal for the user's withdrawal IDs only
      const results = await publicClient.multicall({
        contracts: uniqueIds.map((wId) => ({
          address: governanceAddress,
          abi: GovernanceAbi,
          functionName: "getWithdrawal" as const,
          args: [wId] as const,
        })),
      });

      if (id !== fetchIdRef.current) return;

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
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
        if (w.claimed) continue;
        infos.push({
          id: uniqueIds[i],
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
