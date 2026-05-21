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

export function getIndexerBaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_STAKING_INDEXER_URL;
  if (!url || url.trim().length === 0) return undefined;
  return url.trim().replace(/\/+$/, "");
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
