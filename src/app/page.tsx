import { fetchProposalIndex, fetchProposalPage } from "@/lib/governance";
import { buildProposalsPageData, computeFilteredPageIds } from "@/lib/proposal-view";
import { buildKey } from "@/lib/query-keys";
import { cachedFetch } from "@/lib/cache";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { fetchGitHubMeta } from "@/lib/github";
import { fetchAzupMeta } from "@/lib/azup";
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

  // Enrich proposals with AZUP or GitHub API metadata in parallel
  await Promise.all(
    initialData.proposals.map(async (view, i) => {
      // Try AZUP parsing first (for proposals with /AZUPs/*.md URLs)
      const uri = proposals[i]?.uri;
      if (uri) {
        const azupMeta = await fetchAzupMeta(uri);
        if (azupMeta) {
          view.title = azupMeta.title;
          view.description = azupMeta.description ?? azupMeta.abstract ?? view.description;
          view.azupMeta = azupMeta;
          return;
        }
      }

      // Fall back to GitHub API enrichment
      if (!view.githubInfo) return;
      const meta = await fetchGitHubMeta(view.githubInfo);
      if (!meta) return;
      if (meta.title) {
        view.githubInfo.apiTitle = meta.title;
        view.title = meta.title;
      }
      if (meta.state) view.githubInfo.apiState = meta.state;
      if (meta.description) view.githubInfo.apiDescription = meta.description;
    })
  );

  return <GovernanceClient initialData={initialData} initialPage={page} initialFilter={filter} />;
}
