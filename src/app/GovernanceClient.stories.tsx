import type { Meta, StoryObj } from "@storybook/react";
import { GovernanceClient } from "./GovernanceClient";
import { mockProposalsPageData } from "@/test/mock-proposals";
import { connectedWalletDecorator } from "@/test/storybook-decorators";

const meta: Meta<typeof GovernanceClient> = {
  title: "Pages/Governance List",
  component: GovernanceClient,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof GovernanceClient>;

export const Disconnected: Story = {
  args: {
    initialData: mockProposalsPageData,
    initialPage: 1,
    initialFilter: "All",
  },
};

export const Connected: Story = {
  decorators: [connectedWalletDecorator],
  args: {
    initialData: mockProposalsPageData,
    initialPage: 1,
    initialFilter: "All",
  },
};
