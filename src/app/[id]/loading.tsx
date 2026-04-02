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
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6">
          <Bone className="h-3 w-20" />
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            /
          </span>
          <Bone className="h-3 w-14" />
        </nav>

        {/* Header */}
        <div className="mb-6">
          <Bone className="h-9 w-full md:w-[420px] mb-3" />
          <div className="flex items-center gap-4">
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-4 w-48" />
            <Bone className="h-4 w-24" />
          </div>
        </div>

        {/* Alert banner placeholder */}
        <div className="mb-8">
          <Bone className="h-12 w-full" />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left panel */}
          <div className="w-full md:w-[340px] md:shrink-0 flex flex-col gap-5">
            {/* Vote breakdown */}
            <div
              className="border p-6"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Bone className="h-4 w-32 mb-5" />
              <Bone className="h-3 w-full mb-3" />
              <div className="flex justify-between mb-4">
                <Bone className="h-3 w-20" />
                <Bone className="h-3 w-20" />
              </div>
              <Bone className="h-2 w-full mb-4" />
              <Bone className="h-3 w-40" />
            </div>

            {/* Action panel */}
            <div
              className="border p-6"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Bone className="h-4 w-24 mb-4" />
              <div className="flex gap-3">
                <Bone className="h-10 flex-1" />
                <Bone className="h-10 flex-1" />
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Lifecycle */}
            <div
              className="border p-6"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="flex items-center gap-6">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Bone className="h-6 w-6 rounded-full" />
                    <Bone className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div
              className="border p-6"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Bone className="h-4 w-28 mb-5" />
              <div className="flex flex-col gap-2">
                <Bone className="h-3 w-full" />
                <Bone className="h-3 w-full" />
                <Bone className="h-3 w-3/4" />
              </div>
            </div>

            {/* Proposal details */}
            <div
              className="border p-6"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Bone className="h-4 w-36 mb-5" />
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex justify-between">
                    <Bone className="h-3 w-24" />
                    <Bone className="h-3 w-40" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
