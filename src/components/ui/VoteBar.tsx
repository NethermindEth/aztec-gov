interface VoteBarProps {
  forPct: number;
  againstPct: number;
  forLabel?: string;
  againstLabel?: string;
}

export function VoteBar({
  forPct,
  againstPct,
  forLabel,
  againstLabel,
}: VoteBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 gap-px overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${forPct}%`,
            backgroundColor: "var(--accent-primary)",
          }}
        />
        <div
          className="h-full transition-all"
          style={{
            width: `${againstPct}%`,
            backgroundColor: "var(--accent-secondary)",
          }}
        />
        {forPct + againstPct < 100 && (
          <div
            className="h-full flex-1"
            style={{ backgroundColor: "var(--status-queued-bg)" }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs tabular-nums">
        <span style={{ color: "var(--accent-primary)" }}>
          {forLabel ?? `${forPct.toFixed(1)}% For`}
        </span>
        <span style={{ color: "var(--accent-secondary)" }}>
          {againstLabel ?? `${againstPct.toFixed(1)}% Against`}
        </span>
      </div>
    </div>
  );
}
