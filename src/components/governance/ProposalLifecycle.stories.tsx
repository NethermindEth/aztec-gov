import type { Meta, StoryObj } from "@storybook/react";
import { ProposalLifecycle } from "./ProposalLifecycle";

const meta: Meta<typeof ProposalLifecycle> = {
  title: "Governance/ProposalLifecycle",
  component: ProposalLifecycle,
};

export default meta;
type Story = StoryObj<typeof ProposalLifecycle>;

export const Pending: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "current" },
      { label: "Voting", date: "Feb 22", state: "upcoming" },
      { label: "Queued", date: "--", state: "upcoming" },
      { label: "Executable", date: "--", state: "upcoming" },
    ],
  },
};

export const Active: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "completed" },
      { label: "Voting", date: "Feb 22", state: "current" },
      { label: "Queued", date: "--", state: "upcoming" },
      { label: "Executable", date: "--", state: "upcoming" },
    ],
  },
};

export const Queued: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "completed" },
      { label: "Voting", date: "Feb 22", state: "completed" },
      { label: "Queued", date: "Mar 01", state: "current" },
      { label: "Executable", date: "Mar 08", state: "upcoming" },
    ],
  },
};

export const Executed: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "completed" },
      { label: "Voting", date: "Feb 22", state: "completed" },
      { label: "Queued", date: "Mar 01", state: "completed" },
      { label: "Executed", date: "Mar 08", state: "completed" },
    ],
  },
};

export const Rejected: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "completed" },
      { label: "Voting", date: "Feb 22", state: "completed" },
      { label: "Rejected", date: "Mar 01", state: "rejected" },
      { label: "--", date: "--", state: "upcoming" },
    ],
  },
};

export const Expired: Story = {
  args: {
    steps: [
      { label: "Pending", date: "Feb 20", state: "completed" },
      { label: "Voting", date: "Feb 22", state: "upcoming" },
      { label: "Expired", date: "Mar 01", state: "upcoming" },
      { label: "--", date: "--", state: "upcoming" },
    ],
  },
};
