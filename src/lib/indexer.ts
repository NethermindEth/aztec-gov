import type { Address } from "viem";

export interface ATPPosition {
  address: Address;
  beneficiary: Address;
  allocation: string;
  type: string;
  stakerAddress: Address;
  factoryAddress: Address;
  sequentialNumber: number;
  timestamp: number;
  totalWithdrawn?: string;
  totalSlashed?: string;
  withdrawalTimestamp?: number | null;
}

export class IndexerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexerError";
  }
}

const DEFAULT_INDEXER_URL_BY_CHAIN: Record<number, string> = {
  1: "https://dgk9duhuxabbq.cloudfront.net",
  11155111: "https://d1lzkj24db7400.cloudfront.net",
};

export function getIndexerBaseUrl(): string | undefined {
  const override = process.env.NEXT_PUBLIC_STAKING_INDEXER_URL;
  if (override && override.trim().length > 0) return override.trim().replace(/\/+$/, "");
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
  return DEFAULT_INDEXER_URL_BY_CHAIN[chainId];
}

export async function fetchBeneficiaryHoldings(
  baseUrl: string,
  beneficiary: Address,
  signal?: AbortSignal
): Promise<ATPPosition[]> {
  const url = `${baseUrl}/api/atp/beneficiary/${beneficiary}`;
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new IndexerError(`Failed to reach staking indexer at ${url}`);
  }

  if (!response.ok) {
    throw new IndexerError(
      `Staking indexer returned ${response.status} for ${url}`
    );
  }

  let payload: { data?: ATPPosition[] };
  try {
    payload = (await response.json()) as { data?: ATPPosition[] };
  } catch {
    throw new IndexerError("Staking indexer returned invalid JSON");
  }

  return payload.data ?? [];
}
