import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import type { GitHubInfo } from "@/lib/types";

interface ProposalRowCompactProps {
  id: string;
  title: string;
  status: Status;
  summaryText: string;
  githubInfo?: GitHubInfo;
  /** When set, renders a chevron icon at the far right of the row. */
  chevron?: "up" | "down";
}

export function ProposalRowCompact({
  id,
  title,
  status,
  summaryText,
  githubInfo,
  chevron,
}: ProposalRowCompactProps) {
  return (
    <div
      className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-6 px-4 md:px-6 py-3 md:py-4 border transition-colors hover:opacity-90"
      style={{ borderColor: "var(--border-default)" }}
    >
      {/* Left: id + title + badge */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-wrap md:flex-nowrap">
        <span
          className="text-xs font-medium tracking-widest uppercase shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {id}
        </span>
        <span
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
        {githubInfo?.type === "pull" && githubInfo.number && (
          <span
            className="text-xs shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            #{githubInfo.number}
          </span>
        )}
        <StatusBadge status={status} />
      </div>

      {/* Right: summary + chevron */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className="text-xs tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {summaryText}
        </span>
        {chevron && (
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{
              color: "var(--text-muted)",
              transform: chevron === "up" ? "rotate(180deg)" : "rotate(0deg)",
            }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        )}
      </div>
    </div>
  );
}
