import { truncateAddress, getExplorerUrl } from "@/lib/format";

interface EtherscanLinkProps {
  address?: string;
  txHash?: string;
  truncate?: boolean;
  /** When true, renders a <span> instead of <a> to avoid nested-anchor hydration errors. */
  inline?: boolean;
}

export function EtherscanLink({
  address,
  txHash,
  truncate = true,
  inline = false,
}: EtherscanLinkProps) {
  const value = address || txHash || "";
  const explorerUrl = getExplorerUrl();
  const path = txHash ? "tx" : "address";
  const href = `${explorerUrl}/${path}/${value}`;
  const display = truncate ? truncateAddress(value) : value;

  if (inline) {
    return (
      <span
        role="link"
        tabIndex={0}
        className="hover:underline cursor-pointer"
        style={{ color: "var(--text-secondary)" }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(href, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }}
      >
        {display}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
      style={{ color: "var(--text-secondary)" }}
    >
      {display}
    </a>
  );
}
