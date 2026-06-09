"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useWithdraw, type WithdrawStep } from "@/hooks/useWithdraw";
import { useWithdrawalDelay } from "@/hooks/useWithdrawals";
import {
  formatVotesWithUnit,
  formatDateFull,
  formatDuration,
  formatDelayFromTimestamp,
  parseAztAmount,
  bigintToRaw,
  formatWithCommas,
  truncateAddress,
} from "@/lib/format";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSupply: string;
  onWithdrawSuccess?: () => void;
}

type WithdrawSource =
  | { kind: "direct" }
  | { kind: "staker"; address: Address };

function sourceKey(source: WithdrawSource): string {
  return source.kind === "direct" ? "direct" : `staker:${source.address}`;
}

function SourcePickerButton({
  label,
  power,
  selected,
  disabled,
  showDivider,
  onSelect,
}: {
  label: string;
  power: bigint;
  selected: boolean;
  disabled: boolean;
  showDivider: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: selected ? "rgba(212, 255, 40, 0.05)" : "transparent",
        borderTop: showDivider ? "1px solid var(--border-default)" : undefined,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: selected ? "var(--accent-primary)" : "var(--text-subtle)",
          }}
        >
          {selected && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--accent-primary)" }}
            />
          )}
        </div>
        <span
          className="text-sm truncate"
          style={{
            color: selected ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
        {formatVotesWithUnit(power)}
      </span>
    </button>
  );
}

function getStepMessage(step: WithdrawStep): string {
  switch (step) {
    case "initiating":
      return "Confirm withdrawal in your wallet…";
    case "waiting":
      return "Waiting for transaction confirmation…";
    default:
      return "";
  }
}

