import type { Status } from "@/components/ui/StatusBadge";
import { ProposalState } from "./governance";

export function mapStateToStatus(state: ProposalState): Status {
  switch (state) {
    case ProposalState.Active:
      return "Active";
    case ProposalState.Pending:
      return "Pending";
    case ProposalState.Queued:
    case ProposalState.Executable:
    case ProposalState.Droppable:
      return "Queued";
    case ProposalState.Executed:
      return "Executed";
    case ProposalState.Rejected:
    case ProposalState.Dropped:
      return "Rejected";
    case ProposalState.Expired:
      return "Expired";
  }
}

export function formatTimeRemaining(targetTimestamp: bigint): string {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const diff = targetTimestamp - nowSec;
  if (diff <= 0n) return "Ended";
  const totalSeconds = Number(diff);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m remaining`;
  return "< 1m remaining";
}

export function formatVotes(value: bigint): string {
  const num = Number(value) / 1e18;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  return num.toFixed(0);
}

export function formatVotesWithUnit(value: bigint): string {
  const num = Number(value) / 1e18;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M AZT`;
  if (num >= 1_000) {
    const formatted = Math.floor(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${formatted} AZT`;
  }
  return `${Math.floor(num)} AZT`;
}

export function getSummaryText(
  state: ProposalState,
  yeaPct: number,
  creationTimestamp: bigint
): string {
  const date = new Date(Number(creationTimestamp) * 1000);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (state === ProposalState.Executed) {
    return `Passed ${yeaPct.toFixed(1)}% For \u00b7 ${dateStr}`;
  }
  if (state === ProposalState.Rejected || state === ProposalState.Dropped) {
    return `Failed ${yeaPct.toFixed(1)}% For \u00b7 ${dateStr}`;
  }
  if (state === ProposalState.Expired) {
    return `Expired \u00b7 ${dateStr}`;
  }
  return dateStr;
}

export function formatDate(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateFull(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${dateStr} ${timeStr} UTC`;
}

export function truncateUrl(url: string, maxLen = 40): string {
  // Strip protocol for display
  const display = url.replace(/^https?:\/\//, "");
  if (display.length <= maxLen) return display;
  return `${display.slice(0, maxLen - 3)}...`;
}

export function truncateAddress(address: string): string {
  if (!address.startsWith("0x") || address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDuration(seconds: bigint | number): string {
  const totalSeconds = typeof seconds === "bigint" ? Number(seconds) : seconds;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0 && hours > 0) return `~${days}d ${hours}h`;
  if (days > 0) return `~${days} days`;
  if (hours > 0) return `~${hours} hours`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes > 0) return `~${minutes} minutes`;
  return `${totalSeconds}s`;
}

export function formatDelayFromTimestamp(unlocksAt: bigint): string {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const diff = unlocksAt - nowSec;
  if (diff <= 0n) return "Ready";
  return formatDuration(diff);
}

export function getExplorerUrl(): string {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
  if (chainId === 1) return "https://etherscan.io";
  return "https://sepolia.etherscan.io";
}

// ─── Amount parsing utilities ─────────────────────────────────────────────────

export function stripFormatting(input: string): string {
  return input.replace(/[,\s]/g, "");
}

export function parseAztAmount(input: string): bigint | null {
  const cleaned = stripFormatting(input.trim());
  if (!cleaned) return null;

  // Validate: digits with optional decimal portion (no signs, no scientific notation)
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const [whole, frac = ""] = cleaned.split(".");

  if (frac.length > 18) return null;

  const fracPadded = frac.padEnd(18, "0");
  const raw = BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded);

  if (raw <= 0n) return null;

  // Max: 10 billion AZT
  const MAX_AMOUNT = 10_000_000_000n * 10n ** 18n;
  if (raw > MAX_AMOUNT) return null;

  return raw;
}

export function bigintToRaw(value: bigint): string {
  if (value === 0n) return "0";
  const str = value.toString().padStart(19, "0");
  const wholeStr = str.slice(0, str.length - 18) || "0";
  const fracStr = str.slice(str.length - 18).replace(/0+$/, "");
  if (!fracStr) return wholeStr;
  const displayFrac = fracStr.length > 6 ? fracStr.slice(0, 6) : fracStr;
  return `${wholeStr}.${displayFrac}`;
}

export function formatWithCommas(raw: string): string {
  if (!raw) return "0";
  const [whole, frac] = raw.split(".");
  const n = Number(whole);
  if (isNaN(n)) return raw;
  const formatted = n.toLocaleString("en-US");
  return frac !== undefined ? `${formatted}.${frac}` : formatted;
}

// ─── Error sanitization ──────────────────────────────────────────────────────

export function sanitizeTransactionError(err: unknown): string {
  if (!(err instanceof Error)) return "Transaction failed";
  const msg = err.message.toLowerCase();

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request")
  ) {
    return "Transaction rejected by user";
  }

  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "Insufficient funds for transaction";
  }

  if (msg.includes("timed out") || msg.includes("timeout")) {
    return "Transaction timed out — check your wallet or block explorer";
  }

  if (msg.includes("nonce")) {
    return "Transaction nonce error — try resetting your wallet";
  }

  if (msg.includes("revert") || msg.includes("execution reverted")) {
    return "Transaction reverted by the contract";
  }

  if (msg.includes("network") || msg.includes("disconnected")) {
    return "Network error — check your connection";
  }

  return "Transaction failed";
}
