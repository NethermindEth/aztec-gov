import type { Meta, StoryObj } from "@storybook/react";
import { AlertBanner } from "./AlertBanner";

const meta: Meta<typeof AlertBanner> = {
  title: "Governance/AlertBanner",
  component: AlertBanner,
};

export default meta;
type Story = StoryObj<typeof AlertBanner>;

export const Executed: Story = {
  args: { status: "Executed" },
};

export const Rejected: Story = {
  args: { status: "Rejected" },
};

export const Expired: Story = {
  args: { status: "Expired" },
};

export const Active: Story = {
  args: { status: "Active" },
};

export const Pending: Story = {
  args: { status: "Pending" },
};
