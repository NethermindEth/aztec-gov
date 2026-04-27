/**
 * Seed staker-attributed voting power on Sepolia.
 *
 * Augment existing ATP (default):
 *   PRIVATE_KEY=0x... npx tsx scripts/seed-staker-voting.ts
 *
 * Create a new ATP (requires ATPFactory owner key):
 *   PRIVATE_KEY=0x... ATP_FACTORY_ADDRESS=0x... \
 *     npx tsx scripts/seed-staker-voting.ts --create-atp
 *
 * Reads from .env.local:
 *   NEXT_PUBLIC_GOVERNANCE_ADDRESS, NEXT_PUBLIC_STAKING_ASSET_ADDRESS,
 *   RPC_URL, NEXT_PUBLIC_STAKING_INDEXER_URL (optional),
 *   NEXT_PUBLIC_CHAIN_ID (defaults to 11155111),
 *   ATP_FACTORY_ADDRESS (required for --create-atp),
 *   TARGET_AMOUNT (optional, defaults to 100e18).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  fetchBeneficiaryHoldings,
  getIndexerBaseUrl,
} from "../src/lib/indexer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
if (!PRIVATE_KEY) {
  console.error("Error: PRIVATE_KEY env var is required");
  process.exit(1);
}

const governanceAddress = (process.env.GOVERNANCE_ADDRESS ||
  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS) as Address;
const stakingAssetAddress = (process.env.STAKING_ASSET_ADDRESS ||
  process.env.NEXT_PUBLIC_STAKING_ASSET_ADDRESS) as Address;

if (!governanceAddress || !stakingAssetAddress) {
  console.error(
    "Error: NEXT_PUBLIC_GOVERNANCE_ADDRESS and NEXT_PUBLIC_STAKING_ASSET_ADDRESS are required (set in .env.local)"
  );
  process.exit(1);
}

const rpcUrl =
  process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const TARGET_AMOUNT = process.env.TARGET_AMOUNT
  ? BigInt(process.env.TARGET_AMOUNT)
  : 100n * 10n ** 18n;

const account = privateKeyToAccount(PRIVATE_KEY);
const beneficiary = account.address;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl),
});

const erc20Abi = parseAbi([
  "function mint(address _to, uint256 _amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const governanceAbi = parseAbi([
  "function powerNow(address _owner) external view returns (uint256)",
]);

const latpAbi = parseAbi([
  "function approveStaker(uint256 _allowance) external",
  "function getStaker() external view returns (address)",
]);

const stakerAbi = parseAbi([
  "function depositIntoGovernance(uint256 _amount) external",
]);

const atpFactoryAbi = parseAbi([
  "struct LockParams { uint256 startTime; uint256 cliffDuration; uint256 lockDuration; }",
  "struct RevokableParams { address revokeBeneficiary; LockParams lockParams; }",
  "function createLATP(address _beneficiary, uint256 _allocation, RevokableParams _revokableParams) external returns (address)",
  "event ATPCreated(address indexed beneficiary, address indexed atp, uint256 allocation)",
]);

async function waitForTx(hash: Hex, label: string) {
  console.log(`  ${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${label}`);
  }
  return receipt;
}

async function ensureDeployerBalance(amount: bigint) {
  const balance = await publicClient.readContract({
    address: stakingAssetAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance >= amount) return;
  const shortfall = amount - balance;
  const hash = await walletClient.writeContract({
    address: stakingAssetAddress,
    abi: erc20Abi,
    functionName: "mint",
    args: [account.address, shortfall],
  });
  await waitForTx(hash, `Mint ${formatUnits(shortfall, 18)} STK`);
}

async function createNewATP(
  factory: Address,
  allocation: bigint
): Promise<Address> {
  await ensureDeployerBalance(allocation);

  {
    const hash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [factory, allocation],
    });
    await waitForTx(hash, "STK.approve(factory)");
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const revokableParams = {
    revokeBeneficiary:
      "0x0000000000000000000000000000000000000000" as Address,
    lockParams: {
      startTime: now,
      cliffDuration: 0n,
      lockDuration: 1n,
    },
  };

  let createHash: Hex;
  try {
    createHash = await walletClient.writeContract({
      address: factory,
      abi: atpFactoryAbi,
      functionName: "createLATP",
      args: [beneficiary, allocation, revokableParams],
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "";
    if (/OwnableUnauthorizedAccount|Ownable/i.test(msg)) {
      console.error(
        `\ncreateLATP failed — PRIVATE_KEY (${beneficiary}) is not the ATPFactory owner.\n` +
          `Ask the staking-dashboard ops team to create an ATP for this wallet on Sepolia,\n` +
          `then re-run without --create-atp.\n`
      );
    }
    throw err;
  }

  const receipt = await waitForTx(createHash, "ATPFactory.createLATP");
  const logs = parseEventLogs({
    abi: atpFactoryAbi,
    eventName: "ATPCreated",
    logs: receipt.logs,
  });
  if (logs.length === 0) {
    throw new Error("ATPCreated event not found in transaction logs");
  }
  const atpAddress = logs[0].args.atp as Address;
  console.log(`  ATP created: ${atpAddress}`);
  return atpAddress;
}

async function fundStakerGovernancePower(
  atpAddress: Address,
  amount: bigint
): Promise<Address> {
  const stakerAddress = await publicClient.readContract({
    address: atpAddress,
    abi: latpAbi,
    functionName: "getStaker",
  });

  const currentPower = await publicClient.readContract({
    address: governanceAddress,
    abi: governanceAbi,
    functionName: "powerNow",
    args: [stakerAddress],
  });
  if (currentPower >= amount) {
    console.log(
      `  Staker ${stakerAddress} already has ${formatUnits(currentPower, 18)} AZT power — skipping deposit.`
    );
    return stakerAddress;
  }

  {
    const hash = await walletClient.writeContract({
      address: atpAddress,
      abi: latpAbi,
      functionName: "approveStaker",
      args: [amount],
    });
    await waitForTx(hash, "ATP.approveStaker");
  }

  {
    const hash = await walletClient.writeContract({
      address: stakerAddress,
      abi: stakerAbi,
      functionName: "depositIntoGovernance",
      args: [amount],
    });
    await waitForTx(hash, "Staker.depositIntoGovernance");
  }

  return stakerAddress;
}

async function main() {
  const createAtp = process.argv.includes("--create-atp");

  console.log(`\nSeed Staker Voting`);
  console.log(
    `  Mode:          ${createAtp ? "--create-atp (new ATP)" : "augment existing ATP"}`
  );
  console.log(`  Beneficiary:   ${beneficiary}`);
  console.log(`  Governance:    ${governanceAddress}`);
  console.log(`  Staking Asset: ${stakingAssetAddress}`);
  console.log(`  RPC:           ${rpcUrl}`);
  console.log(`  Target:        ${formatUnits(TARGET_AMOUNT, 18)} AZT\n`);

  let atpAddress: Address;

  if (createAtp) {
    const factory = process.env.ATP_FACTORY_ADDRESS as Address | undefined;
    if (!factory) {
      console.error(
        "Error: ATP_FACTORY_ADDRESS env var is required for --create-atp mode"
      );
      process.exit(1);
    }
    console.log(`Creating new LATP via factory ${factory}...`);
    atpAddress = await createNewATP(factory, TARGET_AMOUNT);
  } else {
    const indexerBase = getIndexerBaseUrl();
    if (!indexerBase) {
      console.error(
        "Error: could not resolve indexer base URL. Set NEXT_PUBLIC_STAKING_INDEXER_URL or NEXT_PUBLIC_CHAIN_ID."
      );
      process.exit(1);
    }
    console.log(`Discovering ATPs for ${beneficiary} via ${indexerBase}...`);
    const holdings = await fetchBeneficiaryHoldings(indexerBase, beneficiary);
    if (holdings.length === 0) {
      console.error(
        `\nNo ATPs found for ${beneficiary} on the indexer.\n` +
          `Run with --create-atp and ATP_FACTORY_ADDRESS to create one,\n` +
          `or ask a factory owner to provision an ATP for this wallet.\n`
      );
      process.exit(1);
    }
    atpAddress = holdings[0].address;
    console.log(
      `  Found ATP:     ${atpAddress} (staker: ${holdings[0].stakerAddress})`
    );
  }

  console.log(`\nFunding staker with governance power...`);
  const stakerAddress = await fundStakerGovernancePower(
    atpAddress,
    TARGET_AMOUNT
  );

  const finalPower = await publicClient.readContract({
    address: governanceAddress,
    abi: governanceAbi,
    functionName: "powerNow",
    args: [stakerAddress],
  });

  console.log(`\nDone.`);
  console.log(`  Beneficiary: ${beneficiary}`);
  console.log(`  ATP:         ${atpAddress}`);
  console.log(`  Staker:      ${stakerAddress}`);
  console.log(`  powerNow:    ${formatUnits(finalPower, 18)} AZT`);
  console.log(
    `\nOpen aztec-gov with .env.sepolia, connect ${beneficiary}, pick the staker in VoteModal.\n`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
});
