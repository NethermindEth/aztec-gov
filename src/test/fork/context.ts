/*
 * Shared setup for the fork tests (issue #22). Anvil access and canonical
 * addresses come from src/test/shared/anvil.ts (also used by the e2e suite);
 * test-specific helpers (storage-slot math, format.ts mirrors) stay local.
 */
import { createPublicClient, http, parseAbiItem, getAddress } from "viem";
import { mainnet } from "viem/chains";
import {
  RPC,
  CANONICAL_USER,
  CANONICAL_ATP,
  CANONICAL_STAKER,
  AZT as AZT_RAW,
  GOV as GOV_RAW,
  anvilRpc,
  snapshot,
  revert,
} from "../shared/anvil";

// Suite-shared JSON-RPC helper; network-level failures get one retry.
export { RPC, snapshot, revert, anvilRpc as rpc };

// Canonical mainnet actors, checksummed for viem call sites.
export const USER = getAddress(CANONICAL_USER);
export const ATP = getAddress(CANONICAL_ATP);
export const STAKER = getAddress(CANONICAL_STAKER);
export const AZT = getAddress(AZT_RAW);
export const GOV = getAddress(GOV_RAW);
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