export function WithdrawModal({
  isOpen,
  onClose,
  totalSupply,
  onWithdrawSuccess,
}: WithdrawModalProps) {
  const { address, chain } = useWallet();
  const votingPower = useVotingPower(address, BigInt(totalSupply));
  const withdrawalDelay = useWithdrawalDelay();
  const {
    withdraw,
    step,
    txHash,
    withdrawalId,
    unlocksAt,
    isPending,
    isSuccess,
    isError,
    error,
    reset,
  } = useWithdraw();

  // Direct is always listed (disabled when 0) so the picker UI stays stable
  // across wallets that have only direct, only staker, or both.
  const availableSources = useMemo<
    { source: WithdrawSource; power: bigint; label: string }[]
  >(() => {
    return [
      {
        source: { kind: "direct" },
        power: votingPower.governancePower,
        label: "Direct Deposit",
      },
      ...votingPower.stakerPowers
        .filter((s) => s.power > 0n)
        .map((s) => ({
          source: { kind: "staker" as const, address: s.stakerAddress },
          power: s.power,
          label: `Staker ${truncateAddress(s.stakerAddress)}`,
        })),
    ];
  }, [votingPower.governancePower, votingPower.stakerPowers]);

  const [source, setSource] = useState<WithdrawSource>({ kind: "direct" });
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<"form" | "success">("form");

  // Default to the largest-power source so ATP-only users land on their Staker.
  useEffect(() => {
    if (!isOpen || votingPower.isLoading) return;
    setPhase("form");
    setAmountInput("");
    reset();
    const best = [...availableSources].sort((a, b) =>
      a.power > b.power ? -1 : a.power < b.power ? 1 : 0
    )[0];
    if (best) setSource(best.source);
    // availableSources is rebuilt each render; we watch its scalar inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, votingPower.isLoading, votingPower.governancePower, votingPower.totalStakerPower]);

  useEffect(() => {
    if (isSuccess && txHash) {
      onWithdrawSuccess?.();
      setPhase("success");
    }
  }, [isSuccess, txHash, onWithdrawSuccess]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const selectedPower = (() => {
    if (source.kind === "staker") {
      return (
        votingPower.stakerPowers.find(
          (s) => s.stakerAddress === source.address
        )?.power ?? 0n
      );
    }
    return votingPower.governancePower;
  })();

  const parsedAmount = parseAztAmount(amountInput);
  const isValidAmount =
    parsedAmount !== null && parsedAmount > 0n && parsedAmount <= selectedPower;

  const handleMax = () => {
    setAmountInput(formatWithCommas(bigintToRaw(selectedPower)));
  };

  const handleSourceChange = (next: WithdrawSource) => {
    setSource(next);
    // Reset so a value valid for the previous source isn't silently invalid here.
    setAmountInput("");
  };

  const handleConfirm = () => {
    if (!parsedAmount || !isValidAmount || !address) return;
    const stakerAddress =
      source.kind === "staker" ? source.address : undefined;
    withdraw(parsedAmount, address, stakerAddress);
  };

  const explorerUrl =
    chain?.blockExplorers?.default?.url ||
    (Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111") === 1
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io");

  const showPicker = availableSources.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-[calc(100%-2rem)] md:w-[480px] max-h-[90vh] overflow-y-auto border rounded-xl"
        style={{
          backgroundColor: "var(--background-card)",
          borderColor: "var(--border-default)",
        }}
      >
        {phase === "form" ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-base font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Withdraw from Position
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

            <div
              className="h-px w-full mb-4"
              style={{ backgroundColor: "var(--border-default)" }}
            />

            {isPending ? (
              <>
                <div
                  className="p-4 mb-5 rounded-lg"
                  style={{ backgroundColor: "var(--background-subtle)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Source
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {source.kind === "direct"
                        ? "Direct Deposit"
                        : `Staker ${truncateAddress(source.address)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Withdrawal Amount
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithCommas(amountInput) || "0"} AZT
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                    style={{
                      borderColor: "var(--text-subtle)",
                      borderTopColor: "var(--accent-tertiary)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {getStepMessage(step)}
                  </span>
                </div>

                <button
                  onClick={() => reset()}
                  className="w-full py-3.5 text-sm font-medium tracking-wider uppercase border cursor-pointer rounded"
                  style={{
                    borderColor: "var(--text-primary)",
                    color: "var(--text-primary)",
                    backgroundColor: "transparent",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {showPicker && (
                  <div className="mb-4">
                    <label
                      className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Withdraw From
                    </label>
                    <div
                      className="border rounded-lg overflow-hidden"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      {availableSources.map((entry, i) => {
                        const key = sourceKey(entry.source);
                        return (
                          <SourcePickerButton
                            key={key}
                            label={entry.label}
                            power={entry.power}
                            selected={sourceKey(source) === key}
                            disabled={entry.power === 0n}
                            showDivider={i > 0}
                            onSelect={() => handleSourceChange(entry.source)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Available
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatVotesWithUnit(selectedPower)}
                  </span>
                </div>

                <div
                  className="flex items-center border h-10 px-3 rounded-lg mb-4"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor: "var(--background-subtle)",
                  }}
                >
                  <input
                    type="text"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "var(--text-primary)" }}
                    placeholder="Enter amount"
                  />
                  <button
                    onClick={handleMax}
                    className="text-xs font-medium px-2 py-1 rounded cursor-pointer"
                    style={{ color: "var(--text-faint)" }}
                  >
                    MAX
                  </button>
                </div>

                {parsedAmount !== null && parsedAmount > selectedPower && (
                  <p
                    className="text-[10px] -mt-3 mb-4"
                    style={{ color: "var(--accent-secondary)" }}
                  >
                    Exceeds available power for this source
                  </p>
                )}

                {isError && (
                  <p
                    className="text-[10px] -mt-3 mb-4"
                    style={{ color: "var(--accent-secondary)" }}
                  >
                    {error?.message || "Transaction failed"}
                  </p>
                )}

                <div
                  className="px-3 py-2.5 rounded-lg mb-4"
                  style={{ backgroundColor: "var(--background-subtle)" }}
                >
                  <p
                    className="text-xs leading-[18px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {source.kind === "staker"
                      ? "Funds will be released to your vault after the unlock period."
                      : "Your voting power will decrease immediately."}
                    {withdrawalDelay && (
                      <> Withdrawal delay: {formatDuration(withdrawalDelay)}.</>
                    )}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3.5 text-sm font-medium tracking-wider uppercase border cursor-pointer rounded"
                    style={{
                      borderColor: "var(--text-primary)",
                      color: "var(--text-primary)",
                      backgroundColor: "transparent",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!isValidAmount}
                    className="flex-1 py-3.5 text-sm font-medium tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      color: "var(--background-primary)",
                    }}
                  >
                    Confirm Withdrawal
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Success phase */
          <div className="p-8 flex flex-col items-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5 border-2"
              style={{
                borderColor: "var(--accent-tertiary)",
                backgroundColor: "rgba(43, 250, 233, 0.1)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M7 14L12 19L21 9"
                  stroke="var(--accent-tertiary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2
              className="text-base font-medium mb-5"
              style={{ color: "var(--text-primary)" }}
            >
              Withdrawal Initiated
            </h2>

            <p
              className="text-2xl font-medium mb-5"
              style={{ color: "var(--text-primary)" }}
            >
              {formatWithCommas(amountInput) || "0"} AZT
            </p>

            <div className="w-full flex flex-col gap-2 mb-5 text-sm">
              {withdrawalId !== undefined && (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Withdrawal ID
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    #W-{withdrawalId.toString()}
                  </span>
                </div>
              )}
              {unlocksAt !== undefined && (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Unlocks
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--accent-tertiary)" }}
                  >
                    {formatDateFull(unlocksAt)}
                  </span>
                </div>
              )}
              {unlocksAt !== undefined && (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Delay
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {formatDelayFromTimestamp(unlocksAt)}
                  </span>
                </div>
              )}
            </div>

            {txHash && (
              <div
                className="w-full flex items-center justify-between px-4 py-3 border rounded-lg mb-5"
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
                  {txHash.slice(0, 6)}...{txHash.slice(-4)}
                </a>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full py-3.5 text-sm font-medium tracking-wider uppercase cursor-pointer rounded"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--background-primary)",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
