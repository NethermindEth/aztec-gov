"use client";

import { useState, useCallback } from "react";
import type { ProposalView } from "@/lib/types";
import { useInvalidateProposal } from "@/hooks/useProposalQuery";
import { ProposalRowCompact } from "@/components/governance/ProposalRowCompact";
import { ProposalExpandedContent } from "@/components/governance/ProposalExpandedContent";
import { VoteModal } from "@/components/governance/VoteModal";
import { DepositModal } from "@/components/governance/DepositModal";

interface ExpandableProposalRowProps {
  proposal: ProposalView;
  isExpanded: boolean;
  onToggle: () => void;
  totalSupply: string;
}

export function ExpandableProposalRow({
  proposal,
  isExpanded,
  onToggle,
  totalSupply,
}: ExpandableProposalRowProps) {
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [initialSupport, setInitialSupport] = useState(true);
  const invalidateProposal = useInvalidateProposal();

  const handleVote = useCallback((support: boolean) => {
    setInitialSupport(support);
    setVoteModalOpen(true);
  }, []);

  const handleVoteSuccess = useCallback(() => {
    invalidateProposal(proposal.numericId);
  }, [invalidateProposal, proposal.numericId]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        style={{ backgroundColor: "var(--background-primary)" }}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <ProposalRowCompact
          id={proposal.id}
          title={proposal.title}
          status={proposal.status}
          summaryText={proposal.summaryText}
          githubInfo={proposal.githubInfo}
          chevron={isExpanded ? "up" : "down"}
        />

        {/* Expandable content */}
        <div className="expand-grid" data-expanded={isExpanded ? "true" : "false"}>
          <div className="expand-inner">
            <ProposalExpandedContent proposal={proposal} onVote={handleVote} onDeposit={() => setDepositModalOpen(true)} />
          </div>
        </div>
      </div>

      <VoteModal
        isOpen={voteModalOpen}
        onClose={() => setVoteModalOpen(false)}
        proposalId={proposal.numericId}
        initialSupport={initialSupport}
        totalSupply={totalSupply}
        canDeposit={proposal.status === "Pending"}
        onVoteSuccess={handleVoteSuccess}
      />

      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        totalSupply={totalSupply}
      />
    </>
  );
}
