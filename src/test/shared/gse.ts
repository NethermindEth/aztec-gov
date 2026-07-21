// GSE fixtures shared by the fork and e2e suites, like anvil.ts. ABIs are
// hand-declared once here; src/lib/contracts would drag in the validated env.
import {
  getAddress,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";
import {
  GSE_DISCOVERY_E2E_ATTESTER_CHUNK,
  GSE_DISCOVERY_E2E_INDEX_CAP,
} from "../../lib/constants";

// Canonical mainnet Aztec Registry (rollup versions); the GSE is resolved
// from it so tests need no extra env.
export const REGISTRY = getAddress("0x35b22e09Ee0390539439E24f06Da43D83f90e298");

export const getCanonicalRollupAbi = parseAbiItem(
  "function getCanonicalRollup() view returns (address)"
);
export const getGSEAbi = parseAbiItem("function getGSE() view returns (address)");
export const getBonusInstanceAbi = parseAbiItem(
  "function getBonusInstanceAddress() pure returns (address)"
);
export const getLatestRollupAbi = parseAbiItem(
  "function getLatestRollup() view returns (address)"
);
export const supplyOfAbi = parseAbiItem(
  "function supplyOf(address _instance) view returns (uint256)"
);
export const getAttesterCountAtTimeAbi = parseAbiItem(
  "function getAttesterCountAtTime(address _instance, uint256 _timestamp) view returns (uint256)"
);
export const getAttestersFromIndicesAtTimeAbi = parseAbiItem(
  "function getAttestersFromIndicesAtTime(address _instance, uint256 _timestamp, uint256[] _indices) view returns (address[])"
);
export const getWithdrawerAbi = parseAbiItem(
  "function getWithdrawer(address _attester) view returns (address)"
);
export const gseBalanceOfAbi = parseAbiItem(
  "function balanceOf(address _instance, address _attester) view returns (uint256)"
);
export const getDelegateeAbi = parseAbiItem(
  "function getDelegatee(address _instance, address _attester) view returns (address)"
);
export const gseDelegateAbi = parseAbiItem(
  "function delegate(address _instance, address _attester, address _delegatee)"
);

export interface GseDeployment {
  rollup: Address;
  gse: Address;
  bonus: Address;
}

/** Registry -> canonical rollup -> GSE -> bonus instance. */
export async function resolveGse(client: PublicClient): Promise<GseDeployment> {
  const rollup = await client.readContract({
    address: REGISTRY,
    abi: [getCanonicalRollupAbi],
    functionName: "getCanonicalRollup",
  });
  const gse = await client.readContract({
    address: rollup,
    abi: [getGSEAbi],
    functionName: "getGSE",
  });
  const bonus = await client.readContract({
    address: gse,
    abi: [getBonusInstanceAbi],
    functionName: "getBonusInstanceAddress",
  });
  return {
    rollup: getAddress(rollup),
    gse: getAddress(gse),
    bonus: getAddress(bonus),
  };
}

export interface WithdrawerActor {
  attester: Address;
  withdrawer: Address;
  balance: bigint;
}

// Small concurrent groups: unbounded concurrency over cold fork slots
// saturates the upstream RPC.
async function inBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(...(await Promise.all(items.slice(i, i + batchSize).map(worker))));
  }
  return out;
}

// First bonus-instance stake with an EOA withdrawer (Staker-held ones can't
// call GSE.delegate). Bounded to the app's E2E cap; doubles as cache warmup.
export async function findEoaWithdrawerActor(
  client: PublicClient,
  gse: Address,
  bonus: Address,
  bound: number = GSE_DISCOVERY_E2E_INDEX_CAP
): Promise<WithdrawerActor> {
  const ts = (await client.getBlock()).timestamp;
  const count = Number(
    await client.readContract({
      address: gse,
      abi: [getAttesterCountAtTimeAbi],
      functionName: "getAttesterCountAtTime",
      args: [bonus, ts],
    })
  );
  const sweep = Math.min(count, bound);

  const chunks: bigint[][] = [];
  for (let from = 0; from < sweep; from += GSE_DISCOVERY_E2E_ATTESTER_CHUNK) {
    chunks.push(
      Array.from(
        { length: Math.min(GSE_DISCOVERY_E2E_ATTESTER_CHUNK, sweep - from) },
        (_, offset) => BigInt(from + offset)
      )
    );
  }
  // Enumeration chunks run one at a time: each touches ~50 cold slots and
  // concurrent chunks exceed the RPC timeout on a fresh fork.
  const attesters = (
    await inBatches(chunks, 1, (indices) =>
      client.readContract({
        address: gse,
        abi: [getAttestersFromIndicesAtTimeAbi],
        functionName: "getAttestersFromIndicesAtTime",
        args: [bonus, ts, indices],
      })
    )
  ).flat();

  const balances = await inBatches(attesters, 10, (attester) =>
    client.readContract({
      address: gse,
      abi: [gseBalanceOfAbi],
      functionName: "balanceOf",
      args: [bonus, attester],
    })
  );
  const withdrawers = await inBatches(attesters, 10, (attester) =>
    client.readContract({
      address: gse,
      abi: [getWithdrawerAbi],
      functionName: "getWithdrawer",
      args: [attester],
    })
  );

  for (let i = 0; i < attesters.length; i++) {
    if (balances[i] === 0n) continue;
    const withdrawer = getAddress(withdrawers[i]);
    const code = await client.getCode({ address: withdrawer });
    if (code && code !== "0x") continue;
    return { attester: getAddress(attesters[i]), withdrawer, balance: balances[i] };
  }
  throw new Error(
    `no EOA-withdrawer bonus stake in the first ${sweep} attesters`
  );
}
