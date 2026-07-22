"use client";

import { useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useDelegations } from "@/hooks/useDelegations";
import { useDelegate } from "@/hooks/useDelegate";
import {
  useInvalidateUserData,
  useInvalidateDelegations,
} from "@/hooks/useInvalidateUserData";
import { ModalShell, ModalCloseButton } from "@/components/governance/ModalShell";
import { SourcePickerButton } from "@/components/governance/SourcePickerButton";
import { TransactionFailedScreen } from "@/components/governance/TransactionFailedScreen";
import { TransactionSuccessScreen } from "@/components/governance/TransactionSuccessScreen";
import {
  formatVotesWithUnit,
  getExplorerUrl,
  truncateAddress,
} from "@/lib/format";
import {
  classifyDelegatee,
  positionKey,
  type DelegationPosition,
} from "@/lib/gse-delegation";

interface DelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DELEGATEE_CLASS_LABEL: Record<string, string> = {
  default: "Rollup (default)",
  self: "You",
  none: "None",
};

function currentDelegateeLabel(p: DelegationPosition, wallet?: Address): string {
  return (
    DELEGATEE_CLASS_LABEL[classifyDelegatee(p, wallet)] ??
    truncateAddress(p.delegatee)
  );
}

function instanceLabel(p: DelegationPosition): string {
  return p.isBonus ? "Follows latest rollup" : `Rollup ${truncateAddress(p.instance)}`;
}

