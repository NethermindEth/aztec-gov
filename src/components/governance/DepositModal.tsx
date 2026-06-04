"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useReadContract } from "wagmi";
import { getAddress, type Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { useVotingPower } from "@/hooks/useVotingPower";
import { useDeposit, type DepositStep } from "@/hooks/useDeposit";
import { useUserStakers } from "@/hooks/useUserStakers";
import { useATPBalances } from "@/hooks/useATPBalances";
import {
  ERC20Abi,
  governanceAddress,
  stakingAssetAddress,
} from "@/lib/contracts";
import {
  formatVotesWithUnit,
  getExplorerUrl,
  parseAztAmount,
  bigintToRaw,
  formatWithCommas,
  truncateAddress,
} from "@/lib/format";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSupply: string;
  onDepositSuccess?: () => void;
}

type DepositSource =
  | { kind: "direct" }
  | { kind: "staker"; atp: Address; staker: Address };

function sourceKey(source: DepositSource): string {
  return source.kind === "direct" ? "direct" : `staker:${source.atp}`;
}

function getButtonLabel(step: DepositStep, needsApprove: boolean): string {
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
      return needsApprove ? "Approve & Deposit (2 txs)" : "Deposit (1 tx)";
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
  const { holdings } = useUserStakers(address);
  const atpAddresses = useMemo(
    () => holdings.map((h) => getAddress(h.address)),
    [holdings]
  );
  const {
    balances: atpBalances,
    operators: atpOperators,
    isLoading: atpInfoLoading,
  } = useATPBalances(atpAddresses);
  const { deposit, step, txHash, isPending, isSuccess, isError, error, reset } =
    useDeposit();

  // Direct is always listed (even at 0 wallet AZT) so the picker is stable.
  // Unknown operator (still loading) leaves operatorMismatch=false and falls
  // back to the on-chain revert if the wallet truly isn't the operator.
  const availableSources = useMemo<
    {
      source: DepositSource;
      power: bigint;
      label: string;
      operatorMismatch: boolean;
    }[]
  >(() => {
    const list: {
      source: DepositSource;
      power: bigint;
      label: string;
      operatorMismatch: boolean;
    }[] = [
      {
        source: { kind: "direct" },
        power: votingPower.walletBalance,
        label: "Wallet (Direct)",
        operatorMismatch: false,
      },
    ];
    for (const h of holdings) {
      const atp = getAddress(h.address);
      const balance = atpBalances.get(atp) ?? 0n;
      const operator = atpOperators.get(atp);
      const operatorMismatch =
        !!operator && !!address && operator !== getAddress(address);
      list.push({
        source: { kind: "staker", atp, staker: getAddress(h.stakerAddress) },
        power: balance,
        label: `Vault ${truncateAddress(atp)}`,
        operatorMismatch,
      });
    }
    return list;
  }, [votingPower.walletBalance, holdings, atpBalances, atpOperators, address]);

  const [source, setSource] = useState<DepositSource>({ kind: "direct" });
  const [amountInput, setAmountInput] = useState("");
  // Exact bigint stashed by MAX so display truncation doesn't strand dust.
  // Cleared on type or source switch.
  const [maxOverride, setMaxOverride] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<"form" | "success">("form");
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPhase("form");
      setMaxOverride(null);
      reset();
      hasInitialized.current = false;
    }
  }, [isOpen, reset]);

  // Auto-pick the highest-balance source on open. Waits for both loads to
  // avoid latching onto "Direct (0 AZT)" before vault balances arrive.
  useEffect(() => {
    if (
      !isOpen ||
      votingPower.isLoading ||
      atpInfoLoading ||
      hasInitialized.current
    )
      return;
    const eligible = availableSources.filter((s) => !s.operatorMismatch);
    const best = [...eligible].sort((a, b) =>
      a.power > b.power ? -1 : a.power < b.power ? 1 : 0
    )[0];
    if (best) {
      setSource(best.source);
      setAmountInput(formatWithCommas(bigintToRaw(best.power)));
      setMaxOverride(best.power);
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    votingPower.isLoading,
    votingPower.walletBalance,
    atpBalances,
    atpInfoLoading,
  ]);

  const selectedPower = useMemo(() => {
    if (source.kind === "staker") return atpBalances.get(source.atp) ?? 0n;
    return votingPower.walletBalance;
  }, [source, atpBalances, votingPower.walletBalance]);

  // Drives the button label ("Deposit (1 tx)" vs "Approve & Deposit (2 txs)").
  // useDeposit reads the same allowance internally to skip approve when covered.
  const allowanceOwner = source.kind === "staker" ? source.atp : address;
  const allowanceSpender =
    source.kind === "staker" ? source.staker : governanceAddress;
  const { data: currentAllowance } = useReadContract({
    address: stakingAssetAddress,
    abi: ERC20Abi,
    functionName: "allowance",
    args:
      allowanceOwner && allowanceSpender
        ? [allowanceOwner, allowanceSpender]
        : undefined,
    query: { enabled: !!allowanceOwner && !!allowanceSpender },
  });

  useEffect(() => {
    if (isSuccess && txHash) {
      onDepositSuccess?.();
      setPhase("success");
    }
  }, [isSuccess, txHash, onDepositSuccess]);

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

  const parsedAmount = parseAztAmount(amountInput);
  // Prefer the MAX-captured bigint so display truncation doesn't lose wei.
  const effectiveAmount = maxOverride ?? parsedAmount;
  const isValidAmount =
    effectiveAmount !== null &&
    effectiveAmount > 0n &&
    effectiveAmount <= selectedPower;
  const needsApprove =
    effectiveAmount !== null &&
    (currentAllowance == null ||
      (currentAllowance as bigint) < effectiveAmount);

  const handleMax = () => {
    setAmountInput(formatWithCommas(bigintToRaw(selectedPower)));
    setMaxOverride(selectedPower);
  };

  const handleAmountInputChange = (value: string) => {
    setAmountInput(value);
    setMaxOverride(null);
  };

  const handleSourceChange = (next: DepositSource) => {
    setSource(next);
    // Clears any value that was valid against the old source but not the new.
    setAmountInput("");
    setMaxOverride(null);
  };

  const handleConfirm = () => {
    if (!effectiveAmount || !isValidAmount || !address) return;
    if (source.kind === "staker") {
      deposit(effectiveAmount, address, {
        kind: "staker",
        atp: source.atp,
        staker: source.staker,
      });
    } else {
      deposit(effectiveAmount, address);
    }
  };

  const showPicker = availableSources.length > 1;

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
        role="dialog"
        aria-modal="true"
        aria-label="Deposit AZT"
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

            {/* Transaction Stepper, shown during progress */}
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
                {showPicker && (
                  <div className="mb-5">
                    <label
                      className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Deposit From
                    </label>
                    <div
                      className="border overflow-hidden"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      {availableSources.map((entry, i) => {
                        const key = sourceKey(entry.source);
                        const selected = sourceKey(source) === key;
                        const disabled =
                          entry.power === 0n || entry.operatorMismatch;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              !disabled && handleSourceChange(entry.source)
                            }
                            disabled={disabled}
                            title={
                              entry.operatorMismatch
                                ? "Operator was reassigned. This wallet cannot drive this vault."
                                : undefined
                            }
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                              backgroundColor: selected
                                ? "rgba(212, 255, 40, 0.05)"
                                : "transparent",
                              borderTop:
                                i > 0
                                  ? "1px solid var(--border-default)"
                                  : undefined,
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                                style={{
                                  borderColor: selected
                                    ? "var(--accent-primary)"
                                    : "var(--text-subtle)",
                                }}
                              >
                                {selected && (
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: "var(--accent-primary)",
                                    }}
                                  />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span
                                  className="text-sm truncate"
                                  style={{
                                    color: selected
                                      ? "var(--text-primary)"
                                      : "var(--text-secondary)",
                                  }}
                                >
                                  {entry.label}
                                </span>
                                {entry.operatorMismatch && (
                                  <span
                                    className="text-[10px]"
                                    style={{ color: "var(--accent-secondary)" }}
                                  >
                                    Operator reassigned
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className="text-xs shrink-0"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {formatVotesWithUnit(entry.power)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Available
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatVotesWithUnit(selectedPower)}
                    </span>
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
                      onChange={(e) => handleAmountInputChange(e.target.value)}
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
                  {parsedAmount !== null && parsedAmount > selectedPower && (
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "var(--accent-secondary)" }}
                    >
                      Exceeds available balance for this source
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
                  {getButtonLabel(step, needsApprove)}
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
