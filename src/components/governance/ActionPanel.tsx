"use client";

import type { Status } from "@/components/ui/StatusBadge";
import { EtherscanLink } from "@/components/ui/EtherscanLink";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { formatVotesWithUnit } from "@/lib/format";

interface ActionPanelProps {
  status: Status;
  yeaPct?: number;
  nayPct?: number;
  executedDate?: string;
  executionTxHash?: string;
  quorumCurrent?: string;
  quorumRequired?: string;
  quorumPct?: number;
  totalSupply?: string;
  onVote?: (support: boolean) => void;
  onDeposit?: () => void;
}

export function ActionPanel({
  status,
  yeaPct,
  nayPct,
  executedDate,
  executionTxHash,
  quorumCurrent,
  quorumRequired,
  quorumPct,
  totalSupply,
  onVote,
  onDeposit,
}: ActionPanelProps) {
  const { isConnected, address, connect } = useWallet();
  const isActive = status === "Active";
  const isPending = status === "Pending";
  const votingPower = useVotingPower(
    (isActive || isPending) && isConnected ? address : undefined,
    BigInt(totalSupply || "0")
  );

  if (isActive && isConnected) {
    return (
      <div
        className="border p-6"
        style={{ borderColor: "var(--border-default)" }}
      >
        <h3
          className="text-sm font-semibold tracking-widest uppercase mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Cast Your Vote
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Your voting power:{" "}
          {votingPower.isLoading
            ? "Loading..."
            : formatVotesWithUnit(votingPower.totalVotingPower)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => onVote?.(true)}
            className="flex-1 py-2.5 text-sm font-semibold tracking-wider uppercase cursor-pointer"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--background-primary)",
            }}
          >
            Vote For
          </button>
          <button
            onClick={() => onVote?.(false)}
            className="flex-1 py-2.5 text-sm font-semibold tracking-wider uppercase cursor-pointer"
            style={{
              backgroundColor: "var(--accent-secondary)",
              color: "var(--background-primary)",
            }}
          >
            Vote Against
          </button>
        </div>
      </div>
    );
  }

  if (isActive && !isConnected) {
    return (
      <div
        className="border p-6"
        style={{ borderColor: "var(--border-default)" }}
      >
        <h3
          className="text-sm font-semibold tracking-widest uppercase mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Connect your wallet to vote
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Connect your wallet to see your voting power and participate in
          governance.
        </p>
        <button
          onClick={connect}
          className="px-5 py-2.5 text-sm font-semibold tracking-wider uppercase cursor-pointer"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "var(--background-primary)",
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (status === "Executed") {
    return (
      <div
        className="border p-6"
        style={{
          borderColor: "var(--status-executed-border)",
          backgroundColor: "var(--status-executed-bg)",
        }}
      >
        <h3
          className="text-base font-display mb-2"
          style={{ color: "var(--status-executed-text)" }}
        >
          Proposal Executed
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          This proposal has been executed on-chain.
        </p>
        <div className="flex flex-col gap-2">
          {executionTxHash && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Transaction Hash
              </span>
              <span className="text-xs font-medium">
                <EtherscanLink txHash={executionTxHash} />
              </span>
            </div>
          )}
          {executedDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Executed
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {executedDate}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "Rejected") {
    return (
      <div
        className="border p-6"
        style={{
          borderColor: "var(--status-rejected-border)",
          backgroundColor: "var(--status-rejected-bg)",
        }}
      >
        <h3
          className="text-base font-display mb-2"
          style={{ color: "var(--status-rejected-text)" }}
        >
          Proposal Rejected
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          This proposal failed to pass the required voting threshold.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Final Result
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {yeaPct?.toFixed(1)}% For / {nayPct?.toFixed(1)}% Against
          </span>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div
        className="border p-6"
        style={{
          borderColor: "var(--status-pending-border)",
          backgroundColor: "var(--status-pending-bg)",
        }}
      >
        <h3
          className="text-base font-display mb-2"
          style={{ color: "var(--status-pending-text)" }}
        >
          Voting Not Yet Open
        </h3>

        {isConnected ? (
          <>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Your voting power:{" "}
              {votingPower.isLoading
                ? "Loading..."
                : formatVotesWithUnit(votingPower.totalVotingPower)}
            </p>
            {votingPower.walletBalance > 0n && (
              <>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  Wallet balance:{" "}
                  {formatVotesWithUnit(votingPower.walletBalance)}
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                  Voting opens once the proposal becomes Active. Deposit now to
                  increase your voting power.
                </p>
                <button
                  onClick={onDeposit}
                  className="px-5 py-2.5 text-sm font-semibold tracking-wider uppercase cursor-pointer"
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--background-primary)",
                  }}
                >
                  Deposit AZT
                </button>
              </>
            )}
            {votingPower.walletBalance === 0n && !votingPower.isLoading && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Voting will open once the proposal becomes Active.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Connect your wallet to deposit tokens and prepare your voting power.
            </p>
            <button
              onClick={connect}
              className="px-5 py-2.5 text-sm font-semibold tracking-wider uppercase cursor-pointer"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--background-primary)",
              }}
            >
              Connect Wallet
            </button>
          </>
        )}
      </div>
    );
  }

  if (status === "Expired") {
    return (
      <div
        className="border p-6"
        style={{
          borderColor: "var(--status-expired-border)",
          backgroundColor: "var(--status-expired-bg)",
        }}
      >
        <h3
          className="text-base font-display mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Proposal Expired
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          This proposal expired without reaching quorum. Only{" "}
          {quorumCurrent} / {quorumRequired} AZT ({quorumPct?.toFixed(0)}%)
          participated.
        </p>
      </div>
    );
  }

  return null;
}
