import type { Status } from "@/components/ui/StatusBadge";
import { truncateAddress, getExplorerUrl } from "@/lib/format";

interface DetailRow {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  href?: string;
}

interface ProposalDetailsProps {
  status: Status;
  proposer: string;
  payloadAddress?: string;
  forumUrl?: string;
  createdDate: string;
  votingEndsDate: string;
  executedDate?: string;
  yeaPct?: number;
}

export function ProposalDetails({
  status,
  proposer,
  payloadAddress,
  forumUrl,
  createdDate,
  votingEndsDate,
  executedDate,
  yeaPct,
}: ProposalDetailsProps) {
  const explorerUrl = getExplorerUrl();

  const rows: DetailRow[] = [
    { label: "Proposer", value: truncateAddress(proposer), href: `${explorerUrl}/address/${proposer}` },
  ];

  if (payloadAddress && (status === "Active" || status === "Pending" || status === "Executed")) {
    rows.push({ label: "Payload", value: truncateAddress(payloadAddress), href: `${explorerUrl}/address/${payloadAddress}` });
  }

  if (forumUrl) {
    const displayUrl = forumUrl.replace(/^https?:\/\//, "");
    rows.push({ label: "Forum", value: displayUrl, href: forumUrl.startsWith("http") ? forumUrl : `https://${forumUrl}` });
  }

  rows.push({ label: "Created", value: createdDate });

  const isTerminal = status === "Executed" || status === "Rejected" || status === "Expired";
  rows.push({
    label: isTerminal ? "Voting Ended" : "Voting Ends",
    value: votingEndsDate,
    accent: !isTerminal,
  });

  if (status === "Executed" && executedDate) {
    rows.push({ label: "Executed", value: executedDate, accent: true });
  }

  if (status === "Rejected" && yeaPct !== undefined) {
    rows.push({
      label: "Result",
      value: `Rejected - ${yeaPct.toFixed(1)}% For`,
      accent: true,
    });
  }

  if (status === "Expired") {
    rows.push({ label: "Result", value: "Expired - No quorum" });
  }

  return (
    <div
      className="border"
      style={{ borderColor: "var(--border-default)" }}
    >
      <h3
        className="text-sm font-medium tracking-widest uppercase px-6 py-4 border-b"
        style={{
          color: "var(--text-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        Proposal Details
      </h3>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-6 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border-default)" }}
          >
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {row.label}
            </span>
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-right hover:underline"
                style={{ color: "var(--accent-tertiary)" }}
              >
                {row.value}
              </a>
            ) : (
              <span
                className="text-sm text-right"
                style={{
                  color: row.accent
                    ? "var(--accent-tertiary)"
                    : "var(--text-primary)",
                }}
              >
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
