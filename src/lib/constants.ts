/** Polling interval (ms) for blockchain state queries */
export const REFETCH_INTERVAL = 12_000;

// GSE discovery limits, shrunk under E2E where cold anvil-fork slots are
// upstream fetches. E2E values exported separately so tests can match them.
const E2E = process.env.NEXT_PUBLIC_E2E === "1";

/** E2E-mode attesters fetched per getAttestersFromIndicesAtTime call. */
export const GSE_DISCOVERY_E2E_ATTESTER_CHUNK = 10;

/** E2E-mode cap on attester indices swept per instance (head of the set). */
export const GSE_DISCOVERY_E2E_INDEX_CAP = 100;

/** Attesters fetched per getAttestersFromIndicesAtTime call. */
export const GSE_DISCOVERY_ATTESTER_CHUNK = E2E
  ? GSE_DISCOVERY_E2E_ATTESTER_CHUNK
  : 500;

/** Attester indices swept per instance. */
export const GSE_DISCOVERY_INDEX_CAP = E2E
  ? GSE_DISCOVERY_E2E_INDEX_CAP
  : Number.MAX_SAFE_INTEGER;

/** Calldata bytes per aggregate3 chunk in discovery multicalls. */
export const GSE_DISCOVERY_MULTICALL_BATCH_BYTES = E2E ? 1_024 : 8_192;

/** Slower polling when all proposals are terminal */
export const SLOW_REFETCH_INTERVAL = 60_000;

/** Number of proposals per page */
export const ITEMS_PER_PAGE = 10;

/** Debounce (ms) before a search keystroke is mirrored to the URL */
export const SEARCH_DEBOUNCE_MS = 300;

/** Timeout for waitForTransactionReceipt calls (ms) */
export const TX_RECEIPT_TIMEOUT = 300_000;
