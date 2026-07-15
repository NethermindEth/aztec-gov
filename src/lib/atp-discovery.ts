import {
  getAddress,
  parseAbiItem,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import type { ATPPosition } from "./indexer";

// Every ATP factory emits ATPCreated with the beneficiary indexed, so a wallet's
// ATPs can be found by event topic alone — no need to know the factory set. The
// log's own address is the factory that minted it.
const atpCreatedEvent = parseAbiItem(
  "event ATPCreated(address indexed beneficiary, address indexed atp, uint256 allocation)"
);

const getStakerAbi = [
  {
    type: "function",
    name: "getStaker",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// Mirrors the withdrawal scan: stay under publicnode's 50k eth_getLogs cap and
// cap the lookback so a fallback can never fan out unboundedly. ATPs created
// before this window won't be recovered — the indexer (or #25) remains the
// complete source. E2E shrinks the lookback so a fallback can't saturate the
// fork RPC, matching useWithdrawals.
const CHUNK_SIZE = 49_000n;
const MAX_BLOCKS_BACK =
  process.env.NEXT_PUBLIC_E2E === "1" ? 50_000n : 2_000_000n;

/**
 * On-chain fallback for staker/ATP discovery when the indexer is unreachable.
 *
 * Scans `ATPCreated(beneficiary)` chain-wide (any of the factories may have
 * minted it), then reads `getStaker()` on each candidate. A forged ATPCreated
 * is inert: a contract without `getStaker()` drops out via `allowFailure`, and
 * one returning a junk staker only yields a 0-power row with no real
 * withdrawals. getLogs errors propagate so the caller can warn + retry rather
 * than silently treating an RPC blip as "no positions".
 */
export async function discoverHoldingsOnChain(
  client: PublicClient,
  beneficiary: Address,
  signal?: AbortSignal
): Promise<ATPPosition[]> {
  const blockNumber = await client.getBlockNumber();
  const endBlock =
    blockNumber > MAX_BLOCKS_BACK ? blockNumber - MAX_BLOCKS_BACK : 0n;

  // atp (checksummed) -> factory that emitted the creation log, de-duped across
  // chunks in case the same ATP surfaces twice.
  const factoryByAtp = new Map<string, Address>();
  for (let toBlock = blockNumber; toBlock >= endBlock; toBlock -= CHUNK_SIZE) {
    // viem requests don't take a signal, so honor cancellation between chunks.
    signal?.throwIfAborted();
    const fromBlock =
      toBlock - CHUNK_SIZE + 1n < endBlock ? endBlock : toBlock - CHUNK_SIZE + 1n;
    const logs = await client.getLogs({
      event: atpCreatedEvent,
      args: { beneficiary },
      fromBlock,
      toBlock,
    });
    for (const log of logs) {
      if (!log.args.atp) continue;
      factoryByAtp.set(getAddress(log.args.atp), getAddress(log.address));
    }
  }

  if (factoryByAtp.size === 0) return [];
  signal?.throwIfAborted();

  const atps = Array.from(factoryByAtp.keys()) as Address[];
  const stakerResults = await client.multicall({
    contracts: atps.map((atp) => ({
      address: atp,
      abi: getStakerAbi,
      functionName: "getStaker" as const,
    })),
    allowFailure: true,
  });

  const holdings: ATPPosition[] = [];
  for (let i = 0; i < atps.length; i++) {
    const r = stakerResults[i];
    if (r.status !== "success") continue;
    const staker = r.result as Address;
    if (!staker || staker === zeroAddress) continue;
    holdings.push({
      address: atps[i],
      beneficiary,
      stakerAddress: getAddress(staker),
      factoryAddress: factoryByAtp.get(atps[i])!,
      // Indexer-only metadata; unused by the UI, which reads address + staker.
      allocation: "0",
      type: "onchain",
      sequentialNumber: 0,
      timestamp: 0,
    });
  }
  return holdings;
}
