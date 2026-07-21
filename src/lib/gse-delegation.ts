import { getAddress, type Address, type PublicClient } from "viem";
import { GSEAbi, StakerAbi, RegistryAbi } from "./contracts";
import {
  GSE_DISCOVERY_ATTESTER_CHUNK,
  GSE_DISCOVERY_INDEX_CAP,
  GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
} from "./constants";

// direct: wallet is withdrawer, calls GSE.delegate. staker: the ATP operator
// calls Staker.delegate(version). locked: staker-held stake this app can't reach.
export type DelegationRoute =
  | { kind: "direct" }
  | { kind: "staker"; staker: Address; version: bigint }
  | { kind: "locked"; staker: Address };

export interface DelegationPosition {
  /** Rollup instance the stake sits under, or the bonus instance address. */
  instance: Address;
  attester: Address;
  withdrawer: Address;
  /** Staked balance = voting power this position carries (1:1). */
  balance: bigint;
  /** Current delegatee; defaults to `instance` at deposit, zero = none. */
  delegatee: Address;
  /** True when the stake follows the latest rollup (bonus instance). */
  isBonus: boolean;
  route: DelegationRoute;
}

export interface DelegationDiscovery {
  positions: DelegationPosition[];
  /** True when some reads failed, so positions may be missing. */
  incomplete: boolean;
}

/** Who a position's power currently goes to, for display purposes. */
export type DelegateeClass = "default" | "self" | "none" | "other";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Registry sanity cap; mainnet has a handful of rollup versions at most.
const MAX_REGISTRY_VERSIONS = 32n;

export function positionKey(p: DelegationPosition): string {
  return `${p.instance}|${p.attester}`;
}

export function classifyDelegatee(
  p: DelegationPosition,
  wallet?: Address
): DelegateeClass {
  if (p.delegatee === p.instance) return "default";
  if (wallet && p.delegatee === wallet) return "self";
  if (p.delegatee === ZERO_ADDRESS) return "none";
  return "other";
}

// A candidate row before its route is known.
interface StakeRow {
  instance: Address;
  attester: Address;
  withdrawer: Address;
  balance: bigint;
  delegatee: Address;
  isBonus: boolean;
}

