"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { getAddress, type Address } from "viem";
import { ATPAbi, ERC20Abi, stakingAssetAddress } from "@/lib/contracts";
import { REFETCH_INTERVAL } from "@/lib/constants";

// Per-ATP AZT balance + Staker operator, batched into one multicall so the
// deposit picker can gate on either without a second round-trip. Operator
// defaults to beneficiary but `ATP.updateStakerOperator` can rebind it.
export function useATPBalances(atpAddresses: Address[]): {
  balances: Map<Address, bigint>;
  operators: Map<Address, Address>;
  isLoading: boolean;
} {
  const normalized = useMemo(
    () => atpAddresses.map((a) => getAddress(a)),
    [atpAddresses]
  );

  const contracts = useMemo(
    () =>
      normalized.flatMap(
        (atp) =>
          [
            {
              address: stakingAssetAddress,
              abi: ERC20Abi,
              functionName: "balanceOf" as const,
              args: [atp] as const,
            },
            {
              address: atp,
              abi: ATPAbi,
              functionName: "getOperator" as const,
            },
          ] as const
      ),
    [normalized]
  );

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: normalized.length > 0,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  const { balances, operators } = useMemo(() => {
    const bMap = new Map<Address, bigint>();
    const oMap = new Map<Address, Address>();
    if (!data) return { balances: bMap, operators: oMap };
    normalized.forEach((atp, i) => {
      const balanceResult = data[i * 2];
      const operatorResult = data[i * 2 + 1];
      bMap.set(
        atp,
        balanceResult?.status === "success"
          ? (balanceResult.result as bigint)
          : 0n
      );
      if (operatorResult?.status === "success") {
        oMap.set(atp, getAddress(operatorResult.result as Address));
      }
    });
    return { balances: bMap, operators: oMap };
  }, [data, normalized]);

  return { balances, operators, isLoading };
}
