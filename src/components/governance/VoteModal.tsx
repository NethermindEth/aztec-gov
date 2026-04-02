"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useVote, type VoteStep } from "@/hooks/useVote";
import { formatVotesWithUnit, getExplorerUrl, parseAztAmount, bigintToRaw, formatWithCommas } from "@/lib/format";

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: number;
  initialSupport: boolean;
  totalSupply: string;
  canDeposit?: boolean;
  onVoteSuccess?: () => void;
}

function getButtonLabel(step: VoteStep, needsDeposit: boolean): string {
  switch (step) {
    case "approving":
      return "Approve in wallet...";
    case "waiting-approve":
      return "Waiting for approval...";
    case "depositing":
      return "Deposit in wallet...";
    case "waiting-deposit":
      return "Waiting for deposit...";
    case "voting":
      return "Confirm in wallet...";
    case "waiting-vote":
      return "Waiting for vote...";
    default:
      return needsDeposit
        ? "Approve \u2192 Deposit \u2192 Vote (3 txs)"
        : "Confirm Vote";
  }
}

function getStepperState(step: VoteStep): {
  approve: "upcoming" | "active" | "done";
  deposit: "upcoming" | "active" | "done";
  vote: "upcoming" | "active" | "done";
} {
  switch (step) {
    case "approving":
    case "waiting-approve":
      return { approve: "active", deposit: "upcoming", vote: "upcoming" };
    case "depositing":
    case "waiting-deposit":
      return { approve: "done", deposit: "active", vote: "upcoming" };
    case "voting":
    case "waiting-vote":
      return { approve: "done", deposit: "done", vote: "active" };
    case "success":
      return { approve: "done", deposit: "done", vote: "done" };
    default:
      return { approve: "upcoming", deposit: "upcoming", vote: "upcoming" };
  }
}

