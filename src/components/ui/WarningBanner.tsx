"use client";

import { RetryButton } from "./RetryButton";

export function WarningBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => unknown;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 mx-4 md:mx-6 mb-4 px-4 py-3 border"
      style={{ borderColor: "var(--border-default)" }}
    >
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {message}
      </span>
      <RetryButton onRetry={onRetry} />
    </div>
  );
}
