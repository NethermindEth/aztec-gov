"use client";

import { useEffect } from "react";

// Replaces the crashed root layout, so theme CSS may be absent; colors are inlined. Error reporting hooks in here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1400",
          color: "#f2eee1",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            border: "1px solid #302a17",
            padding: "48px 32px",
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#868171",
              margin: 0,
            }}
          >
            Something went wrong
          </p>
          <p style={{ fontSize: 14, margin: "16px 0 24px" }}>
            The app failed to load. Your funds and on-chain state are
            unaffected.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#868171", margin: "0 0 16px" }}>
              Error reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: "#d4ff28",
              color: "#1a1400",
              border: "none",
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
