import type { Address } from "viem";
import {
  publicClient,
  governanceAddress,
  GovernanceAbi,
  PayloadAbi,
} from "./contracts";

// ─── Types ───────────────────────────────────────────────────────────────────

export enum ProposalState {
  Pending = 0,
  Active = 1,
  Queued = 2,
  Executable = 3,
  Rejected = 4,
  Executed = 5,
  Droppable = 6,
  Dropped = 7,
  Expired = 8,
}

export interface ProposalConfiguration {
  votingDelay: bigint;
  votingDuration: bigint;
  executionDelay: bigint;
  gracePeriod: bigint;
  quorum: bigint;
  voteDifferential: bigint;
  minimumVotes: bigint;
}

export interface Ballot {
  yea: bigint;
  nay: bigint;
}

export interface Proposal {
  id: bigint;
  state: ProposalState;
  config: ProposalConfiguration;
  payloadAddress: Address;
  proposerAddress: Address;
  creationTimestamp: bigint;
  ballot: Ballot;
  uri?: string;
  executionTxHash?: `0x${string}`;
}

export interface ProposalIndex {
  totalCount: number;
  totalPower: bigint;
  states: ProposalState[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTotalVotes(ballot: Ballot): bigint {
  return ballot.yea + ballot.nay;
}

export function getYeaPercentage(ballot: Ballot): number {
  const total = getTotalVotes(ballot);
  if (total === 0n) return 0;
  return Number((ballot.yea * 10000n) / total) / 100;
}

export function getNayPercentage(ballot: Ballot): number {
  const total = getTotalVotes(ballot);
  if (total === 0n) return 0;
  return Number((ballot.nay * 10000n) / total) / 100;
}

export function getPendingThrough(
  creation: bigint,
  config: ProposalConfiguration
): bigint {
  return creation + config.votingDelay;
}

export function getActiveThrough(
  creation: bigint,
  config: ProposalConfiguration
): bigint {
  return getPendingThrough(creation, config) + config.votingDuration;
}

export function getQuorumPercentage(quorum: bigint): number {
  return (Number(quorum) / 1e18) * 100;
}

export function isTerminalState(state: ProposalState): boolean {
  return [
    ProposalState.Rejected,
    ProposalState.Executed,
    ProposalState.Dropped,
    ProposalState.Expired,
  ].includes(state);
}

// ─── Execution Tx Hash ───────────────────────────────────────────────────────

async function fetchExecutionTxHash(
  proposalId: bigint
): Promise<`0x${string}` | undefined> {
  try {
    // Use a bounded block range to stay within public RPC limits (typically 50k blocks).
    // Governance contracts were deployed at block 24_658_000 on mainnet.
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 50_000n ? currentBlock - 50_000n : 0n;

    const logs = await publicClient.getLogs({
      address: governanceAddress,
      event: {
        type: "event",
        name: "ProposalExecuted",
        inputs: [
          { name: "proposalId", type: "uint256", indexed: true },
        ],
      },
      args: { proposalId },
      fromBlock,
      toBlock: "latest",
    });
    if (logs.length > 0) {
      return logs[0].transactionHash;
    }
  } catch (error) {
    console.error(`Failed to fetch execution tx for proposal ${proposalId}:`, error);
  }
  return undefined;
}

// ─── URI Cache (immutable per payload address) ──────────────────────────────

const uriCache = new Map<Address, string | undefined>();

// ─── Multicall Fetch Functions ──────────────────────────────────────────────

/**
 * Lightweight index: proposal count, total power, and all proposal states.
 * Uses 2 multicalls (2 RPC requests).
 */
export async function fetchProposalIndex(): Promise<ProposalIndex> {
  if (!governanceAddress) {
    return { totalCount: 0, totalPower: 0n, states: [] };
  }

  // Multicall 1: count + total power
  const baseResults = await publicClient.multicall({
    contracts: [
      {
        abi: GovernanceAbi,
        address: governanceAddress,
        functionName: "proposalCount",
      },
      {
        abi: GovernanceAbi,
        address: governanceAddress,
        functionName: "totalPowerNow",
      },
    ],
  });

  const count = Number(baseResults[0].result ?? 0n);
  const totalPower = (baseResults[1].result ?? 0n) as bigint;

  if (count === 0) {
    return { totalCount: 0, totalPower, states: [] };
  }

  // Multicall 2: all proposal states
  const stateContracts = Array.from({ length: count }, (_, i) => ({
    abi: GovernanceAbi,
    address: governanceAddress,
    functionName: "getProposalState" as const,
    args: [BigInt(i)] as const,
  }));

  const stateResults = await publicClient.multicall({
    contracts: stateContracts,
  });

  const states = stateResults.map(
    (r) => (r.result ?? ProposalState.Pending) as ProposalState
  );

  return { totalCount: count, totalPower, states };
}

/**
 * Fetch full proposal data for a page of IDs.
 * Uses 1-2 multicalls (getProposal batch + URI batch for uncached).
 */
export async function fetchProposalPage(
  ids: number[],
  states: ProposalState[]
): Promise<Proposal[]> {
  if (!governanceAddress || ids.length === 0) return [];

  // Multicall 1: getProposal for each id
  const proposalContracts = ids.map((id) => ({
    abi: GovernanceAbi,
    address: governanceAddress,
    functionName: "getProposal" as const,
    args: [BigInt(id)] as const,
  }));

  const proposalResults = await publicClient.multicall({
    contracts: proposalContracts,
  });

  // Parse results, collect payload addresses needing URI fetch
  interface RawData {
    configuration: ProposalConfiguration;
    payload: Address;
    creator: Address;
    creation: bigint;
    summedBallot: Ballot;
  }

  const parsed: { id: number; raw: RawData }[] = [];
  const uncachedAddresses: Address[] = [];

  for (let i = 0; i < ids.length; i++) {
    const result = proposalResults[i];
    if (result.status !== "success" || !result.result) continue;
    const raw = result.result as unknown as RawData;
    parsed.push({ id: ids[i], raw });
    if (!uriCache.has(raw.payload)) {
      uncachedAddresses.push(raw.payload);
    }
  }

  // Multicall 2: getURI for uncached payload addresses
  if (uncachedAddresses.length > 0) {
    const uriContracts = uncachedAddresses.map((addr) => ({
      abi: PayloadAbi,
      address: addr,
      functionName: "getURI" as const,
    }));

    const uriResults = await publicClient.multicall({
      contracts: uriContracts,
    });

    for (let i = 0; i < uncachedAddresses.length; i++) {
      const result = uriResults[i];
      let uri: string | undefined;
      if (result.status === "success" && result.result) {
        const raw = result.result as string;
        uri = raw.trim() === "" ? undefined : raw;
      }
      uriCache.set(uncachedAddresses[i], uri);
    }
  }

  // Build Proposal objects using states from the index
  return parsed.map(({ id, raw }) => ({
    id: BigInt(id),
    state: states[id],
    config: raw.configuration,
    payloadAddress: raw.payload,
    proposerAddress: raw.creator,
    creationTimestamp: raw.creation,
    ballot: raw.summedBallot,
    uri: uriCache.get(raw.payload),
  }));
}

/**
 * Fetch a single proposal with its state and total power.
 * Uses 1 multicall + 1 single call (for URI).
 */
export async function fetchProposalByIdWithPower(
  id: number
): Promise<{ proposal: Proposal | null; totalPower: bigint }> {
  if (!governanceAddress) return { proposal: null, totalPower: 0n };

  try {
    const results = await publicClient.multicall({
      contracts: [
        {
          abi: GovernanceAbi,
          address: governanceAddress,
          functionName: "getProposal",
          args: [BigInt(id)],
        },
        {
          abi: GovernanceAbi,
          address: governanceAddress,
          functionName: "getProposalState",
          args: [BigInt(id)],
        },
        {
          abi: GovernanceAbi,
          address: governanceAddress,
          functionName: "totalPowerNow",
        },
      ],
    });

    if (results[0].status !== "success" || !results[0].result) {
      return { proposal: null, totalPower: 0n };
    }

    const rawData = results[0].result as unknown as {
      configuration: ProposalConfiguration;
      payload: Address;
      creator: Address;
      creation: bigint;
      summedBallot: Ballot;
    };
    const currentState = (results[1].result ?? ProposalState.Pending) as ProposalState;
    const totalPower = (results[2].result ?? 0n) as bigint;

    // Get URI (check cache first)
    let uri: string | undefined;
    if (uriCache.has(rawData.payload)) {
      uri = uriCache.get(rawData.payload);
    } else {
      try {
        const rawUri = await publicClient.readContract({
          abi: PayloadAbi,
          address: rawData.payload,
          functionName: "getURI",
        });
        uri = rawUri && rawUri.trim() !== "" ? rawUri : undefined;
      } catch {
        uri = undefined;
      }
      uriCache.set(rawData.payload, uri);
    }

    // Fetch execution tx hash for executed proposals
    const executionTxHash =
      currentState === ProposalState.Executed
        ? await fetchExecutionTxHash(BigInt(id))
        : undefined;

    return {
      proposal: {
        id: BigInt(id),
        state: currentState,
        config: rawData.configuration,
        payloadAddress: rawData.payload,
        proposerAddress: rawData.creator,
        creationTimestamp: rawData.creation,
        ballot: rawData.summedBallot,
        uri,
        executionTxHash,
      },
      totalPower,
    };
  } catch (error) {
    console.error(`Failed to fetch proposal ${id}:`, error);
    return { proposal: null, totalPower: 0n };
  }
}

// ─── Standalone Helpers (used by other hooks) ───────────────────────────────

export async function fetchTotalPower(): Promise<bigint> {
  if (!governanceAddress) return 0n;

  return publicClient.readContract({
    abi: GovernanceAbi,
    address: governanceAddress,
    functionName: "totalPowerNow",
  });
}
