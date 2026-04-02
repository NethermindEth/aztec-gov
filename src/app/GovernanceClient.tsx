"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProposalsQuery } from "@/hooks/useProposalQuery";
import { formatVotesWithUnit } from "@/lib/format";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StatsRow } from "@/components/governance/StatsRow";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { ConnectCTA } from "@/components/governance/ConnectCTA";
import { VotingPowerPanel } from "@/components/governance/VotingPowerPanel";
import { ExpandableProposalRow } from "@/components/governance/ExpandableProposalRow";
import { DepositModal } from "@/components/governance/DepositModal";
import { WithdrawModal } from "@/components/governance/WithdrawModal";
import type { ProposalsPageData } from "@/lib/types";

export type { ProposalView } from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const TAB_LABELS = ["All", "Active", "Pending", "Queued", "Executed", "Rejected", "Expired"];

// ─── Component ───────────────────────────────────────────────────────────────

interface GovernanceClientProps {
  initialData?: ProposalsPageData;
  initialPage?: number;
  initialFilter?: string;
}

export function GovernanceClient({ initialData, initialPage = 1, initialFilter = "All" }: GovernanceClientProps) {
  const { isConnected } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = searchParams.get("filter") ?? "All";
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const searchQuery = searchParams.get("q") ?? "";

  const updateParams = useCallback(
    (updates: { page?: number; filter?: string; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      const page = updates.page ?? currentPage;
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }

      const filter = updates.filter ?? activeTab;
      if (!filter || filter === "All") {
        params.delete("filter");
      } else {
        params.set("filter", filter);
      }

      const q = updates.q ?? searchQuery;
      if (!q) {
        params.delete("q");
      } else {
        params.set("q", q);
      }

      const query = params.toString();
      router.replace(query ? `?${query}` : "/", { scroll: false });
    },
    [searchParams, router, currentPage, activeTab, searchQuery]
  );

  const setCurrentPage = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const setActiveTab = useCallback(
    (filter: string) => updateParams({ filter, page: 1 }),
    [updateParams]
  );

  const setSearchQuery = useCallback(
    (q: string) => updateParams({ q, page: 1 }),
    [updateParams]
  );

  const { data, isPlaceholderData } = useProposalsQuery(
    { filter: activeTab === "All" ? undefined : activeTab, page: currentPage },
    activeTab === initialFilter && currentPage === initialPage ? initialData : undefined
  );

  const proposals = data?.proposals ?? [];
  const totalProposals = data?.totalProposals ?? 0;
  const activeCount = data?.activeCount ?? 0;
  const totalPower = data?.totalPower ?? "0";
  const totalFiltered = data?.totalFiltered ?? 0;

  const totalVotingPower = formatVotesWithUnit(BigInt(totalPower));

  // Compute tabs from tabCounts
  const tabs = useMemo(() => {
    const tabCounts = data?.tabCounts ?? {};
    return TAB_LABELS.map((label) => ({
      label,
      count: tabCounts[label] || 0,
    }));
  }, [data?.tabCounts]);

  // Client-side search filtering (search within the current page)
  const displayProposals = useMemo(() => {
    if (!searchQuery.trim()) return proposals;
    const q = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [proposals, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));

  const defaultExpandedId = useMemo(() => {
    const active = displayProposals.find((p) => p.isActive);
    return active?.id ?? null;
  }, [displayProposals]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Default to first active proposal; reset on tab, page, or search changes
  useEffect(() => {
    setExpandedId(defaultExpandedId);
  }, [activeTab, currentPage, searchQuery, defaultExpandedId]);

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "var(--background-primary)" }}
    >
      <Navbar activeLink="GOVERNANCE" />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Page header */}
        <div className="flex flex-col gap-2 mb-8">
          <h1
            className="text-2xl md:text-4xl font-light font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Governance
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            View and vote on governance proposals for the Aztec network.
          </p>
        </div>

        {/* Stats row */}
        <div className="mb-8">
          <StatsRow
            totalVotingPower={totalVotingPower}
            totalProposals={totalProposals}
            activeCount={activeCount}
          />
        </div>

        {/* Connect CTA / Voting Power */}
        <div className="mb-8">
          {isConnected ? (
            <VotingPowerPanel totalSupply={totalPower} onDeposit={() => setDepositModalOpen(true)} onWithdraw={() => setWithdrawModalOpen(true)} />
          ) : (
            <ConnectCTA />
          )}
        </div>

        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-6">
          <div className="w-full md:flex-1">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>
          <div className="w-full md:w-72 pb-px">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search proposals..."
            />
          </div>
        </div>

        {/* Proposals list */}
        <div
          className="flex flex-col gap-px"
          style={{ backgroundColor: "var(--border-default)" }}
        >
          {isPlaceholderData
            ? Array.from({ length: ITEMS_PER_PAGE }, (_, i) => (
                <div
                  key={i}
                  className="px-6 py-5 animate-pulse"
                  style={{ backgroundColor: "var(--background-primary)" }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-4 w-16 rounded"
                      style={{ backgroundColor: "var(--border-default)" }}
                    />
                    <div
                      className="h-4 w-80 rounded"
                      style={{ backgroundColor: "var(--border-default)" }}
                    />
                    <div
                      className="h-4 w-20 rounded ml-auto"
                      style={{ backgroundColor: "var(--border-default)" }}
                    />
                  </div>
                </div>
              ))
            : displayProposals.map((proposal) => (
                <ExpandableProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  isExpanded={expandedId === proposal.id}
                  onToggle={() => handleToggle(proposal.id)}
                  totalSupply={totalPower}
                />
              ))}
          {!isPlaceholderData && displayProposals.length === 0 && (
            <div
              className="px-6 py-12 text-center text-sm"
              style={{
                backgroundColor: "var(--background-primary)",
                color: "var(--text-muted)",
              }}
            >
              No proposals found.
            </div>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </main>

      <Footer />

      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        totalSupply={totalPower}
      />

      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        totalSupply={totalPower}
      />
    </div>
  );
}
