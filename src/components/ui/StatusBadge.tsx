export type Status =
  | "Active"
  | "Pending"
  | "Queued"
  | "Executed"
  | "Rejected"
  | "Expired";

const statusConfig: Record<
  Status,
  { bg: string; border: string; text: string }
> = {
  Active: {
    bg: "var(--status-active-bg)",
    border: "var(--status-active-border)",
    text: "var(--status-active-text)",
  },
  Pending: {
    bg: "var(--status-pending-bg)",
    border: "var(--status-pending-border)",
    text: "var(--status-pending-text)",
  },
  Queued: {
    bg: "var(--status-queued-bg)",
    border: "var(--status-queued-border)",
    text: "var(--status-queued-text)",
  },
  Executed: {
    bg: "var(--status-executed-bg)",
    border: "var(--status-executed-border)",
    text: "var(--status-executed-text)",
  },
  Rejected: {
    bg: "var(--status-rejected-bg)",
    border: "var(--status-rejected-border)",
    text: "var(--status-rejected-text)",
  },
  Expired: {
    bg: "var(--status-expired-bg)",
    border: "var(--status-expired-border)",
    text: "var(--status-expired-text)",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-widest uppercase border"
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.text }}
      />
      {status}
    </span>
  );
}
