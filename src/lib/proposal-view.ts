import type { Proposal, ProposalIndex } from "./governance";
import {
  ProposalState,
  getYeaPercentage,
  getNayPercentage,
  getTotalVotes,
  getActiveThrough,
  getPendingThrough,
  isTerminalState,
} from "./governance";
import {
  mapStateToStatus,
  formatTimeRemaining,
  formatVotes,
  formatVotesWithUnit,
  formatDateFull,
  formatDate,
  getSummaryText,
} from "./format";
import type { ProposalDetailView, LifecycleStep, ProposalView, ProposalsPageData, GitHubInfo, ProposalEnrichment } from "./types";
import { parseGitHubUrl, formatGitHubTitle } from "./github";
import { getForumUrl } from "./forum";

interface BaseMeta {
  githubInfo?: GitHubInfo;
  title: string;
  discussionUrl?: string;
}

// Network-free metadata shared by both builders. fetchProposalEnrichment
// upgrades title/description/discussionUrl server-side; these are the
// offline fallbacks.
function buildBaseMeta(proposal: Proposal): BaseMeta {
  const parsed = proposal.uri ? parseGitHubUrl(proposal.uri) : null;
  const githubInfo: GitHubInfo | undefined = parsed
    ? { owner: parsed.owner, repo: parsed.repo, type: parsed.type, number: parsed.number, url: parsed.url }
    : undefined;
  const title = parsed ? formatGitHubTitle(parsed) : `Proposal #${proposal.id}`;
  return { githubInfo, title, discussionUrl: getForumUrl(Number(proposal.id)) };
}

// Projects server-fetched enrichment onto a view (mutates in place). The one
// place that knows the enrichment-to-view field mapping; the client hook
// reuses it to carry enrichment across refetches.
export function applyEnrichment(
  view: ProposalView | ProposalDetailView,
  enrichment: ProposalEnrichment
): void {
  if (enrichment.title) view.title = enrichment.title;
  if (enrichment.description) view.description = enrichment.description;
  if (enrichment.discussionUrl) view.discussionUrl = enrichment.discussionUrl;
  if (enrichment.azupMeta) view.azupMeta = enrichment.azupMeta;
  if (enrichment.githubApi && view.githubInfo) {
    Object.assign(view.githubInfo, enrichment.githubApi);
  }
  view.enrichment = enrichment;
}

// ─── Lifecycle Steps ──────────────────────────────────────────────────────────

export function computeLifecycleSteps(
  state: ProposalState,
  creationTimestamp: bigint,
  config: {
    votingDelay: bigint;
    votingDuration: bigint;
    executionDelay: bigint;
  }
): LifecycleStep[] {
  const pendingEnd = creationTimestamp + config.votingDelay;
  const votingEnd = pendingEnd + config.votingDuration;
  const queueEnd = votingEnd + config.executionDelay;

  const pendingDate = formatDate(creationTimestamp);
  const votingDate = formatDate(pendingEnd);
  const queueDate = formatDate(votingEnd);
  const execDate = formatDate(queueEnd);

  // Compute countdown for the current phase's end
  const remaining = (endTimestamp: bigint) => formatTimeRemaining(endTimestamp);

  if (state === ProposalState.Executed) {
    return [
      { label: "Pending", date: pendingDate, state: "completed" },
      { label: "Voting", date: votingDate, state: "completed" },
      { label: "Queued", date: queueDate, state: "completed" },
      { label: "Executed", date: execDate, state: "completed" },
    ];
  }

  if (
    state === ProposalState.Rejected ||
    state === ProposalState.Dropped
  ) {
    return [
      { label: "Pending", date: pendingDate, state: "completed" },
      { label: "Voting", date: votingDate, state: "completed" },
      { label: "Rejected", date: queueDate, state: "rejected" },
      { label: "--", date: "--", state: "upcoming" },
    ];
  }

  if (state === ProposalState.Expired) {
    return [
      { label: "Pending", date: pendingDate, state: "completed" },
      { label: "Voting", date: votingDate, state: "upcoming" },
      { label: "Expired", date: queueDate, state: "upcoming" },
      { label: "--", date: "--", state: "upcoming" },
    ];
  }

  if (state === ProposalState.Pending) {
    return [
      { label: "Pending", date: pendingDate, state: "current", timeRemaining: remaining(pendingEnd) },
      { label: "Voting", date: votingDate, state: "upcoming" },
      { label: "Queued", date: queueDate, state: "upcoming" },
      { label: "Executable", date: execDate, state: "upcoming" },
    ];
  }

  if (state === ProposalState.Active) {
    return [
      { label: "Pending", date: pendingDate, state: "completed" },
      { label: "Voting", date: votingDate, state: "current", timeRemaining: remaining(votingEnd) },
      { label: "Queued", date: queueDate, state: "upcoming" },
      { label: "Executable", date: execDate, state: "upcoming" },
    ];
  }

  if (
    state === ProposalState.Queued ||
    state === ProposalState.Executable ||
    state === ProposalState.Droppable
  ) {
    return [
      { label: "Pending", date: pendingDate, state: "completed" },
      { label: "Voting", date: votingDate, state: "completed" },
      { label: "Queued", date: queueDate, state: "current", timeRemaining: remaining(queueEnd) },
      { label: "Executable", date: execDate, state: "upcoming" },
    ];
  }

  return [
    { label: "Pending", date: pendingDate, state: "upcoming" },
    { label: "Voting", date: votingDate, state: "upcoming" },
    { label: "Queued", date: queueDate, state: "upcoming" },
    { label: "Executable", date: execDate, state: "upcoming" },
  ];
}

