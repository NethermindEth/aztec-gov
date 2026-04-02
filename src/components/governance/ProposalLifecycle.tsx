import type { LifecycleStep } from "@/lib/types";

interface ProposalLifecycleProps {
  steps: LifecycleStep[];
  variant?: "full" | "compact";
}

const SIZE = {
  full: { dot: "w-2.5 h-2.5", label: "text-[11px]", gap: "mt-2" },
  compact: { dot: "w-2 h-2", label: "text-[10px]", gap: "mt-1" },
} as const;

export function ProposalLifecycle({ steps, variant = "full" }: ProposalLifecycleProps) {
  const s = SIZE[variant];

  const timeline = (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dotColor =
          step.state === "completed"
            ? "var(--accent-primary)"
            : step.state === "current"
              ? "var(--accent-tertiary)"
              : step.state === "rejected"
                ? "var(--accent-secondary)"
                : "var(--text-subtle)";
        const lineColor =
          step.state === "completed"
            ? "var(--accent-primary)"
            : "var(--border-default)";
        const labelColor =
          step.state === "completed"
            ? "var(--accent-primary)"
            : step.state === "current"
              ? "var(--accent-tertiary)"
              : step.state === "rejected"
                ? "var(--accent-secondary)"
                : "var(--text-subtle)";

        return (
          <div
            key={step.label}
            className="flex flex-col items-start"
            style={{ flex: isLast ? "0 0 auto" : "1 1 0%" }}
          >
            {/* Dot + Line row */}
            <div className="flex items-center w-full">
              <div
                className={`${s.dot} rounded-full shrink-0`}
                style={{ backgroundColor: dotColor }}
              />
              {!isLast && (
                <div
                  className="h-[2px] flex-1"
                  style={{ backgroundColor: lineColor }}
                />
              )}
            </div>
            {/* Label */}
            <span
              className={`${s.label} font-semibold tracking-widest uppercase ${s.gap}`}
              style={{ color: labelColor }}
            >
              {step.label}
            </span>
            {/* Date */}
            <span
              className={`${variant === "full" ? "text-[11px]" : "text-[10px]"} mt-0.5`}
              style={{ color: "var(--text-muted)" }}
            >
              {step.date}
            </span>
            {/* Time remaining */}
            {step.timeRemaining && (
              <span
                className={`${variant === "full" ? "text-[11px]" : "text-[10px]"} mt-0.5`}
                style={{ color: labelColor }}
              >
                {step.timeRemaining}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (variant === "compact") {
    return timeline;
  }

  return (
    <div
      className="border p-6"
      style={{ borderColor: "var(--border-default)" }}
    >
      <h3
        className="text-sm font-medium tracking-widest uppercase mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        Proposal Lifecycle
      </h3>
      {timeline}
    </div>
  );
}
