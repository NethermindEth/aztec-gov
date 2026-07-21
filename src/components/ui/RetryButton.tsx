"use client";

import { useState } from "react";

// Busy state is click-scoped (awaits onRetry), so background refetches never flip the label.
export function RetryButton({
  onRetry,
  className = "",
}: {
  onRetry: () => unknown;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase shrink-0 border cursor-pointer disabled:opacity-60 disabled:cursor-default ${className}`}
      style={{
        borderColor: "var(--text-primary)",
        color: "var(--text-primary)",
        backgroundColor: "transparent",
      }}
    >
      {busy ? "Retrying..." : "Retry"}
    </button>
  );
}
