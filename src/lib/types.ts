import type { Status } from "@/components/ui/StatusBadge";

export interface AzupMeta {
  azupNumber?: number;
  title: string;
  description?: string;
  author?: string;
  discussionsTo?: string;
  azipsIncluded?: string[];
  created?: string;
  abstract?: string;
  sourceUrl: string;
}

export interface GitHubInfo {
  owner: string;
  repo: string;
  type: "pull" | "issue" | "repo" | "commit" | "tree";
  number?: number;
  url: string;
  apiTitle?: string;
  apiState?: string; // "open" | "closed" | "merged"
  apiDescription?: string;
}

export interface ProposalView {
  numericId: number;
  id: string;
  title: string;
  description: string;
  status: Status;
  voteFor: number;
  voteAgainst: number;
  quorumPct: number;
  proposer: string;
  timeRemaining: string;
  summaryText: string;
  isActive: boolean;
  payloadAddress: string;
  githubInfo?: GitHubInfo;
  azupMeta?: AzupMeta;
  lifecycleSteps: LifecycleStep[];
}

export interface ProposalsPageData {
  proposals: ProposalView[];
  totalFiltered: number;
  tabCounts: Record<string, number>;
  totalProposals: number;
  activeCount: number;
  totalPower: string;
}

export interface LifecycleStep {
  label: string;
  date: string;
  state: "completed" | "current" | "upcoming" | "rejected";
  timeRemaining?: string;
}

export interface ProposalDetailView {
  numericId: number;
  displayId: string;
  title: string;
  status: Status;
  proposer: string;
  payloadAddress: string;
  uri?: string;
  description: string;
  githubInfo?: GitHubInfo;
  azupMeta?: AzupMeta;

  // Vote data
  yeaPct: number;
  nayPct: number;
  yeaVotes: string;
  nayVotes: string;
  yeaVoters: number;
  nayVoters: number;
  totalVotesFormatted: string;

  // Quorum
  quorumReached: boolean;
  quorumCurrent: string;
  quorumRequired: string;
  quorumPct: number;

  // Lifecycle
  lifecycleSteps: LifecycleStep[];

  // Time info
  timeRemaining: string;
  createdDate: string;
  votingEndsDate: string;
  executedDate?: string;
  executionTxHash?: string;

  // Vote title varies by state
  voteTitle: string;

  // Terminal state info
  isTerminal: boolean;
  isActive: boolean;

  // Whether deposits still count (true only when Pending — snapshot not yet taken)
  canDeposit: boolean;

  // Total supply for voting power calculation
  totalSupply: string;
}
