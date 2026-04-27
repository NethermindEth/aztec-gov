"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, isAddress, type Address } from "viem";
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

const EMPTY_HOLDINGS: ATPPosition[] = [];

function parseDevExtraStakers(): Address[] {
  const raw = process.env.NEXT_PUBLIC_DEV_EXTRA_STAKERS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && isAddress(s))
    .map((s) => getAddress(s));
}

export function useUserStakers(
  address: Address | undefined
): UseUserStakersResult {
  const baseUrl = getIndexerBaseUrl();
  const extraStakers = parseDevExtraStakers();
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

  const discovered = data?.stakers ?? [];
  const seen = new Set(discovered);
  const merged = [...discovered];
  for (const s of extraStakers) {
    if (!seen.has(s)) {
      seen.add(s);
      merged.push(s);
    }
  }

  return {
    stakers: merged,
    holdings: data?.holdings ?? EMPTY_HOLDINGS,
    isLoading: enabled && isFetching,
    error: error ?? undefined,
  };
}
