"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useDeposit, type DepositStep } from "@/hooks/useDeposit";
import { formatVotesWithUnit, getExplorerUrl, parseAztAmount, bigintToRaw, formatWithCommas } from "@/lib/format";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSupply: string;
  onDepositSuccess?: () => void;
}

function getButtonLabel(step: DepositStep): string {
  switch (step) {
    case "approving":
      return "Approve in wallet...";
    case "waiting-approve":
      return "Waiting for approval...";
    case "depositing":
      return "Deposit in wallet...";
    case "waiting-deposit":
      return "Waiting for deposit...";
    default:
      return "Approve & Deposit (2 txs)";
  }
}

function getStepMessage(step: DepositStep): string {
  switch (step) {
    case "approving":
      return "Approve AZT spending in your wallet\u2026";
    case "waiting-approve":
      return "Waiting for approval confirmation\u2026";
    case "depositing":
      return "Deposit AZT into governance in your wallet\u2026";
    case "waiting-deposit":
      return "Waiting for deposit confirmation\u2026";
    default:
      return "";
  }
}

function getStepperState(step: DepositStep): {
  approve: "upcoming" | "active" | "done";
  deposit: "upcoming" | "active" | "done";
} {
  switch (step) {
    case "approving":
    case "waiting-approve":
      return { approve: "active", deposit: "upcoming" };
    case "depositing":
    case "waiting-deposit":
      return { approve: "done", deposit: "active" };
    case "success":
      return { approve: "done", deposit: "done" };
    default:
      return { approve: "upcoming", deposit: "upcoming" };
  }
}

function StepCircle({
  state,
  index,
}: {
  state: "upcoming" | "active" | "done";
  index: number;
}) {
  if (state === "done") {
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--accent-primary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3 7L6 10L11 4"
            stroke="var(--background-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2"
        style={{
          borderColor: "var(--accent-primary)",
          backgroundColor: "rgba(212, 255, 40, 0.1)",
        }}
      >
        <span
          className="text-[11px] font-bold"
          style={{ color: "var(--accent-primary)" }}
        >
          {index}
        </span>
      </div>
    );
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
      style={{
        borderColor: "var(--text-subtle)",
        backgroundColor: "transparent",
      }}
    >
      <span
        className="text-[11px] font-bold"
        style={{ color: "var(--text-subtle)" }}
      >
        {index}
      </span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div
      className="flex-1 h-[2px] mx-1"
      style={{
        backgroundColor: done
          ? "var(--accent-primary)"
          : "var(--text-subtle)",
      }}
    />
  );
}

function DepositStepper({ step }: { step: DepositStep }) {
  const states = getStepperState(step);
  const labels: [string, "approve" | "deposit"][] = [
    ["Approve", "approve"],
    ["Deposit", "deposit"],
  ];

  return (
    <div className="flex items-center w-full mb-5">
      {labels.map(([label, key], i) => (
        <div key={key} className="flex items-center" style={{ flex: i < labels.length - 1 ? 1 : undefined }}>
          <div className="flex flex-col items-center gap-1">
            <StepCircle state={states[key]} index={i + 1} />
            <span
              className="text-[10px] font-semibold tracking-wider uppercase"
              style={{
                color:
                  states[key] === "done"
                    ? "var(--accent-primary)"
                    : states[key] === "active"
                      ? "var(--text-primary)"
                      : "var(--text-subtle)",
              }}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <StepConnector done={states[key] === "done"} />
          )}
        </div>
      ))}
    </div>
  );
}

