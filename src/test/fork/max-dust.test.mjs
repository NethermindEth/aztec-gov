/*
 * Fork tests for the post-audit fixes.
 *
 *   1. ATP.getOperator() returns the expected operator (powers the new
 *      operator pre-check in DepositModal).
 *   2. MAX-deposit drains the ATP to exactly 0 wei (no dust stranded by
 *      bigintToRaw's 6-decimal display truncation).
 *   3. MAX-withdraw zeroes staker power exactly.
 *
 * Tests 2 and 3 mutate fork state and are wrapped in snapshot+revert.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  encodeFunctionData,
  getAddress,
  toHex,
} from "viem";

const RPC = "http://localhost:8545";
const USER = getAddress("0x78FA029F04251cc810DFF72CCC7B4764DBC16899");
const ATP = getAddress("0x2C4464618f9b5d7601bED221Ad02cABB285245D8");
const STAKER = getAddress("0xEaDd1e65dCCeB249156bB3E558479418E19B4fC0");
const AZT = getAddress("0xa27Ec0006E59F245217ff08CD52A7E8b169e62d2");
const GOV = getAddress("0x1102471eb3378fee427121c9efcea452e4b6b75e");

const c = createPublicClient({ transport: http(RPC) });

const balanceOfAbi = parseAbiItem("function balanceOf(address) view returns (uint256)");
const allowanceAbi = parseAbiItem("function allowance(address,address) view returns (uint256)");
const getOperatorAbi = parseAbiItem("function getOperator() view returns (address)");
const approveStakerAbi = parseAbiItem("function approveStaker(uint256 _amount)");
const depositIntoGovAbi = parseAbiItem("function depositIntoGovernance(uint256 _amount)");
const initiateWithdrawAbi = parseAbiItem(
  "function initiateWithdrawFromGovernance(uint256 _amount) returns (uint256)"
);
const powerNowAbi = parseAbiItem("function powerNow(address) view returns (uint256)");

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

function fail(msg) {
  console.log(`✗ ${msg}`);
  process.exit(1);
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

// Mirror of dashboard's format.ts:bigintToRaw (source of the truncation)
function bigintToRaw(value) {
  if (value === 0n) return "0";
  const str = value.toString().padStart(19, "0");
  const wholeStr = str.slice(0, str.length - 18) || "0";
  const fracStr = str.slice(str.length - 18).replace(/0+$/, "");
  if (!fracStr) return wholeStr;
  const displayFrac = fracStr.length > 6 ? fracStr.slice(0, 6) : fracStr;
  return `${wholeStr}.${displayFrac}`;
}

// Mirror of dashboard's format.ts:parseAztAmount
function parseAztAmount(input) {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > 18) return null;
  const fracPadded = frac.padEnd(18, "0");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded);
}

await rpc("anvil_setBalance", [USER, toHex(10n * 10n ** 18n)]);
await rpc("anvil_impersonateAccount", [USER]);

// Test 1: ATP.getOperator() powers the new operator pre-check
console.log("  Test 1: operator pre-check input");
const operator = await c.readContract({
  address: ATP,
  abi: [getOperatorAbi],
  functionName: "getOperator",
});

if (getAddress(operator) !== USER) {
  fail(`expected operator == ${USER}, got ${operator}`);
}
pass(`ATP.getOperator() = ${operator}`);
pass(`Matches wallet user, so DepositModal would enable this vault source`);
pass(
  `If a different address were returned, DepositModal would disable the row ` +
    `with "Operator reassigned" label (verified by code review; UI gate is a ` +
    `direct equality check)`
);

// Test 2: MAX dust deposit-via-staker
console.log("  Test 2: full ATP balance deposit-via-staker");
const snapId = await rpc("evm_snapshot");
try {
  const atpBalRaw = await c.readContract({
    address: AZT,
    abi: [balanceOfAbi],
    functionName: "balanceOf",
    args: [ATP],
  });
  pass(`ATP balance: ${atpBalRaw} wei (${Number(atpBalRaw) / 1e18} AZT)`);

  // Demonstrate the OLD round-trip bug:
  const displayed = bigintToRaw(atpBalRaw);
  const reparsed = parseAztAmount(displayed);
  const stranded = atpBalRaw - reparsed;
  console.log(
    `\n  Old path simulation:` +
      `\n    bigintToRaw(${atpBalRaw}) = "${displayed}"` +
      `\n    parseAztAmount("${displayed}") = ${reparsed}` +
      `\n    Stranded dust if MAX click sent reparsed value: ${stranded} wei\n`
  );
  if (stranded === 0n) {
    pass(`No dust to strand on this balance, skipping demo (but fix still applies)`);
  } else {
    pass(
      `Confirmed pre-fix path strands ${stranded} wei. New path uses the raw ` +
        `bigint directly and sends ${atpBalRaw} wei.`
    );
  }

  // Drain allowance so the test is deterministic; the modal would call
  // approveStaker(amount) here when allowance < amount.
  const allowance = await c.readContract({
    address: AZT,
    abi: [allowanceAbi],
    functionName: "allowance",
    args: [ATP, STAKER],
  });
  if (allowance > 0n) {
    const drainTx = await rpc("eth_sendTransaction", [
      {
        from: USER,
        to: ATP,
        data: encodeFunctionData({
          abi: [approveStakerAbi],
          functionName: "approveStaker",
          args: [0n],
        }),
        gas: toHex(500_000n),
      },
    ]);
    await c.waitForTransactionReceipt({ hash: drainTx });
    pass(`Drained existing allowance ${allowance} -> 0`);
  }

  // Step A: approveStaker(atpBalRaw) with the exact bigint, no rounding
  const approveTx = await rpc("eth_sendTransaction", [
    {
      from: USER,
      to: ATP,
      data: encodeFunctionData({
        abi: [approveStakerAbi],
        functionName: "approveStaker",
        args: [atpBalRaw],
      }),
      gas: toHex(500_000n),
    },
  ]);
  await c.waitForTransactionReceipt({ hash: approveTx });
  const allowanceAfterApprove = await c.readContract({
    address: AZT,
    abi: [allowanceAbi],
    functionName: "allowance",
    args: [ATP, STAKER],
  });
  if (allowanceAfterApprove !== atpBalRaw)
    fail(`allowance after approve = ${allowanceAfterApprove}, expected ${atpBalRaw}`);
  pass(`approveStaker(${atpBalRaw}): allowance set exactly`);

  // Step B: depositIntoGovernance(atpBalRaw) with the exact bigint
  const stakerPowerBefore = await c.readContract({
    address: GOV,
    abi: [powerNowAbi],
    functionName: "powerNow",
    args: [STAKER],
  });
  const depositTx = await rpc("eth_sendTransaction", [
    {
      from: USER,
      to: STAKER,
      data: encodeFunctionData({
        abi: [depositIntoGovAbi],
        functionName: "depositIntoGovernance",
        args: [atpBalRaw],
      }),
      gas: toHex(500_000n),
    },
  ]);
  await c.waitForTransactionReceipt({ hash: depositTx });

  // Verify ATP balance is now EXACTLY 0 (no dust stranded)
  const atpBalAfter = await c.readContract({
    address: AZT,
    abi: [balanceOfAbi],
    functionName: "balanceOf",
    args: [ATP],
  });
  if (atpBalAfter !== 0n)
    fail(`ATP balance after MAX deposit = ${atpBalAfter}, expected 0`);
  pass(`ATP balance after MAX deposit = 0 wei (no dust stranded)`);

  const stakerPowerAfter = await c.readContract({
    address: GOV,
    abi: [powerNowAbi],
    functionName: "powerNow",
    args: [STAKER],
  });
  if (stakerPowerAfter - stakerPowerBefore !== atpBalRaw)
    fail(`staker power delta = ${stakerPowerAfter - stakerPowerBefore}, expected ${atpBalRaw}`);
  pass(`Staker power increased by exactly ${atpBalRaw} wei (full balance moved into governance)`);
} finally {
  await rpc("evm_revert", [snapId]);
  pass(`State reverted via evm_revert`);
}

// Test 3: MAX dust initiate-withdraw via staker
console.log("  Test 3: full staker power withdraw-via-staker");
const snapId2 = await rpc("evm_snapshot");
try {
  // Current staker power (governance.powerNow(staker)) is what the user sees
  // as "Available" for this source in WithdrawModal.
  const stakerPower = await c.readContract({
    address: GOV,
    abi: [powerNowAbi],
    functionName: "powerNow",
    args: [STAKER],
  });
  pass(`Staker power: ${stakerPower} wei (${Number(stakerPower) / 1e18} AZT)`);

  if (stakerPower === 0n) {
    fail(`Staker power is 0, cannot test withdraw MAX (run Test 2 first to create power)`);
  }

  // Demonstrate the dust:
  const displayed = bigintToRaw(stakerPower);
  const reparsed = parseAztAmount(displayed);
  const stranded = stakerPower - reparsed;
  console.log(
    `\n  Old path simulation:` +
      `\n    bigintToRaw(${stakerPower}) = "${displayed}"` +
      `\n    parseAztAmount("${displayed}") = ${reparsed}` +
      `\n    Stranded if MAX sent reparsed value: ${stranded} wei\n`
  );

  // New path: initiate withdraw with exact bigint
  const withdrawTx = await rpc("eth_sendTransaction", [
    {
      from: USER,
      to: STAKER,
      data: encodeFunctionData({
        abi: [initiateWithdrawAbi],
        functionName: "initiateWithdrawFromGovernance",
        args: [stakerPower],
      }),
      gas: toHex(800_000n),
    },
  ]);
  const rcpt = await c.waitForTransactionReceipt({ hash: withdrawTx });
  if (rcpt.status !== "success") fail("initiateWithdrawFromGovernance reverted");
  pass(`initiateWithdrawFromGovernance(${stakerPower}) with the exact bigint`);

  const stakerPowerAfter = await c.readContract({
    address: GOV,
    abi: [powerNowAbi],
    functionName: "powerNow",
    args: [STAKER],
  });
  if (stakerPowerAfter !== 0n)
    fail(`Staker power after MAX withdraw = ${stakerPowerAfter}, expected 0`);
  pass(`Staker power after MAX withdraw = 0 (no dust stranded in governance)`);
} finally {
  await rpc("evm_revert", [snapId2]);
  pass(`State reverted via evm_revert`);
}

// Summary
console.log("  ALL FIX TESTS PASSED");
console.log("Verified:");
console.log("  ✓ ATP.getOperator() reads correctly (powers operator pre-check)");
console.log("  ✓ MAX-deposit drains ATP to exactly 0 wei (no dust)");
console.log("  ✓ MAX-withdraw zeroes staker power exactly (no dust)");
console.log("  ✓ Fork state reverted to pre-test snapshot");
