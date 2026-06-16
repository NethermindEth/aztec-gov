"use client";

interface MaxAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onMax: () => void;
  // True when the parsed input exceeds the selected source's available power.
  overflow: boolean;
  overflowMessage: string;
  // Resolved transaction-error text, or null when there is none.
  txError?: string | null;
}

export function MaxAmountInput({
  value,
  onChange,
  onMax,
  overflow,
  overflowMessage,
  txError,
}: MaxAmountInputProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Amount
        </label>
        <button
          onClick={onMax}
          className="text-[10px] font-semibold tracking-wider uppercase cursor-pointer"
          style={{ color: "var(--accent-tertiary)" }}
        >
          MAX
        </button>
      </div>
      <div
        className="flex items-center border px-4 py-2.5"
        style={{ borderColor: "var(--border-default)" }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
          placeholder="0"
        />
        <span
          className="text-xs font-medium ml-2"
          style={{ color: "var(--text-muted)" }}
        >
          AZT
        </span>
      </div>
      {overflow && (
        <p className="text-[10px] mt-1" style={{ color: "var(--accent-secondary)" }}>
          {overflowMessage}
        </p>
      )}
      {txError && (
        <p className="text-[10px] mt-1" style={{ color: "var(--accent-secondary)" }}>
          {txError}
        </p>
      )}
    </div>
  );
}
