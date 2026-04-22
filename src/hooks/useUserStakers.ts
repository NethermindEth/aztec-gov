"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, type Address } from "viem";
import {
  fetchBeneficiaryHoldings,
  getIndexerBaseUrl,
  type ATPPosition,
} from "@/lib/indexer";

interface UseUserStakersResult {
  stakers: Address[];
  holdings: ATPPosition[];
  isLoading: boolean;
  error?: Error;
}

const EMPTY_STAKERS: Address[] = [];
const EMPTY_HOLDINGS: ATPPosition[] = [];

export function useUserStakers(
  address: Address | undefined
): UseUserStakersResult {
  const baseUrl = getIndexerBaseUrl();
  const enabled = !!address && !!baseUrl;

  const { data, isFetching, error } = useQuery<{
    stakers: Address[];
    holdings: ATPPosition[];
  }>({
    queryKey: ["user-stakers", baseUrl ?? "", address ?? ""],
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const holdings = await fetchBeneficiaryHoldings(baseUrl!, address!, signal);
      const seen = new Set<string>();
      const stakers: Address[] = [];
      for (const h of holdings) {
        if (!h.stakerAddress) continue;
        const checksummed = getAddress(h.stakerAddress);
        if (seen.has(checksummed)) continue;
        seen.add(checksummed);
        stakers.push(checksummed);
      }
      return { stakers, holdings };
    },
  });

  return {
    stakers: data?.stakers ?? EMPTY_STAKERS,
    holdings: data?.holdings ?? EMPTY_HOLDINGS,
    isLoading: enabled && isFetching,
    error: error ?? undefined,
  };
}
