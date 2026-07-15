/*
 * Shared setup for the fork tests (issue #22). Everything here used to be
 * copy-pasted at the top of each *.test.ts file. Test-specific helpers
 * (storage-slot math, format.ts mirrors) stay in their own files.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  getAddress,
} from "viem";
import { mainnet } from "viem/chains";

export const RPC = "http://localhost:8545";

// Canonical mainnet actors: the seeded ATP holder, their vault + staker,
// and the protocol contracts.
export const USER = getAddress("0x78FA029F04251cc810DFF72CCC7B4764DBC16899");
export const ATP = getAddress("0x2C4464618f9b5d7601bED221Ad02cABB285245D8");
export const STAKER = getAddress("0xEaDd1e65dCCeB249156bB3E558479418E19B4fC0");
export const AZT = getAddress("0xa27Ec0006E59F245217ff08CD52A7E8b169e62d2");
export const GOV = getAddress("0x1102471eb3378fee427121c9efcea452e4b6b75e");
export const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");

// Anvil dev account #0, deterministic across forks (known private key).
export const DEV_ACCOUNT = getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

// Beneficiary → ATPs map, equivalent to what the indexer returns for each.
// Used in lieu of the indexer because CloudFront WAF blocks the sandbox.
// Array-valued: a beneficiary could hold multiple ATPs; single-ATP callers
// take [0].
export const KNOWN_ATPS: Record<string, string[]> = {
  "0x78fa029f04251cc810dff72ccc7b4764dbc16899": ["0x2C4464618f9b5d7601bED221Ad02cABB285245D8"],
  "0x256be0de90e34244bdef783de58cac27ae9ffeb3": ["0x4fd0630531df9fa74083c4282bae2bde6a6a255c"],
  "0x454a3a899dee11a00e05a758b486c45f3b0d829f": ["0x6569406eb6c357d82ffa44724538fc930ae576c4"],
  "0x2b9338f90182dab6d485dc2ff2e185407f17b442": ["0x842ce8ac778dc738967016eef9a3dbd2c0b192ab"],
  "0xb6b598d182b266d071c0e80ff57abb90fdd0fb0f": ["0xcb13993ea6204e855ce61a6ffda8ca328a32866b"],
};

export const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

// ERC20 / AZT
export const balanceOfAbi = parseAbiItem("function balanceOf(address) view returns (uint256)");
export const allowanceAbi = parseAbiItem(
  "function allowance(address owner, address spender) view returns (uint256)"
);
export const erc20ApproveAbi = parseAbiItem(
  "function approve(address spender, uint256 amount) returns (bool)"
);

// ATP / Staker
export const getOperatorAbi = parseAbiItem("function getOperator() view returns (address)");
export const approveStakerAbi = parseAbiItem("function approveStaker(uint256 _amount)");
export const depositIntoGovAbi = parseAbiItem("function depositIntoGovernance(uint256 _amount)");
export const initiateWithdrawAbi = parseAbiItem(
  "function initiateWithdrawFromGovernance(uint256 _amount) returns (uint256)"
);

// Governance
export const powerNowAbi = parseAbiItem("function powerNow(address) view returns (uint256)");
export const govDepositAbi = parseAbiItem("function deposit(address _beneficiary, uint256 _amount)");
export const finalizeAbi = parseAbiItem("function finalizeWithdraw(uint256 _withdrawalId)");
export const withdrawInitiatedEvent = parseAbiItem(
  "event WithdrawInitiated(uint256 indexed withdrawalId, address indexed recipient, uint256 amount)"
);
export const getWithdrawalAbi = parseAbiItem(
  "function getWithdrawal(uint256) view returns ((uint256 amount, uint256 unlocksAt, address recipient, bool claimed))"
);
export const withdrawalCountAbi = parseAbiItem(
  "function withdrawalCount() view returns (uint256)"
);

export async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

export function fail(msg: string): never {
  console.log(`✗ ${msg}`);
  process.exit(1);
}

export function pass(msg: string): void {
  console.log(`✓ ${msg}`);
}

export function section(title: string): void {
  console.log(`  ${title}`);
}

export async function snapshot(): Promise<string> {
  return rpc<string>("evm_snapshot");
}

export async function revert(id: string): Promise<void> {
  await rpc("evm_revert", [id]);
}