function getStepMessage(step: VoteStep): string {
  switch (step) {
    case "approving":
      return "Approve AZT spending in your wallet\u2026";
    case "waiting-approve":
      return "Waiting for approval confirmation\u2026";
    case "depositing":
      return "Deposit AZT into governance in your wallet\u2026";
    case "waiting-deposit":
      return "Waiting for deposit confirmation\u2026";
    case "voting":
      return "Cast your vote in your wallet\u2026";
    case "waiting-vote":
      return "Waiting for vote confirmation\u2026";
    default:
      return "";
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

function TransactionStepper({ step }: { step: VoteStep }) {
  const states = getStepperState(step);
  const labels: [string, "approve" | "deposit" | "vote"][] = [
    ["Approve", "approve"],
    ["Deposit", "deposit"],
    ["Vote", "vote"],
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

export function VoteModal({
  isOpen,
  onClose,
  proposalId,
  initialSupport,
  totalSupply,
  canDeposit = false,
  onVoteSuccess,
}: VoteModalProps) {
  const { address, chain } = useWallet();
  const votingPower = useVotingPower(address, BigInt(totalSupply));
  const { vote, step, txHash, isPending, isSuccess, isError, error, reset } =
    useVote();

  const [support, setSupport] = useState(initialSupport);
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<"voting" | "success">("voting");
  const hasInitialized = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSupport(initialSupport);
      setPhase("voting");
      reset();
      hasInitialized.current = false;
    }
  }, [isOpen, initialSupport, reset]);

  // Set default amount once voting power loads (only once per open)
  useEffect(() => {
    if (isOpen && !hasInitialized.current && !votingPower.isLoading) {
      const available = canDeposit
        ? votingPower.totalVotingPower + votingPower.walletBalance
        : votingPower.totalVotingPower;
      setAmountInput(formatWithCommas(bigintToRaw(available)));
      hasInitialized.current = true;
    }
  }, [isOpen, votingPower.isLoading, votingPower.totalVotingPower, votingPower.walletBalance, canDeposit]);

  // Transition to success on tx hash
  useEffect(() => {
    if (isSuccess && txHash) {
      onVoteSuccess?.();
      setPhase("success");
    }
  }, [isSuccess, txHash, onVoteSuccess]);

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
  // When canDeposit (Pending), allow wallet balance + staked; otherwise staked only
  const availablePower = canDeposit
    ? votingPower.totalVotingPower + votingPower.walletBalance
    : votingPower.totalVotingPower;
  const isValidAmount =
    parsedAmount !== null && parsedAmount <= availablePower;

  // Derive deposit needs early for UI
  const depositNeeded =
    parsedAmount !== null && parsedAmount > votingPower.totalVotingPower
      ? parsedAmount - votingPower.totalVotingPower
      : 0n;
  const needsDeposit = canDeposit && depositNeeded > 0n;

  const handleMax = () => {
    setAmountInput(formatWithCommas(bigintToRaw(availablePower)));
  };

  const handleConfirm = () => {
    if (!parsedAmount || !isValidAmount || !address) return;
    vote(proposalId, parsedAmount, support, needsDeposit ? depositNeeded : 0n, address);
  };

  const explorerUrl = chain?.blockExplorers?.default?.url || getExplorerUrl();
  const truncatedHash = txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : "";

  const votePct =
    parsedAmount && BigInt(totalSupply) > 0n
      ? (Number((parsedAmount * 10000n) / BigInt(totalSupply)) / 100).toFixed(2)
      : "0.00";

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
        {phase === "voting" ? (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-[20px] font-display font-normal"
                style={{ color: "var(--text-primary)" }}
              >
                Cast Your Vote
              </h2>
              <button
                onClick={() => {
                  if (isPending) {
                    reset();
                  }
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

            {/* Transaction Stepper — shown during multi-tx progress */}
            {needsDeposit && isPending && (
              <TransactionStepper step={step} />
            )}

            {/* Progress phase — compact summary + step message */}
            {isPending ? (
              <>
                {/* Compact vote summary */}
                <div
                  className="p-4 mb-5"
                  style={{ backgroundColor: "var(--background-card)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Vote
                    </span>
                    <span
                      className="text-xs font-semibold uppercase"
                      style={{
                        color: support
                          ? "var(--accent-primary)"
                          : "var(--accent-secondary)",
                      }}
                    >
                      {support ? "For" : "Against"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Amount
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
                  {/* Spinner */}
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
                  onClick={() => {
                    reset();
                  }}
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
                {/* Voting Direction */}
                <div className="mb-5">
                  <label
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Voting
                  </label>
                  <div className="flex gap-3">
                    {/* Vote FOR */}
                    <button
                      onClick={() => setSupport(true)}
                      className="flex-1 flex items-center gap-3 p-3 border cursor-pointer"
                      style={{
                        borderColor: support
                          ? "var(--accent-primary)"
                          : "var(--border-default)",
                        backgroundColor: support
                          ? "rgba(212, 255, 40, 0.05)"
                          : "transparent",
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{
                          borderColor: support
                            ? "var(--accent-primary)"
                            : "var(--text-subtle)",
                        }}
                      >
                        {support && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: "var(--accent-primary)" }}
                          />
                        )}
                      </div>
                      <span
                        className="text-sm font-semibold tracking-wider uppercase"
                        style={{
                          color: support
                            ? "var(--accent-primary)"
                            : "var(--text-muted)",
                        }}
                      >
                        Vote For
                      </span>
                    </button>

                    {/* Vote AGAINST */}
                    <button
                      onClick={() => setSupport(false)}
                      className="flex-1 flex items-center gap-3 p-3 border cursor-pointer"
                      style={{
                        borderColor: !support
                          ? "var(--accent-secondary)"
                          : "var(--border-default)",
                        backgroundColor: !support
                          ? "rgba(255, 45, 244, 0.05)"
                          : "transparent",
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{
                          borderColor: !support
                            ? "var(--accent-secondary)"
                            : "var(--text-subtle)",
                        }}
                      >
                        {!support && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: "var(--accent-secondary)" }}
                          />
                        )}
                      </div>
                      <span
                        className="text-sm font-semibold tracking-wider uppercase"
                        style={{
                          color: !support
                            ? "var(--accent-secondary)"
                            : "var(--text-muted)",
                        }}
                      >
                        Vote Against
                      </span>
                    </button>
                  </div>
                </div>

                {/* Vote Source */}
                <div className="mb-5">
                  <label
                    className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Vote Source
                  </label>
                  <div
                    className="border"
                    style={{
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3"
                      style={canDeposit ? {
                        borderBottomWidth: "1px",
                        borderBottomColor: "var(--border-default)",
                      } : undefined}
                    >
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Staked Power
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatVotesWithUnit(
                          votingPower.governancePower + votingPower.gsePower
                        )}
                      </span>
                    </div>
                    {canDeposit && (
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
                    )}
                  </div>
                </div>

                {/* Amount */}
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
                    parsedAmount > availablePower && (
                      <p
                        className="text-[10px] mt-1"
                        style={{ color: "var(--accent-secondary)" }}
                      >
                        Exceeds available voting power
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

                {/* Deposit info box */}
                {needsDeposit && isValidAmount && (
                  <div
                    className="px-4 py-3 mb-5"
                    style={{
                      borderLeft: "3px solid var(--accent-tertiary)",
                      backgroundColor: "rgba(43, 250, 233, 0.05)",
                    }}
                  >
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Depositing{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "var(--accent-tertiary)" }}
                      >
                        {formatWithCommas(bigintToRaw(depositNeeded))} AZT
                      </span>{" "}
                      from your wallet. This requires{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        3 transactions
                      </span>
                      : Approve, Deposit, then Vote.
                    </p>
                  </div>
                )}

                {/* Summary */}
                <div
                  className="p-4 mb-5"
                  style={{ backgroundColor: "var(--background-card)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Vote
                    </span>
                    <span
                      className="text-xs font-semibold uppercase"
                      style={{
                        color: support
                          ? "var(--accent-primary)"
                          : "var(--accent-secondary)",
                      }}
                    >
                      {support ? "For" : "Against"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Amount
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithCommas(amountInput) || "0"} AZT
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Voting Power
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {votePct}%
                    </span>
                  </div>
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
                  {getButtonLabel(step, needsDeposit)}
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
              style={{
                backgroundColor: support
                  ? "rgba(212, 255, 40, 0.1)"
                  : "rgba(255, 45, 244, 0.1)",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
              >
                <path
                  d="M8 16L14 22L24 10"
                  stroke={
                    support
                      ? "var(--accent-primary)"
                      : "var(--accent-secondary)"
                  }
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
              Vote Submitted!
            </h2>
            <p
              className="text-xs text-center mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              Your vote of {amountInput || "0"} AZT{" "}
              <span
                style={{
                  color: support
                    ? "var(--accent-primary)"
                    : "var(--accent-secondary)",
                  fontWeight: 600,
                }}
              >
                ({support ? "FOR" : "AGAINST"})
              </span>{" "}
              has been submitted. It will be confirmed once the transaction is
              processed on-chain.
            </p>

            {/* Vote summary card */}
            <div
              className="w-full p-4 mb-5"
              style={{ backgroundColor: "var(--background-card)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Vote
                </span>
                <span
                  className="text-xs font-semibold uppercase"
                  style={{
                    color: support
                      ? "var(--accent-primary)"
                      : "var(--accent-secondary)",
                  }}
                >
                  {support ? "For" : "Against"}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Amount
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {amountInput || "0"} AZT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Voting Power
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {votePct}%
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
                Submitted
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
