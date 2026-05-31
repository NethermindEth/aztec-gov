"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { GovernanceAbi, governanceAddress } from "@/lib/contracts";
import { REFETCH_INTERVAL } from "@/lib/constants";

interface WithdrawalRaw {
  amount: bigint;
  unlocksAt: bigint;
  recipient: Address;
  claimed: boolean;
}

interface GovernanceConfig {
  proposeConfig: { lockDelay: bigint; lockAmount: bigint };
  votingDelay: bigint;
  votingDuration: bigint;
  executionDelay: bigint;
  gracePeriod: bigint;
  quorum: bigint;
  requiredYeaMargin: bigint;
  minimumVotes: bigint;
}

export interface WithdrawalInfo {
  id: bigint;
  amount: bigint;
  unlocksAt: bigint;
  recipient: Address;
  claimed: false;
  status: "pending" | "ready";
}

interface UseWithdrawalsResult {
  withdrawals: WithdrawalInfo[];
  withdrawalDelay: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Under publicnode's 50k eth_getLogs cap; paid RPCs accept it too.
const CHUNK_SIZE = 49_000n;
// 2M blocks ≈ 277d catches procrastinators (lock is ~37.6d). E2E mode shrinks
// the lookback so 28 sequential page loads don't saturate the fork RPC.
const MAX_BLOCKS_BACK =
  process.env.NEXT_PUBLIC_E2E === "1" ? 50_000n : 2_000_000n;

const withdrawInitiatedEvent = parseAbiItem(
  "event WithdrawInitiated(uint256 indexed withdrawalId, address indexed recipient, uint256 amount)"
);

/**
 * Withdrawal lock period, per `Governance.sol`:
 *   `votingDelay/5 + votingDuration + executionDelay`
 * The Configuration struct (canonical ABI) nests a `proposeConfig` tuple
 * first, then the four Timestamp fields, then the uint256 amounts.
 * Cached forever — governance config is effectively immutable.
 */
export function useWithdrawalDelay(): bigint | undefined {
  const publicClient = usePublicClient();
  const { data } = useQuery({
    queryKey: ["governance-withdrawal-delay", governanceAddress],
    enabled: !!publicClient,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const cfg = (await publicClient!.readContract({
        address: governanceAddress,
        abi: GovernanceAbi,
        functionName: "getConfiguration",
      })) as unknown as GovernanceConfig;
      return cfg.votingDelay / 5n + cfg.votingDuration + cfg.executionDelay;
    },
  });
  return data ?? undefined;
}

/**
 * Unclaimed Governance withdrawals where `recipient` is one of `recipients`.
 *
 * ATP holders' withdrawals carry `recipient = atpAddress` (the Staker calls
 * `Governance.initiateWithdraw(atp, ...)`), so the caller passes
 * `[wallet, ...atpAddresses]` to surface both direct and ATP-routed entries.
 */
export function useWithdrawals(recipients: Address[]): UseWithdrawalsResult {
  const publicClient = usePublicClient();
  const withdrawalDelay = useWithdrawalDelay();

  const normalizedRecipients = useMemo(() => {
    const set = new Set(recipients.map((r) => r.toLowerCase()));
    return Array.from(set).sort();
  }, [recipients]);

  const query = useQuery({
    queryKey: ["governance-withdrawals", governanceAddress, normalizedRecipients],
    enabled: !!publicClient && normalizedRecipients.length > 0,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<WithdrawalInfo[]> => {
      const blockNumber = await publicClient!.getBlockNumber();
      const endBlock =
        blockNumber > MAX_BLOCKS_BACK ? blockNumber - MAX_BLOCKS_BACK : 0n;

      const ids = new Set<bigint>();
      for (let toBlock = blockNumber; toBlock >= endBlock; toBlock -= CHUNK_SIZE) {
        const fromBlock =
          toBlock - CHUNK_SIZE + 1n < endBlock
            ? endBlock
            : toBlock - CHUNK_SIZE + 1n;

        const perRecipient = await Promise.all(
          normalizedRecipients.map((r) =>
            publicClient!
              .getLogs({
                address: governanceAddress,
                event: withdrawInitiatedEvent,
                args: { recipient: r as Address },
                fromBlock,
                toBlock,
              })
              .catch((err) => {
                console.warn(
                  `useWithdrawals: getLogs failed for ${fromBlock}-${toBlock}`,
                  err
                );
                return [];
              })
          )
        );
        for (const logs of perRecipient) {
          for (const log of logs) {
            if (log.args.withdrawalId != null) ids.add(log.args.withdrawalId);
          }
        }
      }

      if (ids.size === 0) return [];

      const orderedIds = Array.from(ids);
      const results = await publicClient!.multicall({
        contracts: orderedIds.map((id) => ({
          address: governanceAddress,
          abi: GovernanceAbi,
          functionName: "getWithdrawal" as const,
          args: [id] as const,
        })),
        allowFailure: true,
      });

      const recipientSet = new Set(normalizedRecipients);
      // Dev-only: NEXT_PUBLIC_DEV_NOW_OVERRIDE (unix seconds) simulates a
      // future "now" so time-advanced fork withdrawals appear claimable.
      const override = process.env.NEXT_PUBLIC_DEV_NOW_OVERRIDE;
      const nowSec = override
        ? BigInt(override)
        : BigInt(Math.floor(Date.now() / 1000));
      const out: WithdrawalInfo[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "success" || !r.result) continue;
        const w = r.result as unknown as WithdrawalRaw;
        if (w.claimed) continue;
        if (!recipientSet.has(w.recipient.toLowerCase())) continue;
        out.push({
          id: orderedIds[i],
          amount: w.amount,
          unlocksAt: w.unlocksAt,
          recipient: w.recipient,
          claimed: false,
          status: w.unlocksAt <= nowSec ? "ready" : "pending",
        });
      }
      return out;
    },
  });

  return {
    withdrawals: query.data ?? [],
    withdrawalDelay,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}
