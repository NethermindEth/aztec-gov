"use client";

import { useCallback, useState } from "react";
import { parseAztAmount, bigintToRaw, formatWithCommas } from "@/lib/format";

// MAX stashes the exact bigint so display truncation doesn't strand dust wei.
export function useMaxAmount(selectedPower: bigint) {
  const [amountInput, setAmountInput] = useState("");
  const [maxOverride, setMaxOverride] = useState<bigint | null>(null);

  const parsedAmount = parseAztAmount(amountInput);
  const effectiveAmount = maxOverride ?? parsedAmount;
  const isValidAmount =
    effectiveAmount !== null &&
    effectiveAmount > 0n &&
    effectiveAmount <= selectedPower;

  const setToExact = useCallback((power: bigint) => {
    setAmountInput(formatWithCommas(bigintToRaw(power)));
    setMaxOverride(power);
  }, []);

  const handleMax = () => setToExact(selectedPower);

  const handleAmountInputChange = (value: string) => {
    setAmountInput(value);
    setMaxOverride(null);
  };

  const clearAmount = useCallback(() => {
    setAmountInput("");
    setMaxOverride(null);
  }, []);

  const clearMaxOverride = useCallback(() => {
    setMaxOverride(null);
  }, []);

  return {
    amountInput,
    parsedAmount,
    effectiveAmount,
    isValidAmount,
    handleMax,
    handleAmountInputChange,
    setToExact,
    clearAmount,
    clearMaxOverride,
  };
}
