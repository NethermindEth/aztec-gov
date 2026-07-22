"use client";

import { useCallback, useEffect, useRef } from "react";

// Returns a stable [run, cancel] pair. `run` invokes the latest `callback`
// only after `delay` ms pass without another call; `cancel` drops a pending
// call (used when an external change should win). Cleans up on unmount.
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number
): [run: (...args: Args) => void, cancel: () => void] {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (...args: Args) => {
      cancel();
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay, cancel]
  );

  return [run, cancel];
}
