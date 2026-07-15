import type { AbiEvent, Address, GetLogsReturnType, PublicClient } from "viem";

// Stays under public RPC eth_getLogs caps (publicnode allows 50k blocks).
export const LOG_SCAN_CHUNK_SIZE = 49_000n;

// ~277 days at 12s blocks; E2E shrinks the lookback so fork RPCs aren't saturated.
export const LOG_SCAN_MAX_BLOCKS_BACK =
  process.env.NEXT_PUBLIC_E2E === "1" ? 50_000n : 2_000_000n;

export interface LogScanResult<TLog> {
  logs: TLog[];
  /** True when at least one chunk failed, so logs may be partial. */
  incomplete: boolean;
  /** True when the scan reached genesis, i.e. nothing predates the window. */
  exhaustive: boolean;
}

interface ScanOptions<TEvent extends AbiEvent> {
  event: TEvent;
  /** One getLogs per entry per chunk, run concurrently within the chunk. */
  argsList: readonly Record<string, unknown>[];
  address?: Address | Address[];
  lookback?: bigint;
  chunkSize?: bigint;
  signal?: AbortSignal;
  onChunkError?: (err: unknown, fromBlock: bigint, toBlock: bigint) => void;
}

// Chunked event-log scan; failed chunks are skipped and flagged via `incomplete`, never thrown.
export async function scanEventLogs<TEvent extends AbiEvent>(
  client: PublicClient,
  {
    event,
    argsList,
    address,
    lookback = LOG_SCAN_MAX_BLOCKS_BACK,
    chunkSize = LOG_SCAN_CHUNK_SIZE,
    signal,
    onChunkError,
  }: ScanOptions<TEvent>
): Promise<LogScanResult<GetLogsReturnType<TEvent>[number]>> {
  const blockNumber = await client.getBlockNumber();
  const endBlock = blockNumber > lookback ? blockNumber - lookback : 0n;

  const logs: GetLogsReturnType<TEvent> = [];
  let incomplete = false;

  for (let toBlock = blockNumber; toBlock >= endBlock; toBlock -= chunkSize) {
    // viem requests don't take a signal, so honor cancellation between chunks.
    signal?.throwIfAborted();
    const fromBlock =
      toBlock - chunkSize + 1n < endBlock ? endBlock : toBlock - chunkSize + 1n;
    const perArgs = await Promise.all(
      argsList.map((args) =>
        client
          .getLogs({
            address,
            event,
            args: args as never,
            fromBlock,
            toBlock,
            strict: true,
          })
          .catch((err) => {
            onChunkError?.(err, fromBlock, toBlock);
            incomplete = true;
            return [];
          })
      )
    );
    for (const chunkLogs of perArgs) {
      logs.push(...(chunkLogs as GetLogsReturnType<TEvent>));
    }
  }

  return { logs, incomplete, exhaustive: endBlock === 0n };
}
