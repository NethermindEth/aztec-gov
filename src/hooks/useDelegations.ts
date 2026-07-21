"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { gseAddress } from "@/lib/config";
import {
  discoverDelegations,
  type DelegationPosition,
} from "@/lib/gse-delegation";
import { useUserStakers } from "@/hooks/useUserStakers";

interface UseDelegationsResult {
  positions: DelegationPosition[];
  /** True when some discovery reads failed, so positions may be missing. */
  incomplete: boolean;
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
}

const EMPTY: DelegationPosition[] = [];

// GSE stakes the connected wallet controls, directly or via its ATP Stakers.
export function useDelegations(address: Address | undefined): UseDelegationsResult {
  const publicClient = usePublicClient();
  const { stakers, isLoading: stakersLoading } = useUserStakers(address);

  const enabled =
    !!address && !!publicClient && !stakersLoading && gseAddress !== zeroAddress;

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["gse-delegations", address ?? "", stakers.join(",")],
    enabled,
    // The sweep is the app's most expensive read; like the withdrawal scan,
    // refresh only via explicit invalidation (useInvalidateDelegations).
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      discoverDelegations(publicClient!, gseAddress, address!, stakers, signal),
  });

  return {
    positions: data?.positions ?? EMPTY,
    incomplete: data?.incomplete ?? false,
    isLoading: enabled && isFetching,
    error: error ?? undefined,
    refetch: () => refetch(),
  };
}
