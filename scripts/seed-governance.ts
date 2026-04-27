/**
 * Seed governance with deposits and test proposals using viem.
 *
 * Usage (from any directory):
 *   PRIVATE_KEY=0x... npx tsx scripts/seed-governance.ts
 *
 * Reads GOVERNANCE_ADDRESS (or NEXT_PUBLIC_GOVERNANCE_ADDRESS) and
 * STAKING_ASSET_ADDRESS (or NEXT_PUBLIC_STAKING_ASSET_ADDRESS) from env
 * or from the project root .env.local.
 *
 * Optional:
 *   TEST_VOTER=0x...   Also deposit voting power for this address
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  type Address,
  type Hex,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, mainnet, foundry } from "viem/chains";

function resolveChain() {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
  switch (id) {
    case 1:
      return mainnet;
    case 31337:
      return foundry;
    case 11155111:
    default:
      return sepolia;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// Load .env.local from project root (works regardless of cwd)
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
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
    "Error: NEXT_PUBLIC_GOVERNANCE_ADDRESS and NEXT_PUBLIC_STAKING_ASSET_ADDRESS are required"
  );
  console.error("Set them in scripts/.envrc or .env.local.");
  process.exit(1);
}

const rpcUrl =
  process.env.RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

const account = privateKeyToAccount(PRIVATE_KEY);
const chain = resolveChain();

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

const erc20Abi = parseAbi([
  "function mint(address _to, uint256 _amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const governanceAbi = parseAbi([
  "function deposit(address _onBehalfOf, uint256 _amount) external",
  "function powerNow(address _owner) external view returns (uint256)",
  "function proposalCount() external view returns (uint256)",
  "function proposeWithLock(address _proposal, address _to) external returns (uint256)",
]);

// TestPayload bytecode — compiled from aztec-packages/l1-contracts/script/deploy/TestPayload.sol
// A minimal IPayload that stores a URI and returns no actions.
const TEST_PAYLOAD_BYTECODE =
  "0x608060405234801561000f575f5ffd5b506040516104c53803806104c583398101604081905261002e91610054565b5f6100398282610188565b5050610242565b634e487b7160e01b5f52604160045260245ffd5b5f60208284031215610064575f5ffd5b81516001600160401b03811115610079575f5ffd5b8201601f81018413610089575f5ffd5b80516001600160401b038111156100a2576100a2610040565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100d0576100d0610040565b6040528181528282016020018610156100e7575f5ffd5b8160208401602083015e5f91810160200191909152949350505050565b600181811c9082168061011857607f821691505b60208210810361013657634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561018357805f5260205f20601f840160051c810160208510156101615750805b601f840160051c820191505b81811015610180575f815560010161016d565b50505b505050565b81516001600160401b038111156101a1576101a1610040565b6101b5816101af8454610104565b8461013c565b6020601f8211600181146101e7575f83156101d05750848201515b5f19600385901b1c1916600184901b178455610180565b5f84815260208120601f198516915b8281101561021657878501518255602094850194600190920191016101f6565b508482101561023357868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b6102768061024f5f395ff3fe608060405234801561000f575f5ffd5b5060043610610034575f3560e01c8063504d080b146100385780637754305c14610056575b5f5ffd5b61004061006b565b60405161004d919061016c565b60405180910390f35b61005e6100af565b60405161004d91906101ef565b604080515f808252602082019092526060916100a9565b604080518082019091525f8152606060208201528152602001906001900390816100825790505b50905090565b60605f80546100bd90610208565b80601f01602080910402602001604051908101604052809291908181526020018280546100e990610208565b80156101345780601f1061010b57610100808354040283529160200191610134565b820191905f5260205f20905b81548152906001019060200180831161011757829003601f168201915b5050505050905090565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b5f602082016020835280845180835260408501915060408160051b8601019250602086015f5b828110156101e357868503603f19018452815180516001600160a01b031686526020908101516040918701829052906101cd9087018261013e565b9550506020938401939190910190600101610192565b50929695505050505050565b602081525f610201602083018461013e565b9392505050565b600181811c9082168061021c57607f821691505b60208210810361023a57634e487b7160e01b5f52602260045260245ffd5b5091905056fea2646970667358221220538063b7ab560897b2189413d25835fb000544fd0b74e9ba7895eb74dd68173064736f6c634300081e0033" as Hex;

const PROPOSAL_URIS = [
  "https://forum.aztec.network/t/proposal-1-upgrade-sequencer-selection",
  "https://forum.aztec.network/t/proposal-2-adjust-gas-parameters",
  "https://forum.aztec.network/t/proposal-3-fund-developer-grants",
  "https://forum.aztec.network/t/proposal-4-update-bridge-parameters",
  "https://forum.aztec.network/t/proposal-5-community-treasury-allocation",
];

async function waitForTx(hash: Hex, label: string) {
  console.log(`  ${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${label}`);
  }
  return receipt;
}

async function deployTestPayload(uri: string): Promise<Address> {
  const constructorArgs = encodeAbiParameters(
    [{ type: "string" }],
    [uri]
  );
  const deployData = (TEST_PAYLOAD_BYTECODE + constructorArgs.slice(2)) as Hex;

  const hash = await walletClient.sendTransaction({
    data: deployData,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Failed to deploy TestPayload for: ${uri}`);
  }
  return receipt.contractAddress;
}

async function main() {
  console.log(`\nSeed Governance (TypeScript)`);
  console.log(`  Account:        ${account.address}`);
  console.log(`  Governance:     ${governanceAddress}`);
  console.log(`  Staking Asset:  ${stakingAssetAddress}`);
  console.log(`  RPC:            ${rpcUrl}\n`);

  // 1. Check current balance
  const balance = await publicClient.readContract({
    address: stakingAssetAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`Current STK balance: ${(balance / 10n ** 18n).toString()}`);

  // 2. Mint tokens if needed
  const mintAmount = 1_000_000n * 10n ** 18n;
  if (balance < mintAmount) {
    const hash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "mint",
      args: [account.address, mintAmount],
    });
    await waitForTx(hash, "Mint 1,000,000 STK");
  } else {
    console.log("Sufficient STK balance, skipping mint");
  }

  // 3. Approve governance to spend tokens
  const depositAmount = 500_000n * 10n ** 18n;
  {
    const hash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [governanceAddress, depositAmount],
    });
    await waitForTx(hash, "Approve governance");
  }

  // 4. Deposit for voting power
  {
    const hash = await walletClient.writeContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "deposit",
      args: [account.address, depositAmount],
    });
    await waitForTx(hash, "Deposit 500,000 STK");
  }

  // 4b. If TEST_VOTER is set, also deposit for that address
  const testVoter = process.env.TEST_VOTER as Address | undefined;
  if (testVoter) {
    const voterDeposit = 500_000n * 10n ** 18n;
    // Mint extra tokens for the voter deposit
    const mintHash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "mint",
      args: [account.address, voterDeposit],
    });
    await waitForTx(mintHash, "Mint 500,000 STK for test voter");

    const approveHash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [governanceAddress, voterDeposit],
    });
    await waitForTx(approveHash, "Approve governance for test voter");

    const depositHash = await walletClient.writeContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "deposit",
      args: [testVoter, voterDeposit],
    });
    await waitForTx(depositHash, `Deposit 500,000 STK for test voter ${testVoter}`);
  }

  // 5. Check voting power
  const power = await publicClient.readContract({
    address: governanceAddress,
    abi: governanceAbi,
    functionName: "powerNow",
    args: [account.address],
  });
  console.log(`\nVoting power: ${(power / 10n ** 18n).toString()}`);

  // 6. Create test proposals
  console.log(`\nCreating ${PROPOSAL_URIS.length} test proposals...`);
  for (let i = 0; i < PROPOSAL_URIS.length; i++) {
    const uri = PROPOSAL_URIS[i];
    console.log(`\n  Proposal ${i + 1}: deploying TestPayload...`);
    const payloadAddress = await deployTestPayload(uri);
    console.log(`    Payload deployed at: ${payloadAddress}`);

    const hash = await walletClient.writeContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "proposeWithLock",
      args: [payloadAddress, account.address],
    });
    const receipt = await waitForTx(hash, `proposeWithLock`);
    console.log(`    Proposal created (block ${receipt.blockNumber})`);
  }

  const proposalCount = await publicClient.readContract({
    address: governanceAddress,
    abi: governanceAbi,
    functionName: "proposalCount",
  });
  console.log(`\nTotal proposal count: ${proposalCount.toString()}`);

  console.log(`\nSeeding complete!`);
  console.log(`Proposals will become Active after votingDelay (60s).`);
  console.log(`Voting window is 300s (5 min) after activation.`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
