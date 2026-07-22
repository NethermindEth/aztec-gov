import { isAddress, getAddress, type Address } from "viem";

// Single source of truth for required client-side config. Every value below is
// read from a NEXT_PUBLIC_ var (inlined at build), validated, and exported.
// If anything required is missing or malformed this module throws at load,
// which fails `next build` (page.tsx is a server component that imports this
// transitively) so a misconfigured deploy never ships. Before this, missing
// vars silently fell back to the zero address / Sepolia / a disabled indexer,
// and you only found out when data came back empty in production.
//
// RPC_URL is deliberately not here: it is server-only, so the browser never
// sees it and a check here would throw on every client load. contracts.ts
// requires it on the server in production and keeps the public fallback for
// dev, fork tests and e2e.

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const SUPPORTED_CHAIN_IDS = [1, 11155111, 31337];

const problems: string[] = [];

function requireAddress(name: string, raw: string | undefined): Address {
  if (!raw || raw.trim().length === 0) {
    problems.push(`${name} is not set`);
    return ZERO;
  }
  if (!isAddress(raw)) {
    problems.push(`${name} is not a valid address: ${raw}`);
    return ZERO;
  }
  return getAddress(raw);
}

function requireChainId(name: string, raw: string | undefined): number {
  if (!raw || raw.trim().length === 0) {
    problems.push(`${name} is not set`);
    return 0;
  }
  const n = Number(raw);
  if (!SUPPORTED_CHAIN_IDS.includes(n)) {
    problems.push(
      `${name}=${raw} is not supported (supported: ${SUPPORTED_CHAIN_IDS.join(", ")})`
    );
    return 0;
  }
  return n;
}

function optionalUrl(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) return "";
  return raw.trim().replace(/\/+$/, "");
}

export const governanceAddress = requireAddress(
  "NEXT_PUBLIC_GOVERNANCE_ADDRESS",
  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS
);
export const stakingAssetAddress = requireAddress(
  "NEXT_PUBLIC_STAKING_ASSET_ADDRESS",
  process.env.NEXT_PUBLIC_STAKING_ASSET_ADDRESS
);
export const gseAddress = requireAddress(
  "NEXT_PUBLIC_GSE_ADDRESS",
  process.env.NEXT_PUBLIC_GSE_ADDRESS
);
export const chainId = requireChainId(
  "NEXT_PUBLIC_CHAIN_ID",
  process.env.NEXT_PUBLIC_CHAIN_ID
);
export const indexerUrl = optionalUrl(process.env.NEXT_PUBLIC_STAKING_INDEXER_URL);

// Factories trusted by the on-chain discovery fallback; extend via env as more of the TGE set becomes known.
const DEFAULT_ATP_FACTORIES: Address[] = [
  getAddress("0x42df694edf32d5ac19a75e1c7f91c982a7f2a161"),
];

function optionalAddressList(
  name: string,
  raw: string | undefined,
  fallback: Address[]
): Address[] {
  if (!raw || raw.trim().length === 0) return fallback;
  const out: Address[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (s.length === 0) continue;
    if (!isAddress(s)) {
      problems.push(`${name} contains an invalid address: ${s}`);
      continue;
    }
    out.push(getAddress(s));
  }
  return out;
}

export const atpFactories = optionalAddressList(
  "NEXT_PUBLIC_ATP_FACTORIES",
  process.env.NEXT_PUBLIC_ATP_FACTORIES,
  DEFAULT_ATP_FACTORIES
);

if (problems.length > 0) {
  throw new Error(
    "Missing or invalid environment configuration:\n" +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\nSet these (see .env.local.example) and rebuild."
  );
}
