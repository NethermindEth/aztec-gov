import type { Status } from "@/components/ui/StatusBadge";
import type { ReactNode } from "react";

interface AlertBannerProps {
  status: Status;
}

const ExecutedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#d4ff28" />
    <path
      d="M7 12.5l3.5 3.5 6.5-7"
      stroke="#1a1a18"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RejectedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#ff2df4" />
    <path
      d="M8 8l8 8M16 8l-8 8"
      stroke="#1a1a18"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const ExpiredIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#868170" />
    {/* Hourglass shape */}
    <path
      d="M8.5 7h7M8.5 17h7M9 7l3 4.5L9 17M15 7l-3 4.5L15 17"
      stroke="#F2EEE1"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Strikethrough line */}
    <path
      d="M7 12h10"
      stroke="#F2EEE1"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const PendingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#2bfae9" />
    {/* Three dots (ellipsis) */}
    <circle cx="8" cy="12" r="1.5" fill="#1A1400" />
    <circle cx="12" cy="12" r="1.5" fill="#1A1400" />
    <circle cx="16" cy="12" r="1.5" fill="#1A1400" />
  </svg>
);

const config: Partial<
  Record<Status, { icon: ReactNode; heading: string; description: string }>
> = {
  Executed: {
    icon: <ExecutedIcon />,
    heading: "Proposal Executed",
    description:
      "This proposal has been successfully executed and its actions have been applied to the protocol.",
  },
  Rejected: {
    icon: <RejectedIcon />,
    heading: "Proposal Rejected",
    description:
      "This proposal did not reach the required vote threshold and has been rejected by the community.",
  },
  Expired: {
    icon: <ExpiredIcon />,
    heading: "Proposal Expired",
    description:
      "This proposal did not reach quorum within the voting period and has expired without a decision.",
  },
  Pending: {
    icon: <PendingIcon />,
    heading: "Proposal Pending",
    description:
      "This proposal is awaiting the start of the voting period.",
  },
};

export function AlertBanner({ status }: AlertBannerProps) {
  const cfg = config[status];
  if (!cfg) return null;

  return (
    <div
      className="flex items-center gap-3 px-6 py-4 border"
      style={{
        backgroundColor: `var(--status-${status.toLowerCase()}-bg)`,
        borderColor: `var(--status-${status.toLowerCase()}-border)`,
      }}
    >
      <div className="shrink-0 mt-0.5">{cfg.icon}</div>
      <div className="flex flex-col gap-1">
        <span
          className="text-sm font-semibold uppercase tracking-wider"
          style={{
            color: `var(--status-${status.toLowerCase()}-text)`,
          }}
        >
          {cfg.heading}
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {cfg.description}
        </span>
      </div>
    </div>
  );
}
