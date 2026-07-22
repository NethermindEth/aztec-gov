"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { zeroAddress, type Address } from "viem";
import {
  GovernanceAbi,
  GSEAbi,
  governanceAddress,
  gseAddress,
} from "@/lib/contracts";
import { REFETCH_INTERVAL } from "@/lib/constants";
import { useUserStakers } from "@/hooks/useUserStakers";

export interface UserVote {
  hasVoted: boolean;
  /** Power voted For, summed across the wallet and its stakers. */
  forVotes: bigint;
  againstVotes: bigint;
  /** Delegated power the wallet spent via the GSE (direction not tracked per delegatee). */
  delegatedUsed: bigint;
  isLoading: boolean;
}

const NONE: UserVote = {
  hasVoted: false,
  forVotes: 0n,
  againstVotes: 0n,
  delegatedUsed: 0n,
  isLoading: false,
};

// A wallet can vote three ways, each recorded under a different address:
// directly (its own ballot), through each Staker (the Staker's ballot), and
// with delegated power (spent via the GSE, read back with getPowerUsed).
export function useUserVote(
  proposalId: number,
  address: Address | undefined
): UserVote {
  const { stakers, isLoading: stakersLoading } = useUserStakers(address);
  const gseConfigured = gseAddress !== zeroAddress;

  const contracts = useMemo(() => {
    if (!address) return [];
    const ballotReads = [address, ...stakers].map((voter) => ({
      address: governanceAddress,
      abi: GovernanceAbi,
      functionName: "getBallot" as const,
      args: [BigInt(proposalId), voter] as const,
    }));
    const gseRead = gseConfigured
      ? [
          {
            address: gseAddress,
            abi: GSEAbi,
            functionName: "getPowerUsed" as const,
            args: [address, BigInt(proposalId)] as const,
          },
        ]
      : [];
    return [...ballotReads, ...gseRead];
  }, [address, stakers, proposalId, gseConfigured]);

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && contracts.length > 0,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  if (!address) return NONE;
  const loading = isLoading || stakersLoading;
  if (loading || !data) return { ...NONE, isLoading: loading };

  // ballotReads come first (wallet + each staker), then the optional GSE read.
  let forVotes = 0n;
  let againstVotes = 0n;
  for (let i = 0; i < stakers.length + 1; i++) {
    const ballot = data[i]?.result as { yea: bigint; nay: bigint } | undefined;
    if (ballot) {
      forVotes += ballot.yea;
      againstVotes += ballot.nay;
    }
  }
  const delegatedUsed = gseConfigured
    ? (data[stakers.length + 1]?.result as bigint | undefined) ?? 0n
    : 0n;

  return {
    hasVoted: forVotes + againstVotes + delegatedUsed > 0n,
    forVotes,
    againstVotes,
    delegatedUsed,
    isLoading: false,
  };
}
