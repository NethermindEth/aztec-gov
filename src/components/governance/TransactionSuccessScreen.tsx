"use client";

import type { ReactNode } from "react";
import { truncateAddress } from "@/lib/format";

interface TransactionSuccessScreenProps {
  title: string;
  message: ReactNode;
  onClose: () => void;
  /** Rendered as an explorer link row when both are present. */
  txHash?: `0x${string}`;
  explorerUrl?: string;
  txLabel?: string;
}

// Success counterpart to TransactionFailedScreen. DepositModal, VoteModal
// and WithdrawModal predate this extraction and still carry inline copies.
export function TransactionSuccessScreen({
  title,
  message,
  onClose,
  txHash,
  explorerUrl,
  txLabel = "Transaction",
}: TransactionSuccessScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(212, 255, 40, 0.1)" }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 16L14 22L24 10"
            stroke="var(--accent-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2
        className="text-[20px] font-display font-normal mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>

      <p
        className="text-xs text-center mb-6"
        style={{ color: "var(--text-muted)" }}
      >
        {message}
      </p>

      {txHash && explorerUrl && (
        <div
          className="w-full flex items-center justify-between px-4 py-3 border mb-6"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {txLabel}
          </span>
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:opacity-80"
            style={{ color: "var(--accent-tertiary)" }}
          >
            {truncateAddress(txHash)}
          </a>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-3 text-sm font-semibold tracking-wider uppercase border cursor-pointer"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
          backgroundColor: "transparent",
        }}
      >
        Close
      </button>
    </div>
  );
}
