import type { ProposalsPageData, ProposalView } from "@/lib/types";

const activeProposal1: ProposalView = {
  numericId: 12,
  id: "AZT-12",
  title: "Increase Validator Set to 150",
  description:
    "Proposal to expand the active validator set from 100 to 150 nodes to improve network decentralization and throughput capacity.",
  status: "Active",
  voteFor: 67.8,
  voteAgainst: 32.2,
  quorumPct: 68,
  proposer: "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f67890",
  timeRemaining: "2d 14h remaining",
  summaryText: "FOR 67.8% (1.2M AZT) · AGAINST 32.2% (571K AZT)",
  isActive: true,
  payloadAddress: "0xPAYL00000000000000000000000000000000AD01",
  lifecycleSteps: [
    { label: "Pending", date: "Feb 20", state: "completed" },
    { label: "Voting", date: "Feb 22", state: "current" },
    { label: "Queued", date: "--", state: "upcoming" },
    { label: "Executable", date: "--", state: "upcoming" },
  ],
};

const activeProposal2: ProposalView = {
  numericId: 13,
  id: "AZT-13",
  title: "Protocol Fee Redistribution",
  description:
    "Redirect 30% of protocol fees to stakers to incentivize long-term network participation and security.",
  status: "Active",
  voteFor: 82.1,
  voteAgainst: 17.9,
  quorumPct: 82,
  proposer: "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f67890",
  timeRemaining: "5d 8h remaining",
  summaryText: "FOR 82.1% (2.1M AZT) · AGAINST 17.9% (459K AZT)",
  isActive: true,
  payloadAddress: "0xPAYL00000000000000000000000000000000AD02",
  lifecycleSteps: [
    { label: "Pending", date: "Feb 18", state: "completed" },
    { label: "Voting", date: "Feb 20", state: "current" },
    { label: "Queued", date: "--", state: "upcoming" },
    { label: "Executable", date: "--", state: "upcoming" },
  ],
};

const executedProposal1: ProposalView = {
  numericId: 11,
  id: "AZT-11",
  title: "Treasury Diversification Strategy",
  description:
    "Establish a treasury diversification strategy to ensure long-term financial sustainability.",
  status: "Executed",
  voteFor: 89.2,
  voteAgainst: 10.8,
  quorumPct: 92,
  proposer: "0xB2c3D4e5F6a7B2c3D4e5F6a7B2c3D4e5F6a78901",
  timeRemaining: "Passed · 89.2% For · Jan 15, 2026",
  summaryText: "Passed · 89.2% For · Jan 15, 2026",
  isActive: false,
  payloadAddress: "0xPAYL00000000000000000000000000000000AD03",
  lifecycleSteps: [
    { label: "Pending", date: "Jan 5", state: "completed" },
    { label: "Voting", date: "Jan 7", state: "completed" },
    { label: "Queued", date: "Jan 12", state: "completed" },
    { label: "Executed", date: "Jan 15", state: "completed" },
  ],
};

const executedProposal2: ProposalView = {
  numericId: 10,
  id: "AZT-10",
  title: "Governance Quorum Reduction",
  description:
    "Reduce the governance quorum requirement to improve proposal throughput.",
  status: "Executed",
  voteFor: 76.4,
  voteAgainst: 23.6,
  quorumPct: 88,
  proposer: "0xB2c3D4e5F6a7B2c3D4e5F6a7B2c3D4e5F6a78901",
  timeRemaining: "Passed · 76.4% For · Dec 28, 2025",
  summaryText: "Passed · 76.4% For · Dec 28, 2025",
  isActive: false,
  payloadAddress: "0xPAYL00000000000000000000000000000000AD04",
  lifecycleSteps: [
    { label: "Pending", date: "Dec 18", state: "completed" },
    { label: "Voting", date: "Dec 20", state: "completed" },
    { label: "Queued", date: "Dec 25", state: "completed" },
    { label: "Executed", date: "Dec 28", state: "completed" },
  ],
};

const rejectedProposal: ProposalView = {
  numericId: 9,
  id: "AZT-09",
  title: "Reduce Block Time to 8 Seconds",
  description:
    "Reduce the block time from 12 seconds to 8 seconds to improve transaction finality.",
  status: "Rejected",
  voteFor: 38.1,
  voteAgainst: 61.9,
  quorumPct: 36.2,
  proposer: "0xC3d4E5f6A7b8C3d4E5f6A7b8C3d4E5f6A7b89012",
  timeRemaining: "Failed · 38.1% For · Dec 22, 2025",
  summaryText: "Failed · 38.1% For · Dec 22, 2025",
  isActive: false,
  payloadAddress: "0x2d3E00000000000000000000000000000000008f0A",
  lifecycleSteps: [
    { label: "Pending", date: "Dec 15", state: "completed" },
    { label: "Voting", date: "Dec 17", state: "completed" },
    { label: "Rejected", date: "Dec 22", state: "rejected" },
    { label: "--", date: "--", state: "upcoming" },
  ],
};

const expiredProposal: ProposalView = {
  numericId: 8,
  id: "AZT-08",
  title: "Sequencer Bond Increase",
  description:
    "Increase the sequencer bond requirement from 10,000 AZT to 25,000 AZT.",
  status: "Expired",
  voteFor: 62.3,
  voteAgainst: 37.7,
  quorumPct: 20,
  proposer: "0xD4e5F6a7B8c9D4e5F6a7B8c9D4e5F6a7B8c90123",
  timeRemaining: "Expired · No quorum · Nov 30, 2025",
  summaryText: "Expired · No quorum · Nov 30, 2025",
  isActive: false,
  payloadAddress: "0x6f7A00000000000000000000000000000000002b3C",
  lifecycleSteps: [
    { label: "Pending", date: "Nov 20", state: "completed" },
    { label: "Voting", date: "Nov 23", state: "upcoming" },
    { label: "Expired", date: "Nov 30", state: "upcoming" },
    { label: "--", date: "--", state: "upcoming" },
  ],
};

export const mockProposals: ProposalView[] = [
  activeProposal1,
  activeProposal2,
  executedProposal1,
  executedProposal2,
  rejectedProposal,
  expiredProposal,
];

export const mockProposalsPageData: ProposalsPageData = {
  proposals: mockProposals,
  totalFiltered: 47,
  tabCounts: {
    All: 47,
    Active: 3,
    Pending: 1,
    Queued: 2,
    Executed: 35,
    Rejected: 6,
    Expired: 0,
  },
  totalProposals: 47,
  activeCount: 3,
  totalPower: "17800000000000000000000000", // 17.8M AZT (18 decimals)
};
