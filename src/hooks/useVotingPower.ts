"use client";

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

interface VotingPowerResult {
  walletBalance: bigint;
  governancePower: bigint;
  gsePower: bigint;
  totalVotingPower: bigint;
  supplyPercentage: number;
  isLoading: boolean;
}

const ZERO: VotingPowerResult = {
  walletBalance: 0n,
  governancePower: 0n,
  gsePower: 0n,
  totalVotingPower: 0n,
  supplyPercentage: 0,
  isLoading: false,
};

export function useVotingPower(
  address: Address | undefined,
  totalSupply: bigint
): VotingPowerResult {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: stakingAssetAddress,
        abi: ERC20Abi,
        functionName: "balanceOf",
        args: [address!],
      },
      {
        address: governanceAddress,
        abi: GovernanceAbi,
        functionName: "powerNow",
        args: [address!],
      },
      {
        address: gseAddress,
        abi: GSEAbi,
        functionName: "getVotingPower",
        args: [address!],
      },
    ],
    query: {
      enabled: !!address,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  if (!address) return ZERO;
  if (isLoading) return { ...ZERO, isLoading: true };
  if (!data) return ZERO;

  const walletBalance = (data[0].result as bigint) ?? 0n;
  const governancePower = (data[1].result as bigint) ?? 0n;
  const gsePower = (data[2].result as bigint) ?? 0n;
  const totalVotingPower = governancePower + gsePower;

  const supplyPercentage =
    totalSupply > 0n
      ? Number((totalVotingPower * 10000n) / totalSupply) / 100
      : 0;

  return {
    walletBalance,
    governancePower,
    gsePower,
    totalVotingPower,
    supplyPercentage,
    isLoading,
  };
}
