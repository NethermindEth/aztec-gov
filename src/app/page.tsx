import { fetchProposalIndex, fetchProposalPage } from "@/lib/governance";
import { buildProposalsPageData, computeFilteredPageIds } from "@/lib/proposal-view";
import { buildKey } from "@/lib/query-keys";
import { cachedFetch } from "@/lib/cache";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { enrichProposalView } from "@/lib/proposal-enrich";
import { GovernanceClient } from "./GovernanceClient";

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { page: pageParam, filter: filterParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const filter = filterParam ?? "All";

  const indexKey = buildKey({ type: "proposals-index" });
  const index = await cachedFetch(indexKey, fetchProposalIndex, 12_000);

  const filterForQuery = filter === "All" ? undefined : filter;
  const pageIds = computeFilteredPageIds(index.states, filterForQuery, page, ITEMS_PER_PAGE);

  const pageKey = buildKey({ type: "proposals-page", filter, page });
  const proposals = await cachedFetch(
    pageKey,
    () => fetchProposalPage(pageIds, index.states),
    12_000
  );

  const initialData = buildProposalsPageData(index, proposals, index.totalPower, filterForQuery);

  // Enrich proposals with AZUP, forum, and GitHub metadata in parallel
  await Promise.all(
    initialData.proposals.map((view, i) => enrichProposalView(view, proposals[i]?.uri))
  );

  return <GovernanceClient initialData={initialData} initialPage={page} initialFilter={filter} />;
}
