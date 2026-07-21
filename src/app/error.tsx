"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "var(--background-primary)" }}
    >
      <Navbar activeLink="GOVERNANCE" />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10 flex items-center justify-center">
        <div
          className="flex flex-col items-center gap-4 border px-8 py-12 text-center max-w-md w-full"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Something went wrong
          </span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            The page hit an unexpected error. Your funds and on-chain state are
            unaffected.
          </p>
          {error.digest && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Error reference: {error.digest}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={reset}
              className="px-4 py-1.5 text-xs font-semibold tracking-wider uppercase cursor-pointer"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--background-primary)",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-1.5 text-xs font-semibold tracking-wider uppercase border hover:opacity-80"
              style={{
                borderColor: "var(--text-primary)",
                color: "var(--text-primary)",
              }}
            >
              Back to proposals
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
