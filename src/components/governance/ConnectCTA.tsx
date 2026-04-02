import { WalletButton } from "@/components/ui/WalletButton";

export function ConnectCTA() {
  return (
    <div
      className="flex flex-col md:flex-row items-center md:justify-between px-4 md:px-6 py-4 md:py-5 border gap-3 md:gap-0"
      style={{
        backgroundColor: "var(--background-subtle)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="flex flex-col gap-1 text-center md:text-left">
        <h3
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Connect your wallet to vote
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Connect your wallet to participate in governance and cast your vote on
          active proposals.
        </p>
      </div>
      <WalletButton />
    </div>
  );
}