export function DepositModal({
  isOpen,
  onClose,
  totalSupply,
  onDepositSuccess,
}: DepositModalProps) {
  const { address, chain } = useWallet();
  const votingPower = useVotingPower(address, BigInt(totalSupply));
  const { deposit, step, txHash, isPending, isSuccess, isError, error, reset } =
    useDeposit();

  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<"form" | "success">("form");
  const hasInitialized = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase("form");
      reset();
      hasInitialized.current = false;
    }
  }, [isOpen, reset]);

  // Set default amount once voting power loads (only once per open)
  useEffect(() => {
    if (isOpen && !hasInitialized.current && !votingPower.isLoading) {
      setAmountInput(formatWithCommas(bigintToRaw(votingPower.walletBalance)));
      hasInitialized.current = true;
    }
  }, [isOpen, votingPower.isLoading, votingPower.walletBalance]);

  // Transition to success on tx hash
  useEffect(() => {
    if (isSuccess && txHash) {
      onDepositSuccess?.();
      setPhase("success");
    }
  }, [isSuccess, txHash, onDepositSuccess]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const parsedAmount = parseAztAmount(amountInput);
  const isValidAmount =
    parsedAmount !== null && parsedAmount <= votingPower.walletBalance;

  const handleMax = () => {
    setAmountInput(formatWithCommas(bigintToRaw(votingPower.walletBalance)));
  };

  const handleConfirm = () => {
    if (!parsedAmount || !isValidAmount || !address) return;
    deposit(parsedAmount, address);
  };

  const explorerUrl = chain?.blockExplorers?.default?.url || getExplorerUrl();
  const truncatedHash = txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : "";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-[calc(100%-2rem)] md:w-[480px] max-h-[90vh] overflow-y-auto border"
        style={{
          backgroundColor: "var(--background-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        {phase === "form" ? (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-[20px] font-display font-normal"
                style={{ color: "var(--text-primary)" }}
              >
                Deposit AZT
              </h2>
              <button
                onClick={() => {
                  if (isPending) reset();
                  handleClose();
                }}
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
            </div>

            {/* Transaction Stepper — shown during progress */}
            {isPending && <DepositStepper step={step} />}

            {isPending ? (
              <>
                {/* Compact summary */}
                <div
                  className="p-4 mb-5"
                  style={{ backgroundColor: "var(--background-card)" }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Deposit Amount
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithCommas(amountInput) || "0"} AZT
                    </span>
                  </div>
                </div>

                {/* Step message */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                    style={{
                      borderColor: "var(--text-subtle)",
                      borderTopColor: "var(--accent-primary)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {getStepMessage(step)}
                  </span>
                </div>

                {/* Cancel button */}
                <button
                  onClick={() => reset()}
                  className="w-full py-3 text-sm font-semibold tracking-wider uppercase border cursor-pointer"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    backgroundColor: "transparent",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {/* Wallet balance */}
                <div className="mb-5">
                  <label
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Available to Deposit
                  </label>
                  <div
                    className="border"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Wallet Balance
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatVotesWithUnit(votingPower.walletBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Amount
                    </label>
                    <button
                      onClick={handleMax}
                      className="text-[10px] font-semibold tracking-wider uppercase cursor-pointer"
                      style={{ color: "var(--accent-tertiary)" }}
                    >
                      MAX
                    </button>
                  </div>
                  <div
                    className="flex items-center border px-4 py-2.5"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <input
                      type="text"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "var(--text-primary)" }}
                      placeholder="0"
                    />
                    <span
                      className="text-xs font-medium ml-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      AZT
                    </span>
                  </div>
                  {parsedAmount !== null &&
                    parsedAmount > votingPower.walletBalance && (
                      <p
                        className="text-[10px] mt-1"
                        style={{ color: "var(--accent-secondary)" }}
                      >
                        Exceeds wallet balance
                      </p>
                    )}
                  {isError && (
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "var(--accent-secondary)" }}
                    >
                      {error?.message || "Transaction failed"}
                    </p>
                  )}
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleConfirm}
                  disabled={!isValidAmount}
                  className="w-full py-3 text-sm font-semibold tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--background-primary)",
                  }}
                >
                  {getButtonLabel(step)}
                </button>
              </>
            )}
          </div>
        ) : (
          /* Success phase */
          <div className="p-6 flex flex-col items-center">
            {/* Checkmark */}
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
              Deposit Successful!
            </h2>
            <p
              className="text-xs text-center mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              Your deposit of {amountInput || "0"} AZT has been confirmed. Your
              voting power has been updated.
            </p>

            {/* Summary card */}
            <div
              className="w-full p-4 mb-5"
              style={{ backgroundColor: "var(--background-card)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Deposited
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatWithCommas(amountInput) || "0"} AZT
                </span>
              </div>
            </div>

            {/* Status indicator */}
            <div className="w-full flex items-center gap-2 mb-4">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "var(--accent-primary)" }}
              />
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--accent-primary)" }}
              >
                Confirmed
              </span>
            </div>

            {/* Transaction row */}
            {txHash && (
              <div
                className="w-full flex items-center justify-between px-4 py-3 border mb-6"
                style={{ borderColor: "var(--border-default)" }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Transaction
                </span>
                <a
                  href={`${explorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:opacity-80"
                  style={{ color: "var(--accent-tertiary)" }}
                >
                  {truncatedHash}
                </a>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleClose}
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
        )}
      </div>
    </div>,
    document.body
  );
}
