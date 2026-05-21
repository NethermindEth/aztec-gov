"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useWithdrawals, type WithdrawalInfo } from "@/hooks/useWithdrawals";
import { useFinalizeWithdraw } from "@/hooks/useFinalizeWithdraw";
import { formatVotesWithUnit, formatTimeRemaining, sanitizeTransactionError } from "@/lib/format";

interface VotingPowerPanelProps {
  totalSupply: string;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export function VotingPowerPanel({ totalSupply, onDeposit, onWithdraw }: VotingPowerPanelProps) {
  const { address } = useWallet();
  const supply = BigInt(totalSupply);
  const {
    walletBalance,
    governancePower,
    gsePower,
    totalStakerPower,
    totalVotingPower,
    supplyPercentage,
    isLoading,
  } = useVotingPower(address, supply);
  const { withdrawals, withdrawalDelay } = useWithdrawals(address);

  const activeWithdrawals = withdrawals.filter((w) => !w.claimed);
  const stakedTotal = governancePower + totalStakerPower;

  return (
    <div
      className="border"
      style={{
        backgroundColor: "var(--background-subtle)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Row 1: Total voting power + supply percentage */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 gap-1 md:gap-0">
        <div className="flex flex-col gap-2">
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Your Voting Power
          </span>
          {isLoading ? (
            <Bone className="h-7 w-36" />
          ) : (
            <span
              className="text-[30px] leading-none font-light font-display"
              style={{ color: "var(--accent-primary)" }}
            >
              {formatVotesWithUnit(totalVotingPower)}
            </span>
          )}
        </div>
        <div className="hidden md:flex flex-col items-end gap-2">
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Of Total Supply
          </span>
          {isLoading ? (
            <Bone className="h-7 w-24" />
          ) : (
            <span
              className="text-[30px] leading-none font-light font-display"
              style={{ color: "var(--text-primary)" }}
            >
              {supplyPercentage.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Mobile-only compact summary */}
      {!isLoading && (
        <div className="flex md:hidden items-center gap-4 px-4 pb-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Wallet: {formatVotesWithUnit(walletBalance)}</span>
          <span>Staked: {formatVotesWithUnit(stakedTotal)}</span>
        </div>
      )}

      {/* Row 2: Breakdown grid — desktop only */}
      <div
        className="hidden md:grid grid-cols-3 gap-px mx-6 mb-4"
        style={{ backgroundColor: "var(--border-default)" }}
      >
        <BreakdownCell
          label="Wallet Balance"
          value={formatVotesWithUnit(walletBalance)}
          loading={isLoading}
        />
        <BreakdownCell
          label="Staked Positions"
          value={formatVotesWithUnit(stakedTotal)}
          loading={isLoading}
        />
        <BreakdownCell
          label="Delegated Power"
          value={formatVotesWithUnit(gsePower)}
          loading={isLoading}
        />
      </div>

      {/* Positions link */}
      {!isLoading && (
        <div className="hidden md:flex items-center justify-center gap-1.5 mx-6 mb-2">
          <a
            href="https://stake.aztec.network/my-position"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: "var(--accent-primary)" }}
          >
            View breakdown in Positions →
          </a>
        </div>
      )}

      {/* Deposit CTA when wallet has balance */}
      {!isLoading && walletBalance > 0n && onDeposit && (
        <div
          className="hidden md:flex items-center justify-between mx-6 mb-4 px-4 py-3 border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            You have {formatVotesWithUnit(walletBalance)} in your wallet available to deposit
          </span>
          <button
            onClick={onDeposit}
            className="px-4 py-1.5 text-xs font-semibold tracking-wider uppercase cursor-pointer shrink-0 ml-4"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--background-primary)",
            }}
          >
            Deposit
          </button>
        </div>
      )}

      {/* Withdraw CTA when governance power > 0 */}
      {!isLoading && governancePower > 0n && onWithdraw && (
        <div
          className="hidden md:flex items-center justify-between mx-6 mb-4 px-4 py-3 border"
          style={{ borderColor: "var(--border-default)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            You have {formatVotesWithUnit(governancePower)} staked in governance available to withdraw
          </span>
          <button
            onClick={onWithdraw}
            className="px-4 py-1.5 text-xs font-semibold tracking-wider uppercase cursor-pointer shrink-0 ml-4 border"
            style={{
              borderColor: "var(--text-primary)",
              color: "var(--text-primary)",
              backgroundColor: "transparent",
            }}
          >
            Withdraw
          </button>
        </div>
      )}

      {/* Mobile withdraw button */}
      {!isLoading && governancePower > 0n && onWithdraw && (
        <div className="flex md:hidden px-4 pb-3">
          <button
            onClick={onWithdraw}
            className="w-full py-2 text-xs font-semibold tracking-wider uppercase cursor-pointer border"
            style={{
              borderColor: "var(--text-primary)",
              color: "var(--text-primary)",
              backgroundColor: "transparent",
            }}
          >
            Withdraw
          </button>
        </div>
      )}

      {/* Active withdrawals */}
      {!isLoading && activeWithdrawals.length > 0 && (
        <div className="mx-4 md:mx-6 mb-4">
          <div
            className="flex items-center justify-between px-3 pt-3 pb-2"
            style={{
              backgroundColor: "var(--background-subtle)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-medium tracking-widest uppercase"
                style={{ color: "var(--text-secondary)" }}
              >
                Withdrawals
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                ({activeWithdrawals.length})
              </span>
            </div>
          </div>
          <div
            className="border border-t-0 overflow-hidden"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--background-subtle)",
            }}
          >
            {activeWithdrawals.map((w, i) => (
              <WithdrawalRow key={w.id.toString()} withdrawal={w} index={i} delay={withdrawalDelay} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WithdrawalRow({ withdrawal, index, delay }: { withdrawal: WithdrawalInfo; index: number; delay?: bigint }) {
  const { finalize, isPending: isFinalizing } = useFinalizeWithdraw();
  const [error, setError] = useState<string | null>(null);

  const handleFinalize = async () => {
    setError(null);
    try {
      await finalize(withdrawal.id);
    } catch (err) {
      setError(sanitizeTransactionError(err));
    }
  };

  const amount = formatVotesWithUnit(withdrawal.amount);
  const isReady = withdrawal.status === "ready";

  return (
    <div
      className="flex flex-col gap-1.5 px-3 py-2 border-b last:border-b-0"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "var(--background-subtle)",
      }}
    >
      {/* Content row: label + badge + button + amount */}
      <div className="flex items-center gap-2">
        <span
          className="text-[13px] whitespace-nowrap"
          style={{ color: "var(--text-primary)" }}
        >
          Withdrawal #{index + 1}
        </span>

        {/* Badge */}
        {isReady ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium tracking-wider uppercase border"
            style={{
              backgroundColor: "var(--status-active-bg)",
              borderColor: "var(--status-active-border)",
              color: "var(--status-active-text)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: "var(--status-active-text)" }}
            />
            Ready
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium tracking-wider uppercase border"
            style={{
              backgroundColor: "var(--status-pending-bg)",
              borderColor: "var(--status-pending-border)",
              color: "var(--status-pending-text)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: "var(--status-pending-text)" }}
            />
            Withdrawing
          </span>
        )}

        <span className="flex-1" />

        {/* Finalize button when ready */}
        {isReady && (
          <button
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="px-3 py-1.5 text-[11px] font-medium tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--background-primary)",
            }}
          >
            {isFinalizing ? "Finalizing..." : "Finalize"}
          </button>
        )}

        <span
          className="text-[13px] text-right w-20 shrink-0"
          style={{ color: "var(--text-primary)" }}
        >
          {amount}
        </span>
      </div>

      {/* Progress row: countdown + bar for pending withdrawals */}
      {!isReady && (
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] whitespace-nowrap shrink-0"
            style={{ color: "var(--accent-tertiary)" }}
          >
            Unlocks in {formatTimeRemaining(withdrawal.unlocksAt).replace(" remaining", "")}
          </span>
          <div
            className="flex-1 h-[3px] rounded-sm overflow-hidden"
            style={{ backgroundColor: "var(--border-default)" }}
          >
            <div
              className="h-full rounded-sm"
              style={{
                backgroundColor: "var(--accent-tertiary)",
                width: `${getProgressPct(withdrawal.unlocksAt, delay)}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          className="text-[10px] mt-0.5"
          style={{ color: "var(--accent-secondary)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function getProgressPct(unlocksAt: bigint, delay?: bigint): number {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const remaining = Number(unlocksAt - nowSec);
  if (remaining <= 0) return 100;
  const totalDelay = delay ? Number(delay) : 1_296_000; // fallback ~15 days
  const elapsed = totalDelay - remaining;
  if (elapsed <= 0) return 2;
  return Math.min(98, Math.max(2, (elapsed / totalDelay) * 100));
}

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ backgroundColor: "var(--border-default)" }}
    />
  );
}

function BreakdownCell({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div
      className="flex flex-col gap-2 p-4"
      style={{ backgroundColor: "var(--background-subtle)" }}
    >
      <span
        className="text-xs font-medium tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {loading ? (
        <Bone className="h-4 w-24" />
      ) : (
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
