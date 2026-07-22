import { getAddress, slice, type Address, type PublicClient } from "viem";
import { PayloadAbi } from "./contracts";
import { governanceAddress, gseAddress, stakingAssetAddress } from "./config";
import type { ProposalAction } from "./types";

// Governance contracts we can name; anything else shows its address.
const KNOWN_CONTRACTS: Record<string, string> = {
  [governanceAddress.toLowerCase()]: "Governance",
  [gseAddress.toLowerCase()]: "GSE",
  [stakingAssetAddress.toLowerCase()]: "Staking Asset",
};

// selector -> signature cache (null = definitively unknown), shared per process.
const signatureCache = new Map<string, string | null>();

const SIGNATURE_TIMEOUT_MS = 2500;

// Resolves a 4-byte selector to a function signature via the OpenChain
// database. Server-side; only caches definitive results so a transient
// outage doesn't pin a raw selector, and never guesses on a 4-byte collision.
async function resolveSignature(selector: string): Promise<string | undefined> {
  if (selector === "0x") return undefined;
  const cached = signatureCache.get(selector);
  if (cached !== undefined) return cached ?? undefined;
  try {
    const res = await fetch(
      `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}&filter=true`,
      { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(SIGNATURE_TIMEOUT_MS) }
    );
    if (!res.ok) return undefined; // transient; don't cache, retry next render
    const data = await res.json();
    const matches = data?.result?.function?.[selector] as { name: string }[] | undefined;
    // Trust only an unambiguous match; multiple means a collision we can't resolve.
    const name = matches?.length === 1 ? matches[0].name : undefined;
    signatureCache.set(selector, name ?? null);
    return name;
  } catch {
    return undefined; // timeout/network; don't cache
  }
}

// Reads a proposal payload's on-chain actions and decodes each into a
// target label + function signature. Server-side only; returns [] on failure.
export async function fetchProposalActions(
  client: PublicClient,
  payloadAddress: string
): Promise<ProposalAction[]> {
  let raw: readonly { target: Address; data: `0x${string}` }[];
  try {
    raw = (await client.readContract({
      address: getAddress(payloadAddress),
      abi: PayloadAbi,
      functionName: "getActions",
    })) as readonly { target: Address; data: `0x${string}` }[];
  } catch {
    return [];
  }

  const selectors = raw.map((a) => (a.data.length >= 10 ? slice(a.data, 0, 4) : "0x"));
  const signatures = await Promise.all(
    [...new Set(selectors)].map(async (sel) => [sel, await resolveSignature(sel)] as const)
  );
  const signatureBySelector = new Map(signatures);

  return raw.map((action, i) => {
    const target = getAddress(action.target);
    const selector = selectors[i];
    return {
      target,
      targetLabel: KNOWN_CONTRACTS[target.toLowerCase()],
      selector,
      signature: signatureBySelector.get(selector) ?? undefined,
    };
  });
}
