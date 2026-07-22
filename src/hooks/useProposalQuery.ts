"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  fetchProposalIndex,
  fetchProposalPage,
  fetchProposalByIdWithPower,
} from "@/lib/governance";
import { buildKey } from "@/lib/query-keys";
import { ProposalNotFoundError } from "@/lib/errors";
import { REFETCH_INTERVAL, SLOW_REFETCH_INTERVAL, ITEMS_PER_PAGE } from "@/lib/constants";
import {
  applyEnrichment,
  buildProposalDetailView,
  buildProposalsPageData,
  computeFilteredPageIds,
} from "@/lib/proposal-view";
import type { ProposalDetailView, ProposalsPageData } from "@/lib/types";

export type { ProposalsPageData } from "@/lib/types";

// Client rebuilds carry only on-chain data; enrichment (titles, summaries,
// discussion links) is server-side, so carry the previous snapshot's forward.
function carryEnrichment(
  prev: ProposalDetailView | ProposalsPageData["proposals"][number],
  next: ProposalDetailView | ProposalsPageData["proposals"][number]
): void {
  if (prev.enrichment && !next.enrichment) applyEnrichment(next, prev.enrichment);
}

// ─── Listing (paginated) ────────────────────────────────────────────────────

export interface ProposalQueryParams {
  filter?: string;
  page: number;
}

export function useProposalsQuery(
  params: ProposalQueryParams,
  initialData?: ProposalsPageData
) {
  const queryClient = useQueryClient();
  const key = buildKey({
    type: "proposals-page",
    filter: params.filter ?? "All",
    page: params.page,
  });
  const queryKey = [key];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const index = await fetchProposalIndex();
      const filteredIds = computeFilteredPageIds(
        index.states,
        params.filter,
        params.page,
        ITEMS_PER_PAGE
      );
      const proposals = await fetchProposalPage(filteredIds, index.states);
      const data = buildProposalsPageData(index, proposals, index.totalPower, params.filter);

      // Preserve server-enriched fields across client refetches
      const prev = queryClient.getQueryData<ProposalsPageData>(queryKey);
      if (prev) {
        for (const view of data.proposals) {
          const prevView = prev.proposals.find((p) => p.numericId === view.numericId);
          if (prevView) carryEnrichment(prevView, view);
        }
      }

      return data;
    },
    initialData,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.activeCount === 0) return SLOW_REFETCH_INTERVAL;
      return REFETCH_INTERVAL;
    },
  });
}

// ─── Single proposal (detail page) ───────────────────────────────────────────

export function useProposalQuery(proposalId: number, initialData?: ProposalDetailView) {
  const queryClient = useQueryClient();
  const queryKey = [buildKey({ type: "proposal", id: proposalId })];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const { proposal, totalPower } = await fetchProposalByIdWithPower(proposalId);
      if (!proposal) throw new ProposalNotFoundError(proposalId);
      const view = buildProposalDetailView(proposal, totalPower, proposalId);

      // Preserve server-enriched fields across client refetches
      const prev = queryClient.getQueryData<ProposalDetailView>(queryKey);
      if (prev) carryEnrichment(prev, view);

      return view;
    },
    initialData,
    // A nonexistent id is definitive; only transport errors deserve retries.
    retry: (failureCount, error) =>
      !(error instanceof ProposalNotFoundError) && failureCount < 3,
    refetchInterval: (query) => {
      if (query.state.data?.isTerminal) return false;
      return REFETCH_INTERVAL;
    },
  });
}

// ─── Invalidation helper ──────────────────────────────────────────────────────

export function useInvalidateProposal() {
  const queryClient = useQueryClient();
  return (proposalId: number) => {
    queryClient.invalidateQueries({
      queryKey: [buildKey({ type: "proposal", id: proposalId })],
    });
    // Invalidate all page queries
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("proposals-page:");
      },
    });
  };
}
