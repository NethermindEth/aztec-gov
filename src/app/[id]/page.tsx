import { notFound } from "next/navigation";
import { fetchProposalByIdWithPower } from "@/lib/governance";
import { buildProposalDetailView } from "@/lib/proposal-view";
import { buildKey } from "@/lib/query-keys";
import { cachedFetch } from "@/lib/cache";
import { enrichProposalView } from "@/lib/proposal-enrich";
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

  await enrichProposalView(initialData, initialData.uri);

  return <ProposalDetailClient id={numericId} initialData={initialData} />;
}
