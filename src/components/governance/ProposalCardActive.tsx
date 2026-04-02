import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { VoteBar } from "@/components/ui/VoteBar";
import { QuorumBar } from "@/components/ui/QuorumBar";
import { EtherscanLink } from "@/components/ui/EtherscanLink";
import type { GitHubInfo } from "@/lib/types";

interface ProposalCardActiveProps {
  id: string;
  title: string;
  description: string;
  status: Status;
  voteFor: number;
  voteAgainst: number;
  quorumPct: number;
  proposer: string;
  timeRemaining: string;
  githubInfo?: GitHubInfo;
}

export function ProposalCardActive({
  id,
  title,
  description,
  status,
  voteFor,
  voteAgainst,
  quorumPct,
  proposer,
  timeRemaining,
  githubInfo,
}: ProposalCardActiveProps) {
  const hasVotes = voteFor > 0 || voteAgainst > 0;

  return (
    <article
      className="flex flex-col gap-5 p-6 border transition-colors"
      style={{ borderColor: "var(--border-default)" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {id}
          </span>
          {githubInfo && (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {githubInfo.owner}/{githubInfo.repo}
              {githubInfo.type === "pull" && githubInfo.number && (
                <span
                  className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: "var(--status-active-bg)",
                    color: "var(--status-active-text)",
                  }}
                >
                  #{githubInfo.number}
                </span>
              )}
            </span>
          )}
          <h2
            className="text-base font-medium leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Description */}
      <p
        className="text-sm leading-relaxed line-clamp-2"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>

      {/* Vote bar */}
      {hasVotes ? (
        <VoteBar forPct={voteFor} againstPct={voteAgainst} />
      ) : (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <div
            className="flex-1 h-2"
            style={{ backgroundColor: "var(--status-queued-bg)" }}
          />
          <span>{status === "Active" ? "No votes yet" : "Voting not started"}</span>
        </div>
      )}

      {/* Quorum bar */}
      <QuorumBar pct={quorumPct} />

      {/* Meta row */}
      <div
        className="flex items-center justify-between pt-1 border-t text-xs"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-muted)",
        }}
      >
        <span>
          Proposer:{" "}
          <EtherscanLink address={proposer} inline />
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{timeRemaining}</span>
      </div>
    </article>
  );
}
