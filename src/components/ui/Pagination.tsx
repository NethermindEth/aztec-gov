"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col gap-2 items-center pt-6">
      {/* Navigation row */}
      <div className="flex items-center justify-between w-full">
        {/* PREV */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium tracking-widest uppercase transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>←</span>
          <span>PREV</span>
        </button>

        {/* Mobile: compact page indicator */}
        <span
          className="md:hidden text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {currentPage} / {totalPages}
        </span>

        {/* Desktop: full page numbers */}
        <div className="hidden md:flex items-center gap-1">
          {pages.map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="flex items-center justify-center w-9 h-9 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                …
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className="flex items-center justify-center w-9 h-9 border text-sm font-medium tracking-widest transition-colors cursor-pointer"
                style={{
                  borderColor:
                    page === currentPage
                      ? "var(--parchment-20)"
                      : "var(--border-default)",
                  backgroundColor:
                    page === currentPage ? "var(--parchment-20)" : "transparent",
                  color:
                    page === currentPage
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* NEXT */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium tracking-widest uppercase transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
          style={{ color: "var(--text-primary)" }}
        >
          <span>NEXT</span>
          <span>→</span>
        </button>
      </div>

      {/* Info text */}
      <span className="text-sm pt-3" style={{ color: "var(--text-secondary)" }}>
        Showing {startItem}-{endItem} of {totalItems} proposals
      </span>
    </div>
  );
}
