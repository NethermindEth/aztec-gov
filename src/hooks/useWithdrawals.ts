"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Address, type PublicClient } from "viem";
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
  isFetching: boolean;
  /** True when at least one getLogs chunk failed, so the list may be partial. */
  scanIncomplete: boolean;
  error: Error | null;
  refetch: () => void;
}

// Under publicnode's 50k eth_getLogs cap; rejected chunks are skipped and flagged.
const CHUNK_SIZE = 49_000n;
// ~277 days at 12s blocks. E2E mode shrinks the lookback so 28 sequential
// page loads don't saturate the fork RPC. Long-term fix is the indexer.
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

// Walks blocks in chunks and returns the set of withdrawalIds whose
// recipient is in `recipients`. Failed chunks are skipped but flagged via
// `incomplete` so the UI can warn instead of silently showing fewer rows.
async function scanWithdrawalIds(
  client: PublicClient,
  recipients: Address[],
  lookback: bigint,
  chunkSize: bigint
): Promise<{ ids: bigint[]; incomplete: boolean }> {
  const blockNumber = await client.getBlockNumber();
  const endBlock = blockNumber > lookback ? blockNumber - lookback : 0n;
  const ids = new Set<bigint>();
  let incomplete = false;

  for (let toBlock = blockNumber; toBlock >= endBlock; toBlock -= chunkSize) {
    const fromBlock =
      toBlock - chunkSize + 1n < endBlock ? endBlock : toBlock - chunkSize + 1n;

    const perRecipient = await Promise.all(
      recipients.map((r) =>
        client
          .getLogs({
            address: governanceAddress,
            event: withdrawInitiatedEvent,
            args: { recipient: r },
            fromBlock,
            toBlock,
          })
          .catch((err) => {
            console.warn(
              `useWithdrawals: getLogs failed for ${fromBlock}-${toBlock}`,
              err
            );
            incomplete = true;
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

  return { ids: Array.from(ids), incomplete };
}

// Multicalls getWithdrawal(id) for each id and filters by claimed=false +
// recipient match.
async function resolveWithdrawals(
  client: PublicClient,
  ids: bigint[],
  recipientSet: Set<string>,
  nowSec: bigint
): Promise<WithdrawalInfo[]> {
  if (ids.length === 0) return [];

  const results = await client.multicall({
    contracts: ids.map((id) => ({
      address: governanceAddress,
      abi: GovernanceAbi,
      functionName: "getWithdrawal" as const,
      args: [id] as const,
    })),
    allowFailure: true,
  });

  const out: WithdrawalInfo[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "success" || !r.result) continue;
    const w = r.result as unknown as WithdrawalRaw;
    if (w.claimed) continue;
    if (!recipientSet.has(w.recipient.toLowerCase())) continue;
    out.push({
      id: ids[i],
      amount: w.amount,
      unlocksAt: w.unlocksAt,
      recipient: w.recipient,
      claimed: false,
      status: w.unlocksAt <= nowSec ? "ready" : "pending",
    });
  }
  return out;
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
    queryFn: async (): Promise<{
      withdrawals: WithdrawalInfo[];
      scanIncomplete: boolean;
    }> => {
      const { ids, incomplete } = await scanWithdrawalIds(
        publicClient!,
        normalizedRecipients as Address[],
        MAX_BLOCKS_BACK,
        CHUNK_SIZE
      );
      const recipientSet = new Set(normalizedRecipients);
      // Dev-only: NEXT_PUBLIC_DEV_NOW_OVERRIDE (unix seconds) simulates a
      // future "now" so time-advanced fork withdrawals appear claimable.
      const override = process.env.NEXT_PUBLIC_DEV_NOW_OVERRIDE;
      const nowSec = override
        ? BigInt(override)
        : BigInt(Math.floor(Date.now() / 1000));
      const withdrawals = await resolveWithdrawals(
        publicClient!,
        ids,
        recipientSet,
        nowSec
      );
      return { withdrawals, scanIncomplete: incomplete };
    },
  });

  return {
    withdrawals: query.data?.withdrawals ?? [],
    withdrawalDelay,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    scanIncomplete: query.data?.scanIncomplete ?? false,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}
