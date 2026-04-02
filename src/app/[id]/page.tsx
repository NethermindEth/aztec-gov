import { notFound } from "next/navigation";
import { fetchProposalByIdWithPower } from "@/lib/governance";
import { buildProposalDetailView } from "@/lib/proposal-view";
import { buildKey } from "@/lib/query-keys";
import { cachedFetch } from "@/lib/cache";
import { fetchGitHubMeta } from "@/lib/github";
import { fetchAzupMeta } from "@/lib/azup";
import { ProposalDetailClient } from "./ProposalDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId < 0) notFound();

  const key = buildKey({ type: "proposal", id: numericId });
  const { proposal, totalPower } = await cachedFetch(
    key,
    () => fetchProposalByIdWithPower(numericId),
    12_000
  );

  if (!proposal) notFound();

  const initialData = buildProposalDetailView(proposal, totalPower, numericId);

  // Enrich with AZUP metadata first, then fall back to GitHub API
  if (initialData.uri) {
    const azupMeta = await fetchAzupMeta(initialData.uri);
    if (azupMeta) {
      initialData.title = azupMeta.title;
      initialData.description = azupMeta.description ?? azupMeta.abstract ?? initialData.description;
      initialData.azupMeta = azupMeta;
    }
  }

  if (!initialData.azupMeta && initialData.githubInfo) {
    const meta = await fetchGitHubMeta(initialData.githubInfo);
    if (meta) {
      if (meta.title) {
        initialData.githubInfo.apiTitle = meta.title;
        initialData.title = meta.title;
        initialData.description = meta.title;
      }
      if (meta.state) initialData.githubInfo.apiState = meta.state;
      if (meta.description) initialData.githubInfo.apiDescription = meta.description;
    }
  }

  return <ProposalDetailClient id={numericId} initialData={initialData} />;
}
