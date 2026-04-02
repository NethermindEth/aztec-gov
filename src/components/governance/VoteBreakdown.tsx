interface VoteBreakdownProps {
  title: string;
  yeaPct: number;
  nayPct: number;
  yeaVotes: string;
  nayVotes: string;
  quorumReached: boolean;
  quorumCurrent: string;
  quorumRequired: string;
  quorumPct: number;
}

export function VoteBreakdown({
  title,
  yeaPct,
  nayPct,
  yeaVotes,
  nayVotes,
  quorumReached,
  quorumCurrent,
  quorumRequired,
  quorumPct,
}: VoteBreakdownProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Votes section */}
      <div
        className="border p-6"
        style={{ borderColor: "var(--border-default)" }}
      >
        <h3
          className="text-sm font-medium tracking-widest uppercase mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>

        {/* FOR */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--accent-primary)" }}
            >
              For
            </span>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {yeaPct.toFixed(1)}%
            </span>
          </div>
          <div
            className="h-2 w-full"
            style={{ backgroundColor: "var(--status-queued-bg)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${yeaPct}%`,
                backgroundColor: "var(--accent-primary)",
              }}
            />
          </div>
          <p
            className="text-xs mt-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {yeaVotes}
          </p>
        </div>

        {/* AGAINST */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--accent-secondary)" }}
            >
              Against
            </span>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {nayPct.toFixed(1)}%
            </span>
          </div>
          <div
            className="h-2 w-full"
            style={{ backgroundColor: "var(--status-queued-bg)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${nayPct}%`,
                backgroundColor: "var(--accent-secondary)",
              }}
            />
          </div>
          <p
            className="text-xs mt-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {nayVotes}
          </p>
        </div>
      </div>

      {/* Quorum section */}
      <div
        className="border p-6"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Quorum
          </span>
          <span
            className="text-xs font-semibold tracking-wider uppercase"
            style={{
              color: quorumReached
                ? "var(--accent-primary)"
                : "var(--accent-secondary)",
            }}
          >
            {quorumReached ? "Reached" : "Not Reached"}
          </span>
        </div>
        <div
          className="h-1.5 w-full mb-2"
          style={{ backgroundColor: "var(--status-queued-bg)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.min(quorumPct, 100)}%`,
              backgroundColor: quorumReached
                ? "var(--accent-primary)"
                : "var(--accent-secondary)",
            }}
          />
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {quorumCurrent} / {quorumRequired} AZT required ({quorumPct.toFixed(1)}%)
        </p>
      </div>
    </div>
  );
}
