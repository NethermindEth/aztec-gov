import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
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
            className="text-[40px] leading-none font-light font-display"
            style={{ color: "var(--accent-primary)" }}
          >
            404
          </span>
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Page not found
          </span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This page doesn&apos;t exist. It may have been moved, or the URL is
            mistyped.
          </p>
          <Link
            href="/"
            className="mt-2 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase cursor-pointer"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--background-primary)",
            }}
          >
            Back to proposals
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
