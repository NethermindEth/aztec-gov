interface QuorumBarProps {
  pct: number;
}

export function QuorumBar({ pct }: QuorumBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        Quorum:
      </span>
      <div
        className="flex-1 h-1 overflow-hidden"
        style={{ backgroundColor: "var(--status-queued-bg)" }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: "var(--accent-primary)",
          }}
        />
      </div>
      <span
        className="text-xs shrink-0 tabular-nums w-10 text-right"
        style={{ color: "var(--text-muted)" }}
      >
        {pct}%
      </span>
    </div>
  );
}
