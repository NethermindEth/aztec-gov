"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useWithdraw, type WithdrawStep } from "@/hooks/useWithdraw";
import { useWithdrawalDelay } from "@/hooks/useWithdrawals";
import { useMaxAmount } from "@/hooks/useMaxAmount";
import { ModalShell, ModalCloseButton } from "./ModalShell";
import { SourcePickerButton } from "./SourcePickerButton";
import { MaxAmountInput } from "./MaxAmountInput";
import { TransactionFailedScreen } from "./TransactionFailedScreen";
import {
  formatVotesWithUnit,
  formatDateFull,
  formatDuration,
  formatDelayFromTimestamp,
  formatWithCommas,
  getExplorerUrl,
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

  // Direct is always listed (disabled at 0) so the picker is stable.
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
  const [phase, setPhase] = useState<"form" | "success" | "failed">("form");
  const hasInitialized = useRef(false);

  const selectedPower =
    source.kind === "staker"
      ? votingPower.stakerPowers.find(
          (s) => s.stakerAddress === source.address
        )?.power ?? 0n
      : votingPower.governancePower;

  const {
    amountInput,
    parsedAmount,
    effectiveAmount,
    isValidAmount,
    handleMax,
    handleAmountInputChange,
    setToExact,
    clearAmount,
  } = useMaxAmount(selectedPower);

  // Reset only on open. A successful withdraw zeroes staker power, and if
  // this fired on that change too the success view would flash back to form.
  useEffect(() => {
    if (isOpen) {
      setPhase("form");
      clearAmount();
      reset();
      hasInitialized.current = false;
    }
  }, [isOpen, reset, clearAmount]);

  // Auto-pick the largest-power source once per open. Gated by hasInitialized
  // so the post-withdraw power refresh doesn't reset the modal mid-flow.
  useEffect(() => {
    if (!isOpen || votingPower.isLoading || hasInitialized.current) return;
    const best = [...availableSources].sort((a, b) =>
      a.power > b.power ? -1 : a.power < b.power ? 1 : 0
    )[0];
    if (best) {
      setSource(best.source);
      setToExact(best.power);
      hasInitialized.current = true;
    }
    // availableSources is rebuilt each render; we watch its scalar inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, votingPower.isLoading, votingPower.governancePower, votingPower.totalStakerPower]);

  useEffect(() => {
    if (isSuccess && txHash) {
      onWithdrawSuccess?.();
      setPhase("success");
    }
  }, [isSuccess, txHash, onWithdrawSuccess]);

  useEffect(() => {
    if (isError) setPhase("failed");
  }, [isError]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const handleSourceChange = (next: WithdrawSource) => {
    setSource(next);
    // Clears any value that was valid against the old source but not the new.
    clearAmount();
  };

  const handleConfirm = () => {
    if (!effectiveAmount || !isValidAmount || !address) return;
    const stakerAddress =
      source.kind === "staker" ? source.address : undefined;
    withdraw(effectiveAmount, address, stakerAddress);
  };

  const explorerUrl = chain?.blockExplorers?.default?.url || getExplorerUrl();

  const showPicker = availableSources.length > 1;

  return (
    <ModalShell
      ariaLabel="Withdraw from Position"
      onClose={handleClose}
      backgroundColor="var(--background-card)"
      rounded
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
            <ModalCloseButton
              onClick={() => {
                if (isPending) reset();
                handleClose();
              }}
            />
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

              <MaxAmountInput
                value={amountInput}
                onChange={handleAmountInputChange}
                onMax={handleMax}
                overflow={parsedAmount !== null && parsedAmount > selectedPower}
                overflowMessage="Exceeds available power for this source"
                txError={null}
              />

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
      ) : phase === "success" ? (
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

          {/* Two-step withdrawal: surface the Claim step so tokens aren't left unclaimed. */}
          <div
            className="w-full px-4 py-3 border rounded-lg mb-5 text-left"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--background-subtle)",
            }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              One more step to get your tokens
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Withdrawing is a two-step process. Come back to this dashboard
              once it unlocks and click Claim on this withdrawal to
              receive your tokens. Until you do, they stay in the governance
              contract.
            </p>
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
      ) : (
        <TransactionFailedScreen
          message={error?.message || "Transaction failed"}
          onRetry={() => {
            reset();
            setPhase("form");
          }}
          onClose={handleClose}
        />
      )}
    </ModalShell>
  );
}
