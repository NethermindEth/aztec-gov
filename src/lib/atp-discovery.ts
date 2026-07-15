import {
  getAddress,
  parseAbiItem,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import { atpFactories } from "./config";
import { scanEventLogs } from "./log-scan";
import type { ATPPosition } from "./indexer";

// Emitted by every ATP factory; the wallet's ATPs are indexed by beneficiary.
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

export interface OnChainDiscovery {
  holdings: ATPPosition[];
  /** True when entries may be missing: failed chunks, bounded lookback, or a partial factory list. */
  incomplete: boolean;
}

// Indexer-outage fallback: trusted factories' ATPCreated logs, then getStaker() per candidate.
export async function discoverHoldingsOnChain(
  client: PublicClient,
  beneficiary: Address,
  signal?: AbortSignal
): Promise<OnChainDiscovery> {
  // Restricting getLogs to the trusted factory set keeps forged ATPCreated events (arbitrary emitters) out.
  const { logs, incomplete: scanIncomplete, exhaustive } = await scanEventLogs(
    client,
    {
      event: atpCreatedEvent,
      argsList: [{ beneficiary }],
      address: atpFactories,
      signal,
      onChunkError: (err, fromBlock, toBlock) =>
        console.warn(`atp-discovery: getLogs failed for ${fromBlock}-${toBlock}`, err),
    }
  );

  // A bounded lookback plus a hand-maintained factory list can miss ATPs, so flag it.
  const incomplete = scanIncomplete || !exhaustive;

  // atp (checksummed) -> emitting factory, de-duped across chunks.
  const factoryByAtp = new Map<string, Address>();
  for (const log of logs) {
    if (!log.args.atp) continue;
    factoryByAtp.set(getAddress(log.args.atp), getAddress(log.address));
  }
  if (factoryByAtp.size === 0) return { holdings: [], incomplete };

  signal?.throwIfAborted();
  const atps = Array.from(factoryByAtp.keys()) as Address[];
  let stakerResults;
  try {
    stakerResults = await client.multicall({
      contracts: atps.map((atp) => ({
        address: atp,
        abi: getStakerAbi,
        functionName: "getStaker" as const,
      })),
      allowFailure: true,
    });
  } catch (err) {
    // Partial-tolerance over all-or-nothing: report nothing found but flagged, not a hard error.
    console.warn("atp-discovery: getStaker multicall failed", err);
    return { holdings: [], incomplete: true };
  }

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
      // Indexer-only metadata; the UI reads address + stakerAddress.
      allocation: "0",
      type: "onchain",
      sequentialNumber: 0,
      timestamp: 0,
    });
  }
  return { holdings, incomplete };
}
