"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useProposalQuery, useInvalidateProposal } from "@/hooks/useProposalQuery";
import { useInvalidateUserData } from "@/hooks/useInvalidateUserData";
import type { ProposalDetailView } from "@/lib/types";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProposalLifecycle } from "@/components/governance/ProposalLifecycle";
import { VoteBreakdown } from "@/components/governance/VoteBreakdown";
import { AlertBanner } from "@/components/governance/AlertBanner";
import { ActionPanel } from "@/components/governance/ActionPanel";
import { ProposalDetails } from "@/components/governance/ProposalDetails";
import { ProposalActions } from "@/components/governance/ProposalActions";
import { YourVotePanel } from "@/components/governance/YourVotePanel";
import { GitHubReference } from "@/components/governance/GitHubReference";
import { ForumReference } from "@/components/governance/ForumReference";
import { VoteModal } from "@/components/governance/VoteModal";
import { DepositModal } from "@/components/governance/DepositModal";
import { ProposalNotFoundError } from "@/lib/errors";
import { RetryButton } from "@/components/ui/RetryButton";

interface ProposalDetailClientProps {
  id: number;
  initialData?: ProposalDetailView;
}

export function ProposalDetailClient({ id, initialData }: ProposalDetailClientProps) {
  const { data: p, isLoading, isError, error, refetch } =
    useProposalQuery(id, initialData);
  const invalidateProposal = useInvalidateProposal();
  const invalidateUserData = useInvalidateUserData();
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [initialSupport, setInitialSupport] = useState(true);

  const handleVote = useCallback((support: boolean) => {
    setInitialSupport(support);
    setVoteModalOpen(true);
  }, []);

  const handleVoteSuccess = useCallback(() => {
    invalidateProposal(id);
    invalidateUserData();
  }, [invalidateProposal, invalidateUserData, id]);

  const handleDepositSuccess = useCallback(() => {
    invalidateProposal(id);
    invalidateUserData();
  }, [invalidateProposal, invalidateUserData, id]);

  if (isNaN(id) || id < 0) {
    return (
      <div
        className="flex flex-col min-h-screen overflow-x-hidden"
        style={{ backgroundColor: "var(--background-primary)" }}
      >
        <Navbar activeLink="GOVERNANCE" />
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Invalid proposal ID.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex flex-col min-h-screen overflow-x-hidden"
        style={{ backgroundColor: "var(--background-primary)" }}
      >
        <Navbar activeLink="GOVERNANCE" />
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading proposal…
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !p) {
    // A nonexistent id is typed; anything else is transport and gets a retry.
    const notFound = error instanceof ProposalNotFoundError;
    return (
      <div
        className="flex flex-col min-h-screen overflow-x-hidden"
        style={{ backgroundColor: "var(--background-primary)" }}
      >
        <Navbar activeLink="GOVERNANCE" />
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {notFound
              ? "Proposal not found."
              : "Couldn't load this proposal. Check your connection and try again."}
          </p>
          {!notFound && <RetryButton onRetry={refetch} className="mt-4" />}
        </main>
        <Footer />
      </div>
    );
  }

  const discussionUrl = p.discussionUrl;

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "var(--background-primary)" }}
    >
      <Navbar activeLink="GOVERNANCE" />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6">
          <Link
            href="/"
            className="text-xs font-medium tracking-widest uppercase hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            Governance
          </Link>
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            /
          </span>
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            {p.displayId}
          </span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-[24px] md:text-[36px] font-display font-normal leading-tight mb-3 break-words"
            style={{ color: "var(--text-primary)" }}
          >
            {p.displayId}: {p.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <StatusBadge status={p.status} />
            {p.azupMeta?.author && (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Proposed by{" "}
                <span style={{ color: "var(--text-secondary)" }}>
                  {p.azupMeta.author}
                </span>
              </span>
            )}
            <span
              className="text-sm"
              style={{
                color: p.isActive
                  ? "var(--accent-primary)"
                  : "var(--text-muted)",
              }}
            >
              {p.timeRemaining}
            </span>
          </div>
        </div>

        {/* Alert banner */}
        <div className="mb-8">
          <AlertBanner status={p.status} />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left panel */}
          <div className="w-full md:w-[340px] md:shrink-0 flex flex-col gap-5">
            <VoteBreakdown
              title={p.voteTitle}
              yeaPct={p.yeaPct}
              nayPct={p.nayPct}
              yeaVotes={p.yeaVotes}
              nayVotes={p.nayVotes}
              quorumReached={p.quorumReached}
              quorumRatio={p.quorumRatio}
              quorumPct={p.quorumPct}
            />
            <ActionPanel
              status={p.status}
              yeaPct={p.yeaPct}
              nayPct={p.nayPct}
              executedDate={p.executedDate}
              executionTxHash={p.executionTxHash}
              quorumRatio={p.quorumRatio}
              quorumPct={p.quorumPct}
              totalSupply={p.totalSupply}
              onVote={handleVote}
              onDeposit={() => setDepositModalOpen(true)}
            />
            <YourVotePanel proposalId={id} />
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col gap-6">
            <ProposalLifecycle steps={p.lifecycleSteps} />

            {/* Execution actions */}
            {p.actions && p.actions.length > 0 && (
              <ProposalActions actions={p.actions} />
            )}

            {/* Description */}
            {p.description && (
              <div
                className="border p-6"
                style={{ borderColor: "var(--border-default)" }}
              >
                <h3
                  className="text-sm font-medium tracking-widest uppercase mb-5"
                  style={{ color: "var(--text-primary)" }}
                >
                  Description
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {p.description}
                </p>
              </div>
            )}

            {/* GitHub Reference */}
            {p.uri && (
              <GitHubReference
                uri={p.uri}
                description="View the full proposal specification, discussion, and audit reports on GitHub."
                githubInfo={p.githubInfo}
              />
            )}

            {/* Forum Discussion */}
            {discussionUrl && <ForumReference url={discussionUrl} />}

            {/* Proposal Details */}
            <ProposalDetails
              status={p.status}
              author={p.azupMeta?.author}
              payloadAddress={p.payloadAddress}
              discussionUrl={discussionUrl}
              createdDate={p.createdDate}
              votingEndsDate={p.votingEndsDate}
              executedDate={p.executedDate}
              yeaPct={p.yeaPct}
            />
          </div>
        </div>
      </main>

      <Footer />

      <VoteModal
        isOpen={voteModalOpen}
        onClose={() => setVoteModalOpen(false)}
        proposalId={p.numericId}
        initialSupport={initialSupport}
        totalSupply={p.totalSupply}
        canDeposit={p.canDeposit}
        onVoteSuccess={handleVoteSuccess}
      />

      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        totalSupply={p.totalSupply}
        onDepositSuccess={handleDepositSuccess}
      />
    </div>
  );
}
