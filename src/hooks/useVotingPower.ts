"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import {
  GovernanceAbi,
  ERC20Abi,
  GSEAbi,
  governanceAddress,
  stakingAssetAddress,
  gseAddress,
} from "@/lib/contracts";
import type { Address } from "viem";
import { REFETCH_INTERVAL } from "@/lib/constants";
import { useUserStakers } from "@/hooks/useUserStakers";

export interface StakerPower {
  stakerAddress: Address;
  power: bigint;
}

interface VotingPowerResult {
  walletBalance: bigint;
  governancePower: bigint;
  gsePower: bigint;
  stakerPowers: StakerPower[];
  totalStakerPower: bigint;
  totalVotingPower: bigint;
  supplyPercentage: number;
  isLoading: boolean;
  indexerError?: Error;
}

const ZERO: VotingPowerResult = {
  walletBalance: 0n,
  governancePower: 0n,
  gsePower: 0n,
  stakerPowers: [],
  totalStakerPower: 0n,
  totalVotingPower: 0n,
  supplyPercentage: 0,
  isLoading: false,
};

export function useVotingPower(
  address: Address | undefined,
  totalSupply: bigint
): VotingPowerResult {
  const {
    stakers,
    isLoading: stakersLoading,
    error: stakersError,
  } = useUserStakers(address);

  const contracts = useMemo(() => {
    if (!address) return [];
    const base = [
      {
        address: stakingAssetAddress,
        abi: ERC20Abi,
        functionName: "balanceOf" as const,
        args: [address] as const,
      },
      {
        address: governanceAddress,
        abi: GovernanceAbi,
        functionName: "powerNow" as const,
        args: [address] as const,
      },
      {
        address: gseAddress,
        abi: GSEAbi,
        functionName: "getVotingPower" as const,
        args: [address] as const,
      },
    ];
    const stakerReads = stakers.map((stakerAddress) => ({
      address: governanceAddress,
      abi: GovernanceAbi,
      functionName: "powerNow" as const,
      args: [stakerAddress] as const,
    }));
    return [...base, ...stakerReads];
  }, [address, stakers]);

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && contracts.length > 0,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  if (!address) return ZERO;

  const loading = isLoading || stakersLoading;
  if (loading) return { ...ZERO, isLoading: true, indexerError: stakersError };
  if (!data) return { ...ZERO, indexerError: stakersError };

  const walletBalance = (data[0]?.result as bigint | undefined) ?? 0n;
  const governancePower = (data[1]?.result as bigint | undefined) ?? 0n;
  const gsePower = (data[2]?.result as bigint | undefined) ?? 0n;

  const stakerPowers: StakerPower[] = stakers.map((stakerAddress, i) => ({
    stakerAddress,
    power: (data[3 + i]?.result as bigint | undefined) ?? 0n,
  }));
  const totalStakerPower = stakerPowers.reduce(
    (acc, s) => acc + s.power,
    0n
  );
  const totalVotingPower = governancePower + gsePower + totalStakerPower;

  const supplyPercentage =
    totalSupply > 0n
      ? Number((totalVotingPower * 10000n) / totalSupply) / 100
      : 0;

  return {
    walletBalance,
    governancePower,
    gsePower,
    stakerPowers,
    totalStakerPower,
    totalVotingPower,
    supplyPercentage,
    isLoading: false,
    indexerError: stakersError,
  };
}
