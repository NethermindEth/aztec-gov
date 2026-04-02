import { StatCard } from "@/components/ui/StatCard";

interface StatsRowProps {
  totalVotingPower: string;
  totalProposals: number;
  activeCount: number;
}

export function StatsRow({
  totalVotingPower,
  totalProposals,
  activeCount,
}: StatsRowProps) {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 gap-px border"
      style={{
        backgroundColor: "var(--border-default)",
        borderColor: "var(--border-default)",
      }}
    >
      <StatCard label="Total Voting Power" value={totalVotingPower} />
      <StatCard label="Total Proposals" value={String(totalProposals)} />
      <StatCard
        label="Active Proposals"
        value={String(activeCount)}
        accentValue
      />
    </div>
  );
}
