"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalShellProps {
  ariaLabel: string;
  onClose: () => void;
  backgroundColor: string;
  rounded?: boolean;
  children: ReactNode;
}

export function ModalShell({
  ariaLabel,
  onClose,
  backgroundColor,
  rounded = false,
  children,
}: ModalShellProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`w-[calc(100%-2rem)] md:w-[480px] max-h-[90vh] overflow-y-auto border${
          rounded ? " rounded-xl" : ""
        }`}
        style={{ backgroundColor, borderColor: "var(--border-default)" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center cursor-pointer"
      style={{
        backgroundColor: "var(--parchment-20)",
        color: "var(--text-primary)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M1 1L11 11M1 11L11 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
