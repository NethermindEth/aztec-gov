/**
 * Bootstrap staker-attributed voting on local anvil.
 *
 * Assumes anvil is running on http://127.0.0.1:8545 (any chain id) and that
 * `./scripts/deploy-test-governance.sh` has already been executed against the
 * same anvil instance so `.env.local` contains fresh Governance / STK addresses.
 *
 * What this does:
 *   1. Mints STK to the deployer.
 *   2. Deposits direct governance power for the deployer (so the UI still shows
 *      non-zero "Direct Deposit" power for regression testing).
 *   3. Deploys MockStaker(beneficiary, governance) — a local stand-in for
 *      ATPWithdrawableAndClaimableStaker. Its `voteInGovernance` proxies to
 *      Governance.vote from its own address.
 *   4. Deposits STK into governance on behalf of MockStaker so
 *      `Governance.powerNow(mockStaker)` is non-zero.
 *   5. Prints the MockStaker address and suggests appending it to
 *      `NEXT_PUBLIC_DEV_EXTRA_STAKERS` in `.env.local`.
 *
 * Env:
 *   PRIVATE_KEY              required. Defaults to anvil account 0's key if unset.
 *   RPC_URL                  defaults to http://127.0.0.1:8545
 *   NEXT_PUBLIC_GOVERNANCE_ADDRESS, NEXT_PUBLIC_STAKING_ASSET_ADDRESS  from .env.local
 *   DIRECT_AMOUNT            optional, default 50e18
 *   STAKER_AMOUNT            optional, default 100e18
 *   STAKER_BENEFICIARY       optional, default = deployer address
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

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

// Anvil's default account #0 — only a safe default on local dev chains.
const ANVIL_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;

const PRIVATE_KEY = (process.env.PRIVATE_KEY || ANVIL_ACCOUNT_0_KEY) as Hex;
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

const governanceAddress = (process.env.GOVERNANCE_ADDRESS ||
  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS) as Address;
const stakingAssetAddress = (process.env.STAKING_ASSET_ADDRESS ||
  process.env.NEXT_PUBLIC_STAKING_ASSET_ADDRESS) as Address;

if (!governanceAddress || !stakingAssetAddress) {
  console.error(
    "Error: NEXT_PUBLIC_GOVERNANCE_ADDRESS and NEXT_PUBLIC_STAKING_ASSET_ADDRESS must be set.\n" +
      "Run `PRIVATE_KEY=0x... RPC_URL=http://127.0.0.1:8545 ./scripts/deploy-test-governance.sh` first."
  );
  process.exit(1);
}

const DIRECT_AMOUNT = process.env.DIRECT_AMOUNT
  ? BigInt(process.env.DIRECT_AMOUNT)
  : 50n * 10n ** 18n;
const STAKER_AMOUNT = process.env.STAKER_AMOUNT
  ? BigInt(process.env.STAKER_AMOUNT)
  : 100n * 10n ** 18n;

const account = privateKeyToAccount(PRIVATE_KEY);
const beneficiary = (process.env.STAKER_BENEFICIARY as Address) || account.address;

const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
const walletClient = createWalletClient({
  account,
  chain: foundry,
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
]);

// Compiled from scripts/MockStaker.sol (solc 0.8.30, optimizer enabled).
// Constructor args (address _beneficiary, address _governance) are appended
// to this bytecode at deploy time.
const MOCK_STAKER_BYTECODE =
  "0x60c060405234801561000f575f5ffd5b506040516102c13803806102c183398101604081905261002e91610060565b6001600160a01b039182166080521660a052610091565b80516001600160a01b038116811461005b575f5ffd5b919050565b5f5f60408385031215610071575f5ffd5b61007a83610045565b915061008860208401610045565b90509250929050565b60805160a0516102046100bd5f395f818160a0015261013001525f81816048015260cd01526102045ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c806338af3eed14610043578063425ca870146100865780635aa6e6751461009b575b5f5ffd5b61006a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200160405180910390f35b610099610094366004610194565b6100c2565b005b61006a7f000000000000000000000000000000000000000000000000000000000000000081565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461010b5760405163644d871f60e01b815260040160405180910390fd5b60405163350c7fbd60e11b8152600481018490526024810183905281151560448201527f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031690636a18ff7a906064015f604051808303815f87803b158015610179575f5ffd5b505af115801561018b573d5f5f3e3d5ffd5b50505050505050565b5f5f5f606084860312156101a6575f5ffd5b8335925060208401359150604084013580151581146101c3575f5ffd5b80915050925092509256fea2646970667358221220c0c54181bb8ac514f8116465ccb7df5dd393131d1a1e42e50da509f089239d5664736f6c634300081e0033" as Hex;

const MOCK_STAKER_ABI = parseAbi([
  "constructor(address _beneficiary, address _governance)",
]);

async function waitForTx(hash: Hex, label: string) {
  console.log(`  ${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${label}`);
  }
  return receipt;
}

async function ensureBalance(amount: bigint) {
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

async function depositOnBehalf(onBehalf: Address, amount: bigint, label: string) {
  {
    const hash = await walletClient.writeContract({
      address: stakingAssetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [governanceAddress, amount],
    });
    await waitForTx(hash, `Approve governance (${label})`);
  }
  {
    const hash = await walletClient.writeContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "deposit",
      args: [onBehalf, amount],
    });
    await waitForTx(hash, `Deposit ${formatUnits(amount, 18)} STK (${label})`);
  }
}

async function deployMockStaker(
  stakerBeneficiary: Address,
  governance: Address
): Promise<Address> {
  const hash = await walletClient.deployContract({
    abi: MOCK_STAKER_ABI,
    bytecode: MOCK_STAKER_BYTECODE,
    args: [stakerBeneficiary, governance],
  });
  console.log(`  Deploy MockStaker: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("MockStaker deploy receipt has no contractAddress");
  }
  return receipt.contractAddress;
}

async function main() {
  console.log(`\nBootstrap anvil staker-voting`);
  console.log(`  RPC:            ${rpcUrl}`);
  console.log(`  Deployer:       ${account.address}`);
  console.log(`  Beneficiary:    ${beneficiary}`);
  console.log(`  Governance:     ${governanceAddress}`);
  console.log(`  StakingAsset:   ${stakingAssetAddress}`);
  console.log(`  Direct amount:  ${formatUnits(DIRECT_AMOUNT, 18)} STK`);
  console.log(`  Staker amount:  ${formatUnits(STAKER_AMOUNT, 18)} STK\n`);

  const needed = DIRECT_AMOUNT + STAKER_AMOUNT;
  await ensureBalance(needed);

  console.log(`Depositing direct voting power for beneficiary...`);
  await depositOnBehalf(beneficiary, DIRECT_AMOUNT, "direct");

  console.log(`\nDeploying MockStaker...`);
  const mockStaker = await deployMockStaker(beneficiary, governanceAddress);
  console.log(`  MockStaker at:  ${mockStaker}`);

  console.log(`\nDepositing staker voting power on behalf of MockStaker...`);
  await depositOnBehalf(mockStaker, STAKER_AMOUNT, "staker");

  const [directPower, stakerPower] = await Promise.all([
    publicClient.readContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "powerNow",
      args: [beneficiary],
    }),
    publicClient.readContract({
      address: governanceAddress,
      abi: governanceAbi,
      functionName: "powerNow",
      args: [mockStaker],
    }),
  ]);

  console.log(`\nDone.`);
  console.log(`  Beneficiary:       ${beneficiary}`);
  console.log(`  MockStaker:        ${mockStaker}`);
  console.log(`  Direct powerNow:   ${formatUnits(directPower, 18)} STK`);
  console.log(`  Staker powerNow:   ${formatUnits(stakerPower, 18)} STK`);
  console.log(`\nAdd to .env.local:`);
  console.log(`  NEXT_PUBLIC_DEV_EXTRA_STAKERS=${mockStaker}`);
  console.log(
    `\nThen run \`yarn seed-governance\` to create test proposals, and restart the dev server.\n`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
});
