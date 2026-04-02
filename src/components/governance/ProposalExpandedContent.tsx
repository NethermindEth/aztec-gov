import Link from "next/link";
import { VoteBar } from "@/components/ui/VoteBar";
import { QuorumBar } from "@/components/ui/QuorumBar";
import { EtherscanLink } from "@/components/ui/EtherscanLink";
import { useWallet } from "@/hooks/useWallet";
import { getForumUrl } from "@/lib/forum";
import { ProposalLifecycle } from "@/components/governance/ProposalLifecycle";
import type { ProposalView } from "@/lib/types";

interface ProposalExpandedContentProps {
  proposal: ProposalView;
  onVote?: (support: boolean) => void;
  onDeposit?: () => void;
}

export function ProposalExpandedContent({ proposal, onVote, onDeposit }: ProposalExpandedContentProps) {
  const hasVotes = proposal.voteFor > 0 || proposal.voteAgainst > 0;
  const isActive = proposal.status === "Active";
  const isPending = proposal.status === "Pending";
  const { isConnected, connect } = useWallet();
  const forumUrl = proposal.azupMeta?.discussionsTo?.replace(/^https?:\/\//, "") ?? getForumUrl(proposal.numericId);

  // description is "Payload: 0x..." fallback — not useful as a snippet
  const hasRealDescription =
    proposal.description && !proposal.description.startsWith("Payload:");

  // GitHub API title is the actual PR/issue name — more useful than the parsed URL slug
  const githubTitle = proposal.githubInfo?.apiTitle;

  return (
    <div
      className="flex flex-col gap-4 px-4 md:px-6 pb-5 pt-2"
      style={{ backgroundColor: "var(--background-primary)" }}
    >
      {/* Top: two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Left column (~50%): text info */}
        <div className="flex flex-col gap-3 w-full md:w-[50%] md:shrink-0 min-w-0">
          {/* Description: real description or GitHub PR title */}
          {(hasRealDescription || githubTitle) && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {hasRealDescription ? proposal.description : githubTitle}
            </p>
          )}

          {/* Links + meta */}
          <div className="flex flex-col gap-2">
            {proposal.githubInfo && (
              <a
                href={proposal.githubInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-w-0 hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {proposal.githubInfo.owner}/{proposal.githubInfo.repo}
                  {proposal.githubInfo.number ? ` #${proposal.githubInfo.number}` : ""}
                </span>
                {proposal.githubInfo.apiState && (
                  <span
                    className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                    style={{
                      backgroundColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {proposal.githubInfo.apiState}
                  </span>
                )}
              </a>
            )}

            {forumUrl && (
              <a
                href={`https://${forumUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Forum Discussion
                </span>
              </a>
            )}

            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Payload:{" "}
              <EtherscanLink address={proposal.payloadAddress} inline />
            </span>

            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Proposer:{" "}
              <EtherscanLink address={proposal.proposer} inline />
            </span>
          </div>
        </div>

        {/* Right column (~70%): lifecycle + vote bars */}
        <div className="flex flex-col gap-4 flex-1 justify-center min-w-0">
          <ProposalLifecycle steps={proposal.lifecycleSteps} variant="compact" />
          <div className="flex flex-col gap-3">
            {hasVotes ? (
              <VoteBar forPct={proposal.voteFor} againstPct={proposal.voteAgainst} />
            ) : (
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <div
                  className="flex-1 h-2"
                  style={{ backgroundColor: "var(--status-queued-bg)" }}
                />
                <span>{isActive ? "No votes yet" : "Voting not started"}</span>
              </div>
            )}
            <QuorumBar pct={proposal.quorumPct} />
          </div>
        </div>
      </div>

      {/* Bottom: full-width action row */}
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {isActive && (
            isConnected ? (
              <button
                onClick={() => onVote?.(true)}
                className="px-5 py-2 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--background-primary)",
                }}
              >
                Vote
              </button>
            ) : (
              <button
                onClick={connect}
                className="px-5 py-2 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--background-primary)",
                }}
              >
                Connect to Vote
              </button>
            )
          )}
          {isPending && (
            isConnected ? (
              <button
                onClick={() => onDeposit?.()}
                className="px-5 py-2 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--background-primary)",
                }}
              >
                Deposit AZT
              </button>
            ) : (
              <button
                onClick={connect}
                className="px-5 py-2 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--background-primary)",
                }}
              >
                Connect Wallet
              </button>
            )
          )}
        </div>
        <Link
          href={`/${proposal.numericId}`}
          className="px-5 py-2 text-xs font-semibold tracking-wider uppercase border hover:opacity-80"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
}
