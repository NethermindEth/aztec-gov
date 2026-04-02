import type { Meta, StoryObj } from "@storybook/react";
import { ProposalDetailClient } from "./ProposalDetailClient";
import type { ProposalDetailView } from "@/lib/types";
import { connectedWalletDecorator } from "@/test/storybook-decorators";

const meta: Meta<typeof ProposalDetailClient> = {
  title: "Pages/Proposal Detail",
  component: ProposalDetailClient,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ProposalDetailClient>;

const activeProposal: ProposalDetailView = {
  numericId: 12,
  displayId: "AZT-12",
  title: "Increase Validator Set to 150",
  status: "Active",
  proposer: "0xA1b2C3d4E5f6A1b2C3d4E5f6A1b2C3d4E5f67890",
  payloadAddress: "0xPAYL00000000000000000000000000000000AD01",
  uri: "https://github.com/AztecProtocol/governance-proposals/blob/main/proposals/AZT-012.md",
  description:
    "This proposal seeks to increase the active validator set from 100 to 150 nodes. The expansion will improve network decentralization, geographic distribution, and overall throughput capacity.",
  yeaPct: 67.8,
  nayPct: 32.2,
  yeaVotes: "1,206,340 AZT (142 voters)",
  nayVotes: "571,890 AZT (89 voters)",
  yeaVoters: 142,
  nayVoters: 89,
  totalVotesFormatted: "1,778,230 AZT",
  quorumReached: true,
  quorumCurrent: "1.77M",
  quorumRequired: "2.5M",
  quorumPct: 70.8,
  lifecycleSteps: [
    { label: "Pending", date: "Feb 20", state: "completed" },
    { label: "Voting", date: "Feb 22", state: "current" },
    { label: "Queued", date: "--", state: "upcoming" },
    { label: "Executable", date: "--", state: "upcoming" },
  ],
  timeRemaining: "2d 14h remaining",
  createdDate: "Feb 20, 2026 14:30 UTC",
  votingEndsDate: "Feb 28, 2026 14:30 UTC",
  voteTitle: "Current Votes",
  isTerminal: false,
  isActive: true,
  canDeposit: false,
  totalSupply: "10000000000000000000000000",
};

const executedProposal: ProposalDetailView = {
  numericId: 11,
  displayId: "AZT-11",
  title: "Treasury Diversification Strategy",
  status: "Executed",
  proposer: "0xB2c3D4e5F6a7B2c3D4e5F6a7B2c3D4e5F6a78901",
  payloadAddress: "0xPAYL00000000000000000000000000000000AD02",
  executionTxHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  uri: "https://github.com/AztecProtocol/governance-proposals/blob/main/proposals/AZT-011.md",
  description:
    "This proposal establishes a treasury diversification strategy to ensure long-term financial sustainability of the Aztec protocol. The strategy allocates 20% of treasury reserves into stable assets.",
  yeaPct: 89.2,
  nayPct: 10.8,
  yeaVotes: "1,589,560 AZT (198 voters)",
  nayVotes: "192,440 AZT (31 voters)",
  yeaVoters: 198,
  nayVoters: 31,
  totalVotesFormatted: "1,782,000 AZT",
  quorumReached: true,
  quorumCurrent: "1.78M",
  quorumRequired: "2.5M",
  quorumPct: 71.2,
  lifecycleSteps: [
    { label: "Pending", date: "Jan 5", state: "completed" },
    { label: "Voting", date: "Jan 7", state: "completed" },
    { label: "Queued", date: "Jan 12", state: "completed" },
    { label: "Executed", date: "Jan 15", state: "completed" },
  ],
  timeRemaining: "Executed Jan 15, 2026",
  createdDate: "Jan 5, 2026 10:00 UTC",
  votingEndsDate: "Jan 12, 2026 10:00 UTC",
  executedDate: "Jan 15, 2026 18:42 UTC",
  voteTitle: "Final Results",
  isTerminal: true,
  isActive: false,
  canDeposit: false,
  totalSupply: "10000000000000000000000000",
};

const rejectedProposal: ProposalDetailView = {
  numericId: 9,
  displayId: "AZT-09",
  title: "Reduce Block Time to 8 Seconds",
  status: "Rejected",
  proposer: "0xC3d4E5f6A7b8C3d4E5f6A7b8C3d4E5f6A7b89012",
  payloadAddress: "0x2d3E00000000000000000000000000000000008f0A",
  uri: "https://github.com/AztecProtocol/governance-proposals/blob/main/proposals/AZT-009.md",
  description:
    "This proposal aimed to reduce the block time from 12 seconds to 8 seconds to improve transaction finality and user experience across the network.",
  yeaPct: 38.1,
  nayPct: 61.9,
  yeaVotes: "678,230 AZT (67 voters)",
  nayVotes: "1,101,770 AZT (112 voters)",
  yeaVoters: 67,
  nayVoters: 112,
  totalVotesFormatted: "1,780,000 AZT",
  quorumReached: false,
  quorumCurrent: "1.78M",
  quorumRequired: "2.5M",
  quorumPct: 36.2,
  lifecycleSteps: [
    { label: "Pending", date: "Dec 15", state: "completed" },
    { label: "Voting", date: "Dec 17", state: "completed" },
    { label: "Rejected", date: "Dec 22", state: "rejected" },
    { label: "--", date: "--", state: "upcoming" },
  ],
  timeRemaining: "Rejected Dec 22, 2025",
  createdDate: "Dec 15, 2025 09:00 UTC",
  votingEndsDate: "Dec 22, 2025 09:00 UTC",
  voteTitle: "Final Results",
  isTerminal: true,
  isActive: false,
  canDeposit: false,
  totalSupply: "10000000000000000000000000",
};

const expiredProposal: ProposalDetailView = {
  numericId: 8,
  displayId: "AZT-08",
  title: "Sequencer Bond Increase",
  status: "Expired",
  proposer: "0xD4e5F6a7B8c9D4e5F6a7B8c9D4e5F6a7B8c90123",
  payloadAddress: "0x6f7A00000000000000000000000000000000002b3C",
  uri: "https://github.com/AztecProtocol/governance-proposals/blob/main/proposals/AZT-008.md",
  description:
    "This proposal sought to increase the sequencer bond requirement from 10,000 AZT to 25,000 AZT to improve sequencer reliability and commitment to the network.",
  yeaPct: 62.3,
  nayPct: 37.7,
  yeaVotes: "312,000 AZT (18 voters)",
  nayVotes: "189,000 AZT (9 voters)",
  yeaVoters: 18,
  nayVoters: 9,
  totalVotesFormatted: "501,000 AZT",
  quorumReached: false,
  quorumCurrent: "501K",
  quorumRequired: "2.5M",
  quorumPct: 20.0,
  lifecycleSteps: [
    { label: "Pending", date: "Nov 20", state: "completed" },
    { label: "Voting", date: "Nov 23", state: "upcoming" },
    { label: "Expired", date: "Nov 30", state: "upcoming" },
    { label: "--", date: "--", state: "upcoming" },
  ],
  timeRemaining: "Expired Nov 30, 2025",
  createdDate: "Nov 20, 2025 12:00 UTC",
  votingEndsDate: "Nov 30, 2025 12:00 UTC",
  voteTitle: "Voting Snapshot",
  isTerminal: true,
  isActive: false,
  canDeposit: false,
  totalSupply: "10000000000000000000000000",
};

export const Active: Story = {
  args: { id: 12, initialData: activeProposal },
};

export const Executed: Story = {
  args: { id: 11, initialData: executedProposal },
};

export const Rejected: Story = {
  args: { id: 9, initialData: rejectedProposal },
};

export const Expired: Story = {
  args: { id: 8, initialData: expiredProposal },
};

export const ConnectedActive: Story = {
  decorators: [connectedWalletDecorator],
  args: { id: 12, initialData: activeProposal },
};
