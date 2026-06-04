"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Invalidates wagmi readContract/readContracts queries after a tx.
// Withdrawal log scans are not touched; use useInvalidateWithdrawals for those.
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