// Finds every GSE stake whose withdrawer is `wallet` or one of its Stakers, by
// enumerating current attester sets (deposit logs predate public RPC history).
export async function discoverDelegations(
  client: PublicClient,
  gseAddress: Address,
  wallet: Address,
  stakers: Address[],
  signal?: AbortSignal
): Promise<DelegationDiscovery> {
  const walletKey = getAddress(wallet);
  const owners = new Set<string>([walletKey, ...stakers.map((s) => getAddress(s))]);
  const gse = { address: gseAddress, abi: GSEAbi } as const;
  let incomplete = false;

  const [ts, bonus, latest] = await Promise.all([
    client.getBlock().then((b) => b.timestamp),
    client
      .readContract({ ...gse, functionName: "getBonusInstanceAddress" })
      .then((a) => getAddress(a))
      .catch(() => undefined),
    client
      .readContract({ ...gse, functionName: "getLatestRollup" })
      .then((a) => getAddress(a))
      .catch(() => undefined),
  ]);
  const instances = [...new Set([bonus, latest].filter(Boolean))] as Address[];
  if (instances.length === 0) {
    // Both base reads failing means no GSE lives at the given address (e.g.
    // a plain-anvil dev chain with mock governance); nothing to report.
    console.warn("gse-delegation: GSE unreachable at", gseAddress);
    return { positions: [], incomplete: false };
  }
  incomplete = bonus === undefined || latest === undefined;

  signal?.throwIfAborted();
  const [supplies, mergedCounts] = await Promise.all([
    client.multicall({
      contracts: instances.map((instance) => ({
        ...gse,
        functionName: "supplyOf" as const,
        args: [instance] as const,
      })),
      allowFailure: true,
      batchSize: GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
    }),
    client.multicall({
      contracts: instances.map((instance) => ({
        ...gse,
        functionName: "getAttesterCountAtTime" as const,
        args: [instance, ts] as const,
      })),
      allowFailure: true,
      batchSize: GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
    }),
  ]);

  const attesters = await enumerateAttesters(client, gse.address, {
    instances,
    supplies: supplies.map((r) => (r.status === "success" ? r.result : undefined)),
    mergedCounts: mergedCounts.map((r) =>
      r.status === "success" ? Number(r.result) : undefined
    ),
    bonus,
    latest,
    ts,
    onGap: () => {
      incomplete = true;
    },
    signal,
  });
  if (attesters.length === 0) return { positions: [], incomplete };

  signal?.throwIfAborted();
  // Keep only pairs whose withdrawer is the wallet or one of its Stakers.
  const withdrawerReads = await client.multicall({
    contracts: attesters.map(({ attester }) => ({
      ...gse,
      functionName: "getWithdrawer" as const,
      args: [attester] as const,
    })),
    allowFailure: true,
    batchSize: GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
  });
  const candidates: { instance: Address; attester: Address; withdrawer: Address }[] = [];
  for (let i = 0; i < attesters.length; i++) {
    const read = withdrawerReads[i];
    if (read.status !== "success") {
      incomplete = true;
      continue;
    }
    const withdrawer = getAddress(read.result);
    if (owners.has(withdrawer)) candidates.push({ ...attesters[i], withdrawer });
  }
  if (candidates.length === 0) return { positions: [], incomplete };

  signal?.throwIfAborted();
  const [balances, delegatees] = await Promise.all([
    client.multicall({
      contracts: candidates.map(({ instance, attester }) => ({
        ...gse,
        functionName: "balanceOf" as const,
        args: [instance, attester] as const,
      })),
      allowFailure: true,
      batchSize: GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
    }),
    client.multicall({
      contracts: candidates.map(({ instance, attester }) => ({
        ...gse,
        functionName: "getDelegatee" as const,
        args: [instance, attester] as const,
      })),
      allowFailure: true,
      batchSize: GSE_DISCOVERY_MULTICALL_BATCH_BYTES,
    }),
  ]);

  const rows: StakeRow[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const balance = balances[i];
    const delegatee = delegatees[i];
    if (balance.status !== "success" || delegatee.status !== "success") {
      incomplete = true;
      continue;
    }
    if (balance.result === 0n) continue;
    rows.push({
      ...candidates[i],
      balance: balance.result,
      delegatee: getAddress(delegatee.result),
      isBonus: bonus !== undefined && candidates[i].instance === bonus,
    });
  }

  const stakerVersions = await resolveStakerRollupVersions(
    client,
    rows.filter((row) => row.withdrawer !== walletKey && !row.isBonus),
    signal
  );

  const positions = rows.map((row) => ({
    ...row,
    route: buildRoute(row, walletKey, stakerVersions),
  }));
  return { positions, incomplete };
}

interface EnumerationInput {
  instances: Address[];
  supplies: (bigint | undefined)[];
  mergedCounts: (number | undefined)[];
  bonus?: Address;
  latest?: Address;
  ts: bigint;
  onGap: () => void;
  signal?: AbortSignal;
}

// Walks each instance's attester set, skipping zero-supply instances (no
// balance > 0 possible there); see the merged-view note on the count math below.
async function enumerateAttesters(
  client: PublicClient,
  gseAddress: Address,
  { instances, supplies, mergedCounts, bonus, latest, ts, onGap, signal }: EnumerationInput
): Promise<{ instance: Address; attester: Address }[]> {
  const gse = { address: gseAddress, abi: GSEAbi } as const;
  const bonusCount =
    bonus !== undefined ? mergedCounts[instances.indexOf(bonus)] ?? 0 : 0;

  const pairs: { instance: Address; attester: Address }[] = [];
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    const supply = supplies[i];
    const mergedCount = mergedCounts[i];
    if (supply === undefined || mergedCount === undefined) {
      onGap();
      continue;
    }
    if (supply === 0n) continue;

    // The latest rollup's view is merged ([...own, ...bonus]); the bonus tail
    // is already walked under the bonus instance itself.
    let ownCount = mergedCount;
    if (instance === latest && instance !== bonus) ownCount -= bonusCount;
    const count = Math.min(Math.max(ownCount, 0), GSE_DISCOVERY_INDEX_CAP);

    const chunks: bigint[][] = [];
    for (let from = 0; from < count; from += GSE_DISCOVERY_ATTESTER_CHUNK) {
      chunks.push(
        Array.from(
          { length: Math.min(GSE_DISCOVERY_ATTESTER_CHUNK, count - from) },
          (_, offset) => BigInt(from + offset)
        )
      );
    }
    signal?.throwIfAborted();
    const results = await Promise.all(
      chunks.map((indices) =>
        client
          .readContract({
            ...gse,
            functionName: "getAttestersFromIndicesAtTime",
            args: [instance, ts, indices],
          })
          .catch((err) => {
            console.warn("gse-delegation: attester enumeration chunk failed", err);
            onGap();
            return [] as readonly Address[];
          })
      )
    );
    for (const chunk of results) {
      for (const attester of chunk) {
        pairs.push({ instance, attester: getAddress(attester) });
      }
    }
  }
  return pairs;
}

