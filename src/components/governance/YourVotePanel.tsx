"use client";

import { useWallet } from "@/hooks/useWallet";
import { useUserVote } from "@/hooks/useUserVote";
import { formatVotesWithUnit } from "@/lib/format";

interface YourVotePanelProps {
  proposalId: number;
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border-default)" }}>
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// Shows the connected wallet's own vote on this proposal, once cast. Direct
// and staker votes carry a direction; delegated power spent via the GSE
// doesn't, so it's listed on its own.
export function YourVotePanel({ proposalId }: YourVotePanelProps) {
  const { isConnected, address } = useWallet();
  const vote = useUserVote(proposalId, isConnected ? address : undefined);

  if (!isConnected || vote.isLoading || !vote.hasVoted) return null;

  return (
    <div className="border" style={{ borderColor: "var(--border-default)" }}>
      <h3
        className="text-sm font-medium tracking-widest uppercase px-6 py-4 border-b"
        style={{ color: "var(--text-primary)", borderColor: "var(--border-default)" }}
      >
        Your Vote
      </h3>
      <div className="flex flex-col">
        {vote.forVotes > 0n && (
          <Row label="For" value={formatVotesWithUnit(vote.forVotes)} color="var(--accent-primary)" />
        )}
        {vote.againstVotes > 0n && (
          <Row label="Against" value={formatVotesWithUnit(vote.againstVotes)} color="var(--accent-secondary)" />
        )}
        {vote.delegatedUsed > 0n && (
          <Row label="Via delegated power" value={formatVotesWithUnit(vote.delegatedUsed)} color="var(--text-primary)" />
        )}
      </div>
    </div>
  );
}
