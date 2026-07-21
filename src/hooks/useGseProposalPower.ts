"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { GovernanceAbi, GSEAbi, governanceAddress, gseAddress } from "@/lib/contracts";
import { getPendingThrough, type ProposalConfiguration } from "@/lib/governance";
import { REFETCH_INTERVAL } from "@/lib/constants";

interface UseGseProposalPowerOptions {
  /** Gate the reads; pass the modal's isOpen so closed modals don't poll. */
  enabled: boolean;
  /** Shown while Pending, where the snapshot read reverts (future timestamp);
      the caller already has this from useVotingPower. */
  livePowerFallback: bigint;
}

interface GseProposalPower {
  /** Power delegated to `address` still spendable on this proposal. */
  available: bigint;
  isLoading: boolean;
}

// Per-proposal availability: power snapshotted when the proposal left
// Pending, minus power already spent on it.
export function useGseProposalPower(
  address: Address | undefined,
  proposalId: number,
  { enabled, livePowerFallback }: UseGseProposalPowerOptions
): GseProposalPower {
  const active = enabled && !!address && gseAddress !== zeroAddress;

  const { data: proposal, isLoading: proposalLoading } = useReadContract({
    address: governanceAddress,
    abi: GovernanceAbi,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
    query: { enabled: active },
  });

  const proposalFields = proposal as
    | { configuration: ProposalConfiguration; creation: bigint }
    | undefined;
  const snapshotTs = proposalFields
    ? getPendingThrough(proposalFields.creation, proposalFields.configuration)
    : undefined;

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: gseAddress,
        abi: GSEAbi,
        functionName: "getVotingPowerAt" as const,
        args: [address ?? zeroAddress, snapshotTs ?? 0n] as const,
      },
      {
        address: gseAddress,
        abi: GSEAbi,
        functionName: "getPowerUsed" as const,
        args: [address ?? zeroAddress, BigInt(proposalId)] as const,
      },
    ],
    query: {
      enabled: active && snapshotTs !== undefined,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  if (!active) return { available: 0n, isLoading: false };
  if (proposalLoading || isLoading || !data)
    return { available: 0n, isLoading: proposalLoading || isLoading };

  const snapshotPower =
    data[0]?.status === "success"
      ? (data[0].result as bigint)
      : livePowerFallback;
  const used = (data[1]?.result as bigint | undefined) ?? 0n;
  return {
    available: snapshotPower > used ? snapshotPower - used : 0n,
    isLoading: false,
  };
}
