import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ backgroundColor: "var(--border-default)" }}
    />
  );
}

export default function Loading() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "var(--background-primary)" }}
    >
      <Navbar activeLink="GOVERNANCE" />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Page header */}
        <div className="flex flex-col gap-2 mb-8">
          <Bone className="h-10 w-56" />
          <Bone className="h-4 w-60 md:w-96" />
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="border p-5"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Bone className="h-3 w-28 mb-3" />
              <Bone className="h-7 w-36" />
            </div>
          ))}
        </div>

        {/* CTA panel */}
        <div className="mb-8">
          <div
            className="border p-6"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <Bone className="h-5 w-48" />
                <Bone className="h-4 w-72" />
              </div>
              <Bone className="h-10 w-36 rounded" />
            </div>
          </div>
        </div>

        {/* Controls row: tabs + search */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-6">
          <div className="flex-1 flex gap-4">
            {Array.from({ length: 7 }, (_, i) => (
              <Bone key={i} className="h-4 w-14" />
            ))}
          </div>
          <Bone className="h-9 w-full md:w-72 rounded" />
        </div>

        {/* Proposal list */}
        <div
          className="flex flex-col gap-px"
          style={{ backgroundColor: "var(--border-default)" }}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="px-6 py-5 animate-pulse"
              style={{ backgroundColor: "var(--background-primary)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="h-4 w-16 rounded"
                  style={{ backgroundColor: "var(--border-default)" }}
                />
                <div
                  className="h-4 w-48 md:w-80 rounded"
                  style={{ backgroundColor: "var(--border-default)" }}
                />
                <div
                  className="h-4 w-20 rounded ml-auto"
                  style={{ backgroundColor: "var(--border-default)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