// ─── Shared time-remaining logic ──────────────────────────────────────────────

function computeTimeRemaining(proposal: Proposal): string {
  if (proposal.state === ProposalState.Active) {
    return formatTimeRemaining(
      getActiveThrough(proposal.creationTimestamp, proposal.config)
    );
  }
  if (proposal.state === ProposalState.Pending) {
    const votingStart = getPendingThrough(
      proposal.creationTimestamp,
      proposal.config
    );
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const diff = votingStart - nowSec;
    if (diff > 0n) {
      const days = Math.floor(Number(diff) / 86400);
      const hours = Math.floor((Number(diff) % 86400) / 3600);
      return days > 0
        ? `Starts in ${days}d ${hours}h`
        : `Starts in ${hours}h`;
    }
  }
  if (isTerminalState(proposal.state)) {
    const dateStr = formatDate(proposal.creationTimestamp);
    if (proposal.state === ProposalState.Executed)
      return `Executed ${dateStr}`;
    if (
      proposal.state === ProposalState.Rejected ||
      proposal.state === ProposalState.Dropped
    )
      return `Rejected ${dateStr}`;
    if (proposal.state === ProposalState.Expired)
      return `Expired ${dateStr}`;
  }
  return "";
}

// ─── Detail View Model ────────────────────────────────────────────────────────

export function buildProposalDetailView(
  proposal: Proposal,
  totalPower: bigint,
  numericId: number
): ProposalDetailView {
  const status = mapStateToStatus(proposal.state);
  const yeaPct = getYeaPercentage(proposal.ballot);
  const nayPct = getNayPercentage(proposal.ballot);
  const totalVotes = getTotalVotes(proposal.ballot);
  const isActive =
    proposal.state === ProposalState.Active ||
    proposal.state === ProposalState.Pending;

  // Quorum
  let quorumPct = 0;
  let quorumRequired = 0n;
  if (totalPower > 0n && proposal.config.quorum > 0n) {
    quorumRequired = (totalPower * proposal.config.quorum) / BigInt(1e18);
    if (quorumRequired > 0n) {
      quorumPct = Math.min(
        100,
        Number((totalVotes * 10000n) / quorumRequired) / 100
      );
    }
  }
  const quorumReached = quorumPct >= 100;

  const timeRemaining = computeTimeRemaining(proposal);

  // Vote title
  let voteTitle = "Current Votes";
  if (proposal.state === ProposalState.Executed) voteTitle = "Final Results";
  if (
    proposal.state === ProposalState.Rejected ||
    proposal.state === ProposalState.Dropped
  )
    voteTitle = "Final Results";
  if (proposal.state === ProposalState.Expired)
    voteTitle = "Voting Snapshot";

  const lifecycleSteps = computeLifecycleSteps(
    proposal.state,
    proposal.creationTimestamp,
    proposal.config
  );

  const votingEnd = getActiveThrough(
    proposal.creationTimestamp,
    proposal.config
  );

  const { githubInfo, title, discussionUrl } = buildBaseMeta(proposal);

  return {
    numericId,
    displayId: `AZT-${String(proposal.id).padStart(2, "0")}`,
    title,
    status,
    proposer: proposal.proposerAddress,
    payloadAddress: proposal.payloadAddress,
    uri: proposal.uri,
    description: "",
    githubInfo,
    discussionUrl,
    yeaPct,
    nayPct,
    yeaVotes: formatVotesWithUnit(proposal.ballot.yea),
    nayVotes: formatVotesWithUnit(proposal.ballot.nay),
    yeaVoters: 0,
    nayVoters: 0,
    quorumReached,
    quorumRatio: `${formatVotes(totalVotes)} / ${formatVotes(quorumRequired)} AZT`,
    quorumPct,
    lifecycleSteps,
    timeRemaining,
    createdDate: formatDateFull(proposal.creationTimestamp),
    votingEndsDate: formatDateFull(votingEnd),
    executedDate: undefined,
    executionTxHash: proposal.executionTxHash,
    voteTitle,
    isTerminal: isTerminalState(proposal.state),
    isActive,
    canDeposit: proposal.state === ProposalState.Pending,
    totalSupply: totalPower.toString(),
  };
}

