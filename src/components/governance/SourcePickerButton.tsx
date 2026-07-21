"use client";

import type { ReactNode } from "react";
import { formatVotesWithUnit } from "@/lib/format";

interface SourcePickerButtonProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** Right-slot amount; rendered via formatVotesWithUnit unless `detail` is given. */
  power?: bigint;
  /** Overrides the right slot (e.g. an address instead of an amount). */
  detail?: ReactNode;
  disabled?: boolean;
  showDivider?: boolean;
  sublabel?: string;
  title?: string;
}

export function SourcePickerButton({
  label,
  power,
  detail,
  selected,
  disabled = false,
  showDivider = false,
  onSelect,
  sublabel,
  title,
}: SourcePickerButtonProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      title={title}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: selected ? "rgba(212, 255, 40, 0.05)" : "transparent",
        borderTop: showDivider ? "1px solid var(--border-default)" : undefined,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: selected ? "var(--accent-primary)" : "var(--text-subtle)",
          }}
        >
          {selected && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--accent-primary)" }}
            />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm truncate"
            style={{
              color: selected ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              className="text-[10px]"
              style={{ color: "var(--accent-secondary)" }}
            >
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
        {detail ?? (power !== undefined ? formatVotesWithUnit(power) : null)}
      </span>
    </button>
  );
}
