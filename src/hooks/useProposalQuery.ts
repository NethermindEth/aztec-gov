"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  fetchProposalIndex,
  fetchProposalPage,
  fetchProposalByIdWithPower,
} from "@/lib/governance";
import { buildKey } from "@/lib/query-keys";
import { REFETCH_INTERVAL, SLOW_REFETCH_INTERVAL, ITEMS_PER_PAGE } from "@/lib/constants";
import {
  buildProposalDetailView,
  buildProposalsPageData,
  computeFilteredPageIds,
} from "@/lib/proposal-view";
import type { ProposalDetailView, ProposalsPageData } from "@/lib/types";

export type { ProposalsPageData } from "@/lib/types";

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
          if (!prevView) continue;
          if (prevView.azupMeta && !view.azupMeta) {
            view.azupMeta = prevView.azupMeta;
            view.title = prevView.title;
            view.description = prevView.description;
          }
          if (prevView.githubInfo?.apiTitle && !view.githubInfo?.apiTitle && view.githubInfo) {
            view.githubInfo.apiTitle = prevView.githubInfo.apiTitle;
            view.githubInfo.apiState = prevView.githubInfo.apiState;
            view.githubInfo.apiDescription = prevView.githubInfo.apiDescription;
          }
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
      if (!proposal) throw new Error("Proposal not found");
      const view = buildProposalDetailView(proposal, totalPower, proposalId);

      // Preserve server-enriched fields across client refetches
      const prev = queryClient.getQueryData<ProposalDetailView>(queryKey);
      if (prev) {
        if (prev.azupMeta && !view.azupMeta) {
          view.azupMeta = prev.azupMeta;
          view.title = prev.title;
          view.description = prev.description;
        }
        if (prev.githubInfo?.apiTitle && !view.githubInfo?.apiTitle && view.githubInfo) {
          view.githubInfo.apiTitle = prev.githubInfo.apiTitle;
          view.githubInfo.apiState = prev.githubInfo.apiState;
          view.githubInfo.apiDescription = prev.githubInfo.apiDescription;
        }
      }

      return view;
    },
    initialData,
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