export function DelegateModal({ isOpen, onClose }: DelegateModalProps) {
  const { address, chain } = useWallet();
  const wallet = address ? getAddress(address) : undefined;
  const { positions, incomplete, isLoading } = useDelegations(address);
  const { delegate, step, progress, txHash, isSuccess, isError, error, reset } =
    useDelegate();
  const invalidateUserData = useInvalidateUserData();
  const invalidateDelegations = useInvalidateDelegations();

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [delegateeKind, setDelegateeKind] = useState<"self" | "custom">("self");
  const [customAddress, setCustomAddress] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setDelegateeKind("self");
      setCustomAddress("");
      reset();
    }
  }, [isOpen, reset]);

  // Refresh power figures and the delegation list once the last tx lands;
  // the panel summary and row chips read from the gse-delegations query.
  useEffect(() => {
    if (isSuccess) {
      invalidateUserData();
      invalidateDelegations();
    }
  }, [isSuccess, invalidateUserData, invalidateDelegations]);

  const delegatable = useMemo(
    () => positions.filter((p) => p.route.kind !== "locked"),
    [positions]
  );
  const locked = useMemo(
    () => positions.filter((p) => p.route.kind === "locked"),
    [positions]
  );

  // Default: everything not already pointing at the wallet.
  const effectiveSelected = useMemo(() => {
    if (selected) return selected;
    return new Set(
      delegatable
        .filter((p) => !wallet || p.delegatee !== wallet)
        .map(positionKey)
    );
  }, [selected, delegatable, wallet]);

  if (!isOpen) return null;

  const delegatee: Address | undefined =
    delegateeKind === "self"
      ? wallet
      : isAddress(customAddress.trim())
        ? getAddress(customAddress.trim())
        : undefined;
  const delegateeDisplay =
    delegatee && wallet && delegatee === wallet
      ? "your wallet"
      : delegatee
        ? truncateAddress(delegatee)
        : "";

  const selectedPositions = delegatable.filter((p) =>
    effectiveSelected.has(positionKey(p))
  );
  const selectedPower = selectedPositions.reduce((acc, p) => acc + p.balance, 0n);
  const canConfirm =
    !!delegatee && selectedPositions.length > 0 && step === "idle";

  const isSubmitting = step === "delegating" || step === "waiting";

  const toggle = (key: string) => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleConfirm = () => {
    if (!delegatee || selectedPositions.length === 0) return;
    delegate(selectedPositions, delegatee);
  };

  const explorerUrl = chain?.blockExplorers?.default?.url || getExplorerUrl();

  return (
    <ModalShell
      ariaLabel="Delegate voting power"
      onClose={onClose}
      backgroundColor="var(--background-primary)"
    >
      {isError ? (
        <TransactionFailedScreen
          message={error?.message || "Transaction failed"}
          onRetry={reset}
          onClose={onClose}
        />
      ) : isSuccess ? (
        <TransactionSuccessScreen
          title="Delegation Updated"
          message={
            <>
              {progress.total} position{progress.total === 1 ? "" : "s"} now
              delegate{progress.total === 1 ? "s" : ""} voting power to{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {delegateeDisplay}
              </span>
              . It becomes usable for proposals that start voting after this
              change.
            </>
          }
          txHash={txHash}
          explorerUrl={explorerUrl}
          txLabel="Last transaction"
          onClose={onClose}
        />
      ) : (
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-[20px] font-display font-normal"
              style={{ color: "var(--text-primary)" }}
            >
              Delegate Voting Power
            </h2>
            <ModalCloseButton
              onClick={() => {
                if (isSubmitting) reset();
                onClose();
              }}
            />
          </div>

          {isSubmitting ? (
            <>
              <div
                className="p-4 mb-5"
                style={{ backgroundColor: "var(--background-card)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Delegating to
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {delegateeDisplay}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Progress
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Transaction {progress.current} of {progress.total}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                  style={{
                    borderColor: "var(--text-subtle)",
                    borderTopColor: "var(--accent-primary)",
                  }}
                />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {step === "delegating"
                    ? "Confirm the delegation in your wallet…"
                    : "Waiting for confirmation…"}
                </span>
              </div>

              <button
                onClick={reset}
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
              <p
                className="text-xs leading-relaxed mb-5"
                style={{ color: "var(--text-secondary)" }}
              >
                Staked positions carry voting power. By default it is delegated
                to the rollup, which votes on your behalf. Redirect it to your
                own wallet to vote on proposals yourself, or to another address
                you trust.
              </p>

              {/* Positions */}
              <div className="mb-5">
                <label
                  className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Staked Positions
                </label>
                {isLoading ? (
                  <div
                    className="border px-4 py-3"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <div
                      className="h-4 w-full rounded animate-pulse"
                      style={{ backgroundColor: "var(--border-default)" }}
                    />
                  </div>
                ) : positions.length === 0 ? (
                  <div
                    className="border px-4 py-3 text-xs"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-muted)",
                    }}
                  >
                    No staked positions with delegatable voting power were found
                    for this wallet.
                  </div>
                ) : (
                  <div
                    className="border max-h-56 overflow-y-auto"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    {delegatable.map((p) => {
                      const key = positionKey(p);
                      const checked = effectiveSelected.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggle(key)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer border-b last:border-b-0"
                          style={{
                            borderColor: "var(--border-default)",
                            backgroundColor: checked
                              ? "rgba(212, 255, 40, 0.05)"
                              : "transparent",
                          }}
                        >
                          <div
                            className="w-4 h-4 border flex items-center justify-center shrink-0"
                            style={{
                              borderColor: checked
                                ? "var(--accent-primary)"
                                : "var(--text-subtle)",
                              backgroundColor: checked
                                ? "var(--accent-primary)"
                                : "transparent",
                            }}
                          >
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6L5 9L10 3"
                                  stroke="var(--background-primary)"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span
                              className="text-xs"
                              style={{ color: "var(--text-primary)" }}
                            >
                              Sequencer {truncateAddress(p.attester)}
                            </span>
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {instanceLabel(p)}
                              {p.route.kind === "staker" ? " · via vault Staker" : ""}
                              {" · delegated to "}
                              {currentDelegateeLabel(p, wallet)}
                            </span>
                          </div>
                          <span
                            className="text-xs font-medium shrink-0"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatVotesWithUnit(p.balance)}
                          </span>
                        </button>
                      );
                    })}
                    {locked.map((p) => (
                      <div
                        key={positionKey(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b last:border-b-0 opacity-50"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <div className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Sequencer {truncateAddress(p.attester)}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Held by your vault&apos;s Staker; by design this
                            stake stays delegated to the rollup, which votes
                            on your behalf for signalled proposals.
                          </span>
                        </div>
                        <span
                          className="text-xs font-medium shrink-0"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatVotesWithUnit(p.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {incomplete && (
                  <p
                    className="text-[10px] mt-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Some positions couldn&apos;t be loaded, so this list may be
                    incomplete.
                  </p>
                )}
              </div>

              {/* Delegatee */}
              <div className="mb-5">
                <label
                  className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Delegate To
                </label>
                <div
                  className="border"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <SourcePickerButton
                    label="My wallet (vote yourself)"
                    selected={delegateeKind === "self"}
                    onSelect={() => setDelegateeKind("self")}
                    detail={wallet ? truncateAddress(wallet) : undefined}
                  />
                  <SourcePickerButton
                    label="Another address"
                    selected={delegateeKind === "custom"}
                    onSelect={() => setDelegateeKind("custom")}
                    showDivider
                  />
                </div>
                {delegateeKind === "custom" && (
                  <div
                    className="flex items-center border border-t-0 px-4 py-2.5"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <input
                      type="text"
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      className="flex-1 bg-transparent text-xs outline-none font-mono"
                      style={{ color: "var(--text-primary)" }}
                      placeholder="0x…"
                      spellCheck={false}
                    />
                  </div>
                )}
                {delegateeKind === "custom" &&
                  customAddress.trim().length > 0 &&
                  !isAddress(customAddress.trim()) && (
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "var(--accent-secondary)" }}
                    >
                      Not a valid address
                    </p>
                  )}
                {delegateeKind === "custom" && (
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    The delegatee votes by calling the GSE contract directly.
                    Pick an address that can do that; power sent to a vault or
                    Staker contract is unusable until re-delegated.
                  </p>
                )}
              </div>

              {/* Summary */}
              <div
                className="p-4 mb-5"
                style={{ backgroundColor: "var(--background-card)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Positions
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedPositions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Voting power
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatVotesWithUnit(selectedPower)}
                  </span>
                </div>
              </div>

              {/* Timing note: power must be delegated before a proposal's
                  voting snapshot to count for it. */}
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
                  Each position is one transaction. Delegated power counts for
                  proposals that start voting after the change; proposals
                  already in voting keep their snapshot.
                </p>
              </div>

              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="w-full py-3 text-sm font-semibold tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--background-primary)",
                }}
              >
                {selectedPositions.length > 1
                  ? `Delegate (${selectedPositions.length} transactions)`
                  : "Delegate"}
              </button>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}
