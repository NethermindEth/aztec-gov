"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { getAddress, isAddress, type Address } from "viem";
import {
  fetchBeneficiaryHoldings,
  getIndexerBaseUrl,
  type ATPPosition,
} from "@/lib/indexer";
import { discoverHoldingsOnChain } from "@/lib/atp-discovery";

interface UseUserStakersResult {
  stakers: Address[];
  holdings: ATPPosition[];
  /** True when holdings came from the on-chain fallback and may be missing entries. */
  discoveryIncomplete: boolean;
  isLoading: boolean;
  error?: Error;
  refetch: () => Promise<unknown>;
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

function parseDevBeneficiaryOverride(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_DEV_BENEFICIARY?.trim();
  if (!raw || !isAddress(raw)) return undefined;
  return getAddress(raw);
}

export function useUserStakers(
  address: Address | undefined
): UseUserStakersResult {
  const baseUrl = getIndexerBaseUrl();
  const publicClient = usePublicClient();
  const extraStakers = parseDevExtraStakers();
  // Dev-only override: query the indexer as a different beneficiary, useful
  // for previewing another user's vault state without their private key.
  const override = parseDevBeneficiaryOverride();
  const lookupAddress = override ?? address;
  const enabled = !!lookupAddress && !!baseUrl;

  const { data, isFetching, error, refetch } = useQuery<{
    stakers: Address[];
    holdings: ATPPosition[];
    discoveryIncomplete: boolean;
  }>({
    queryKey: ["user-stakers", baseUrl ?? "", lookupAddress ?? ""],
    enabled,
    staleTime: 60_000,
    // The fallback is ~41 getLogs calls; default retries + refetch-on-focus would make outages an RPC storm.
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      let holdings: ATPPosition[];
      let discoveryIncomplete = false;
      try {
        holdings = await fetchBeneficiaryHoldings(baseUrl!, lookupAddress!, signal);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        if (!publicClient) throw err;
        // Indexer unreachable: recover what the on-chain scan can see and flag the gap.
        const fallback = await discoverHoldingsOnChain(publicClient, lookupAddress!, signal);
        holdings = fallback.holdings;
        discoveryIncomplete = fallback.incomplete;
      }
      const seen = new Set<string>();
      const stakers: Address[] = [];
      for (const h of holdings) {
        if (!h.stakerAddress) continue;
        const checksummed = getAddress(h.stakerAddress);
        if (seen.has(checksummed)) continue;
        seen.add(checksummed);
        stakers.push(checksummed);
      }
      return { stakers, holdings, discoveryIncomplete };
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
    discoveryIncomplete: data?.discoveryIncomplete ?? false,
    isLoading: enabled && isFetching,
    error: error ?? undefined,
    refetch: () => refetch(),
  };
}
