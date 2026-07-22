"use client";

import { useMemo, useCallback, useState, useEffect, useRef, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProposalsQuery } from "@/hooks/useProposalQuery";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { formatVotesWithUnit } from "@/lib/format";
import { ITEMS_PER_PAGE, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StatsRow } from "@/components/governance/StatsRow";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { RetryButton } from "@/components/ui/RetryButton";
import { ConnectCTA } from "@/components/governance/ConnectCTA";
import { VotingPowerPanel } from "@/components/governance/VotingPowerPanel";
import { ExpandableProposalRow } from "@/components/governance/ExpandableProposalRow";
import { DepositModal } from "@/components/governance/DepositModal";
import { WithdrawModal } from "@/components/governance/WithdrawModal";
import {
  useInvalidateUserData,
  useInvalidateWithdrawals,
} from "@/hooks/useInvalidateUserData";
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
  const urlQuery = searchParams.get("q") ?? "";

  // Local input drives typing and filtering so keystrokes never wait on a
  // router navigation; the URL is mirrored on a debounce for share/reload.
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const lastWrittenQuery = useRef(urlQuery);
  // Latest search read from a ref so updateParams stays stable while typing.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

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

      // A tab/page change with no explicit q commits the current search text.
      const q = updates.q ?? searchQueryRef.current;
      if (!q) {
        params.delete("q");
      } else {
        params.set("q", q);
      }

      const query = params.toString();
      router.replace(query ? `?${query}` : "/", { scroll: false });
    },
    [searchParams, router, currentPage, activeTab]
  );

  const setCurrentPage = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const setActiveTab = useCallback(
    (filter: string) => updateParams({ filter, page: 1 }),
    [updateParams]
  );

  const [writeSearchQuery, cancelSearchQueryWrite] = useDebouncedCallback(
    (q: string) => {
      lastWrittenQuery.current = q;
      // Non-urgent: let the input/filter stay responsive while the RSC segment re-renders.
      startTransition(() => updateParams({ q, page: 1 }));
    },
    SEARCH_DEBOUNCE_MS
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      // From a deeper page, jump to page 1 at once so the filter runs over
      // page-1 data; otherwise mirror to the URL on a debounce.
      if (currentPage > 1) {
        cancelSearchQueryWrite();
        lastWrittenQuery.current = q;
        startTransition(() => updateParams({ q, page: 1 }));
      } else {
        writeSearchQuery(q);
      }
    },
    [currentPage, updateParams, writeSearchQuery, cancelSearchQueryWrite]
  );

  useEffect(() => {
    // Adopt the URL only on external changes (back/forward, shared link), and
    // cancel any pending self-write so a stale keystroke can't clobber it.
    if (urlQuery !== lastWrittenQuery.current) {
      cancelSearchQueryWrite();
      lastWrittenQuery.current = urlQuery;
      setSearchQuery(urlQuery);
    }
  }, [urlQuery, cancelSearchQueryWrite]);

  const { data, isPlaceholderData, isError, refetch } = useProposalsQuery(
    { filter: activeTab === "All" ? undefined : activeTab, page: currentPage },
    activeTab === initialFilter && currentPage === initialPage ? initialData : undefined
  );

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
    const proposals = data?.proposals ?? [];
    if (!searchQuery.trim()) return proposals;
    const q = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [data?.proposals, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));

  const defaultExpandedId = useMemo(() => {
    const active = displayProposals.find((p) => p.isActive);
    return active?.id ?? null;
  }, [displayProposals]);
  const defaultExpandedIdRef = useRef(defaultExpandedId);
  defaultExpandedIdRef.current = defaultExpandedId;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const invalidateUserData = useInvalidateUserData();
  const invalidateWithdrawals = useInvalidateWithdrawals();
  const handleWithdrawSuccess = useCallback(() => {
    invalidateUserData();
    invalidateWithdrawals();
  }, [invalidateUserData, invalidateWithdrawals]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Default-expand the first active proposal on tab/page change only, so typing
  // in search doesn't re-expand a row the user just collapsed.
  useEffect(() => {
    setExpandedId(defaultExpandedIdRef.current);
  }, [activeTab, currentPage]);

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
              onChange={handleSearchChange}
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
          {/* An errored fetch with nothing cached gets a retry, not the misleading empty-chain copy. */}
          {!isPlaceholderData && displayProposals.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm"
              style={{
                backgroundColor: "var(--background-primary)",
                color: "var(--text-muted)",
              }}
            >
              {isError ? (
                <>
                  <span>Couldn&apos;t load proposals. Check your connection and try again.</span>
                  <RetryButton onRetry={refetch} />
                </>
              ) : (
                <span>No proposals found.</span>
              )}
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
        onDepositSuccess={invalidateUserData}
      />

      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        totalSupply={totalPower}
        onWithdrawSuccess={handleWithdrawSuccess}
      />
    </div>
  );
}
