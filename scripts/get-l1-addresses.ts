import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const DEFAULT_RPC = "https://rpc.testnet.aztec-labs.com";

const ADDRESS_KEYS: Record<string, string> = {
  governanceAddress: "NEXT_PUBLIC_GOVERNANCE_ADDRESS",
  stakingAssetAddress: "NEXT_PUBLIC_STAKING_ASSET_ADDRESS",
  gseAddress: "NEXT_PUBLIC_GSE_ADDRESS",
};

async function main() {
  const nodeUrl = process.argv[2] || process.env.AZTEC_NODE_URL || DEFAULT_RPC;

  console.log(`\nFetching L1 contract addresses from ${nodeUrl}...\n`);

  const response = await fetch(nodeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "node_getL1ContractAddresses",
      params: [],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  const addresses: Record<string, string> = json.result;

  // Find the longest key for alignment
  const maxLen = Math.max(...Object.keys(addresses).length ? Object.keys(addresses).map((k) => k.length) : [0]);

  for (const [name, addr] of Object.entries(addresses)) {
    const marker = name in ADDRESS_KEYS ? "  ←" : "";
    console.log(`  ${name.padEnd(maxLen + 2)}${addr}${marker}`);
  }

  // Collect env vars to write
  const envVars: Record<string, string> = {};
  for (const [rpcKey, envKey] of Object.entries(ADDRESS_KEYS)) {
    const addr = addresses[rpcKey];
    if (addr) {
      envVars[envKey] = addr;
    } else {
      console.warn(`Warning: '${rpcKey}' not found in RPC response.`);
    }
  }

  if (Object.keys(envVars).length === 0) {
    console.warn("\nNo governance addresses found in response.\n");
    return;
  }

  // Read existing .env.local or start fresh
  const envPath = resolve(process.cwd(), ".env.local");
  let lines: string[] = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf-8").split("\n");
  }

  // Upsert each env var
  for (const [key, value] of Object.entries(envVars)) {
    const idx = lines.findIndex((line) => line.startsWith(`${key}=`));
    const entry = `${key}=${value}`;
    if (idx >= 0) {
      lines[idx] = entry;
    } else {
      lines.push(entry);
    }
  }

  // Remove trailing empty lines, ensure final newline
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  writeFileSync(envPath, lines.join("\n") + "\n");

  console.log(`\nUpdated ${envPath}:`);
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`  ${key}=${value}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
