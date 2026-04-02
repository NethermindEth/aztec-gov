/** Polling interval (ms) for blockchain state queries */
export const REFETCH_INTERVAL = 12_000;

/** Slower polling when all proposals are terminal */
export const SLOW_REFETCH_INTERVAL = 60_000;

/** Number of proposals per page */
export const ITEMS_PER_PAGE = 10;

/** Timeout for waitForTransactionReceipt calls (ms) */
export const TX_RECEIPT_TIMEOUT = 300_000;