function buildRoute(
  row: StakeRow,
  wallet: Address,
  stakerVersions: Map<string, bigint>
): DelegationRoute {
  if (row.withdrawer === wallet) return { kind: "direct" };
  // Staker.delegate resolves instances from registry versions, so it can
  // never reach bonus-instance stake.
  if (row.isBonus) return { kind: "locked", staker: row.withdrawer };
  const version = stakerVersions.get(`${row.withdrawer}|${row.instance}`);
  if (version === undefined) return { kind: "locked", staker: row.withdrawer };
  return { kind: "staker", staker: row.withdrawer, version };
}

// Maps "staker|instance" to the registry version Staker.delegate expects;
// unresolvable entries are absent (their positions become "locked").
async function resolveStakerRollupVersions(
  client: PublicClient,
  rows: StakeRow[],
  signal?: AbortSignal
): Promise<Map<string, bigint>> {
  const versionByStakerInstance = new Map<string, bigint>();
  if (rows.length === 0) return versionByStakerInstance;
  signal?.throwIfAborted();

  try {
    const stakers = [...new Set(rows.map((row) => row.withdrawer))];
    const registryReads = await client.multicall({
      contracts: stakers.map((staker) => ({
        address: staker,
        abi: StakerAbi,
        functionName: "ROLLUP_REGISTRY" as const,
      })),
      allowFailure: true,
    });
    const registryByStaker = new Map<Address, Address>();
    for (let i = 0; i < stakers.length; i++) {
      const read = registryReads[i];
      if (read.status === "success")
        registryByStaker.set(stakers[i], getAddress(read.result));
    }

    // instance address -> version, per registry, resolved concurrently.
    const registries = [...new Set(registryByStaker.values())];
    const versionMaps = await Promise.all(
      registries.map((registry) => readRegistryVersions(client, registry))
    );
    const versionByRegistryInstance = new Map<string, bigint>();
    for (let i = 0; i < registries.length; i++) {
      for (const [instance, version] of versionMaps[i]) {
        versionByRegistryInstance.set(`${registries[i]}|${instance}`, version);
      }
    }

    for (const row of rows) {
      const registry = registryByStaker.get(row.withdrawer);
      if (!registry) continue;
      const version = versionByRegistryInstance.get(`${registry}|${row.instance}`);
      if (version !== undefined)
        versionByStakerInstance.set(`${row.withdrawer}|${row.instance}`, version);
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    console.warn("gse-delegation: staker version resolution failed", err);
    versionByStakerInstance.clear();
  }
  return versionByStakerInstance;
}

async function readRegistryVersions(
  client: PublicClient,
  registry: Address
): Promise<Map<Address, bigint>> {
  const versionByInstance = new Map<Address, bigint>();
  const count = await client.readContract({
    address: registry,
    abi: RegistryAbi,
    functionName: "numberOfVersions",
  });
  const n = count > MAX_REGISTRY_VERSIONS ? MAX_REGISTRY_VERSIONS : count;
  const indices = Array.from({ length: Number(n) }, (_, i) => BigInt(i));
  const versionReads = await client.multicall({
    contracts: indices.map((i) => ({
      address: registry,
      abi: RegistryAbi,
      functionName: "getVersion" as const,
      args: [i] as const,
    })),
    allowFailure: true,
  });
  const versions = versionReads
    .filter((read) => read.status === "success")
    .map((read) => read.result as bigint);
  const rollupReads = await client.multicall({
    contracts: versions.map((version) => ({
      address: registry,
      abi: RegistryAbi,
      functionName: "getRollup" as const,
      args: [version] as const,
    })),
    allowFailure: true,
  });
  for (let i = 0; i < versions.length; i++) {
    const read = rollupReads[i];
    if (read.status !== "success") continue;
    versionByInstance.set(getAddress(read.result as Address), versions[i]);
  }
  return versionByInstance;
}