// ─── Listing View Model ───────────────────────────────────────────────────────

export function buildProposalView(
  proposal: Proposal,
  totalPower: bigint
): ProposalView {
  const status = mapStateToStatus(proposal.state);
  const yeaPct = getYeaPercentage(proposal.ballot);
  const nayPct = getNayPercentage(proposal.ballot);
  const totalVotes = getTotalVotes(proposal.ballot);
  const isActive =
    proposal.state === ProposalState.Active ||
    proposal.state === ProposalState.Pending;

  // Quorum
  let quorumPct = 0;
  if (totalPower > 0n && proposal.config.quorum > 0n) {
    const quorumRequired =
      (totalPower * proposal.config.quorum) / BigInt(1e18);
    if (quorumRequired > 0n) {
      quorumPct = Math.min(
        100,
        Number((totalVotes * 10000n) / quorumRequired) / 100
      );
    }
  }

  const timeRemaining = computeTimeRemaining(proposal);
  const { githubInfo, title, discussionUrl } = buildBaseMeta(proposal);

  const lifecycleSteps = computeLifecycleSteps(
    proposal.state,
    proposal.creationTimestamp,
    proposal.config
  );

  return {
    numericId: Number(proposal.id),
    id: `AZT-${String(proposal.id).padStart(2, "0")}`,
    title,
    description: "",
    payloadAddress: proposal.payloadAddress,
    githubInfo,
    discussionUrl,
    status,
    voteFor: yeaPct,
    voteAgainst: nayPct,
    quorumPct,
    proposer: proposal.proposerAddress,
    timeRemaining,
    summaryText: getSummaryText(
      proposal.state,
      yeaPct,
      proposal.creationTimestamp
    ),
    isActive: isActive && !isTerminalState(proposal.state),
    lifecycleSteps,
  };
}

// ─── Filtered Page IDs ──────────────────────────────────────────────────────

export function computeFilteredPageIds(
  states: ProposalState[],
  filter: string | undefined,
  page: number,
  pageSize: number
): number[] {
  const ids: number[] = [];
  // Reverse order (newest first)
  for (let i = states.length - 1; i >= 0; i--) {
    if (!filter || filter === "All") {
      ids.push(i);
    } else {
      const status = mapStateToStatus(states[i]);
      if (status === filter) {
        ids.push(i);
      }
    }
  }
  const start = (page - 1) * pageSize;
  return ids.slice(start, start + pageSize);
}

// ─── Page Data Builder ──────────────────────────────────────────────────────

export function buildProposalsPageData(
  index: ProposalIndex,
  pageProposals: Proposal[],
  totalPower: bigint,
  filter?: string
): ProposalsPageData {
  const views = pageProposals.map((p) => buildProposalView(p, totalPower));

  // Compute tab counts from all states in the index
  const tabCounts: Record<string, number> = { All: index.totalCount };
  for (const state of index.states) {
    const status = mapStateToStatus(state);
    tabCounts[status] = (tabCounts[status] || 0) + 1;
  }

  const activeCount = index.states.filter(
    (s) => s === ProposalState.Active
  ).length;

  let totalFiltered = index.totalCount;
  if (filter && filter !== "All") {
    totalFiltered = tabCounts[filter] || 0;
  }

  return {
    proposals: views,
    totalFiltered,
    tabCounts,
    totalProposals: index.totalCount,
    activeCount,
    totalPower: totalPower.toString(),
  };
}
