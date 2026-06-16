interface TransactionFailedScreenProps {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}

export function TransactionFailedScreen({
  message,
  onRetry,
  onClose,
}: TransactionFailedScreenProps) {
  return (
    <div className="p-8 flex flex-col items-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5 border-2"
        style={{
          borderColor: "var(--status-rejected-text)",
          backgroundColor: "var(--status-rejected-bg)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path
            d="M9 9l10 10M19 9L9 19"
            stroke="var(--status-rejected-text)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h2
        className="text-base font-medium mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Transaction Failed
      </h2>

      <p
        className="text-sm text-center mb-6"
        style={{ color: "var(--text-secondary)" }}
      >
        {message}
      </p>

      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 text-sm font-medium tracking-wider uppercase border cursor-pointer rounded"
          style={{
            borderColor: "var(--text-primary)",
            color: "var(--text-primary)",
            backgroundColor: "transparent",
          }}
        >
          Close
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-3.5 text-sm font-medium tracking-wider uppercase cursor-pointer rounded"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "var(--background-primary)",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
