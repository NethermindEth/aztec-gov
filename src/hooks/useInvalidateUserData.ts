"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Invalidates wagmi readContract/readContracts queries (balances, powers,
// allowances) after a position-changing tx. The withdrawal log scan keyed
// under "governance-withdrawals" is intentionally NOT touched; use
// useInvalidateWithdrawals for that. The hardcoded root strings are wagmi v2
// internals; the e2e integration suite is the canary on upgrades.
export function useInvalidateUserData() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return root === "readContract" || root === "readContracts";
      },
    });
  }, [queryClient]);
}

// Invalidates the governance withdrawal log scan so a new entry surfaces immediately.
export function useInvalidateWithdrawals() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["governance-withdrawals"] });
  }, [queryClient]);
}
