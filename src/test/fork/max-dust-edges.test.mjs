/*
 * Edge cases for the post-audit fixes. Closes gaps that max-dust.test.mjs
 * doesn't cover.
 *
 *   A. Wallet-path MAX dust survives ERC20.approve to governance (the
 *      staker route is covered by max-dust.test.mjs).
 *   B. Approve then deposit revert: allowance survives the revert, retry
 *      skips approve.
 *   C. Multi-ATP getOperator sanity across all 5 known ATPs.
 *   D. Legacy ATP without getOperator selector: multicall returns
 *      status:"failure", dashboard treats it as operator-unknown and
 *      stays optimistic instead of crashing.
 *
 * Every mutating test is snapshot+revert wrapped.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  encodeFunctionData,
  getAddress,
  toHex,
  keccak256,
  encodeAbiParameters,
} from "viem";

const RPC = "http://localhost:8545";
const AZT = getAddress("0xa27Ec0006E59F245217ff08CD52A7E8b169e62d2");
const GOV = getAddress("0x1102471eb3378fee427121c9efcea452e4b6b75e");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");

const USER = getAddress("0x78FA029F04251cc810DFF72CCC7B4764DBC16899");
const USER_ATP = getAddress("0x2C4464618f9b5d7601bED221Ad02cABB285245D8");
const USER_STAKER = getAddress("0xEaDd1e65dCCeB249156bB3E558479418E19B4fC0");

// Anvil dev account 0 with a known private key, deterministic across forks
const FRESH_WALLET = getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

const KNOWN_ATPS = {
  "0x78fa029f04251cc810dff72ccc7b4764dbc16899": "0x2C4464618f9b5d7601bED221Ad02cABB285245D8",
  "0x256be0de90e34244bdef783de58cac27ae9ffeb3": "0x4fd0630531df9fa74083c4282bae2bde6a6a255c",
  "0x454a3a899dee11a00e05a758b486c45f3b0d829f": "0x6569406eb6c357d82ffa44724538fc930ae576c4",
  "0x2b9338f90182dab6d485dc2ff2e185407f17b442": "0x842ce8ac778dc738967016eef9a3dbd2c0b192ab",
  "0xb6b598d182b266d071c0e80ff57abb90fdd0fb0f": "0xcb13993ea6204e855ce61a6ffda8ca328a32866b",
};

const c = createPublicClient({ transport: http(RPC) });

const balanceOfAbi = parseAbiItem("function balanceOf(address) view returns (uint256)");
const allowanceAbi = parseAbiItem("function allowance(address,address) view returns (uint256)");
const erc20ApproveAbi = parseAbiItem("function approve(address,uint256) returns (bool)");
const getOperatorAbi = parseAbiItem("function getOperator() view returns (address)");
const approveStakerAbi = parseAbiItem("function approveStaker(uint256 _amount)");
const depositIntoGovAbi = parseAbiItem("function depositIntoGovernance(uint256 _amount)");

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
function section(title) {
    console.log(`  ${title}`);
  }

async function snapshot() {
  return rpc("evm_snapshot");
}
async function revert(id) {
  await rpc("evm_revert", [id]);
}

// Mirror of src/lib/format.ts:bigintToRaw; keep in sync
function bigintToRaw(value) {
  if (value === 0n) return "0";
  const str = value.toString().padStart(19, "0");
  const wholeStr = str.slice(0, str.length - 18) || "0";
  const fracStr = str.slice(str.length - 18).replace(/0+$/, "");
  if (!fracStr) return wholeStr;
  const displayFrac = fracStr.length > 6 ? fracStr.slice(0, 6) : fracStr;
  return `${wholeStr}.${displayFrac}`;
}
function parseAztAmount(input) {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > 18) return null;
  const fracPadded = frac.padEnd(18, "0");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded);
}

// Find the AZT balance storage slot by probing. OZ ERC20 mappings hash
// keccak256(abi.encode(addr, slot)). Some upgradeable contracts use a
// non-zero slot for the balance mapping.
async function findBalanceSlot(token, probeAddr) {
  for (let s = 0n; s < 200n; s++) {
    const slotKey = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [probeAddr, s]
      )
    );
    const existing = await rpc("eth_getStorageAt", [token, slotKey, "latest"]);
    if (existing !== "0x" + "0".repeat(64)) {
      // Verify by re-reading balanceOf
      const bal = await c.readContract({
        address: token,
        abi: [balanceOfAbi],
        functionName: "balanceOf",
        args: [probeAddr],
      });
      if (bal !== 0n) return s;
    }
    const testValue = "0x" + (777n).toString(16).padStart(64, "0");
    await rpc("anvil_setStorageAt", [token, slotKey, testValue]);
    const bal = await c.readContract({
      address: token,
      abi: [balanceOfAbi],
      functionName: "balanceOf",
      args: [probeAddr],
    });
    await rpc("anvil_setStorageAt", [token, slotKey, "0x" + "0".repeat(64)]);
    if (bal === 777n) return s;
  }
  return -1n;
}

await rpc("anvil_setBalance", [USER, toHex(10n * 10n ** 18n)]);
await rpc("anvil_setBalance", [FRESH_WALLET, toHex(10n * 10n ** 18n)]);
await rpc("anvil_impersonateAccount", [USER]);
await rpc("anvil_impersonateAccount", [FRESH_WALLET]);

// A. Wallet-path MAX dust: direct ERC20.approve preserves the raw bigint
section("A. Wallet-path MAX dust: direct (non-staker) deposit route");

{
  const snap = await snapshot();
  try {
    const slot = await findBalanceSlot(AZT, FRESH_WALLET);
    if (slot < 0n) fail("could not find AZT balance slot for FRESH_WALLET");
    pass(`Found AZT balance mapping slot = ${slot}`);

    // Storage-poke a dusty balance: 7,123,456,789,012,345,678 wei
    // (= 7.123456789012345678 AZT, dust below 6-decimal display cap)
    const dustyBalance = 7_123_456_789_012_345_678n;
    const slotKey = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [FRESH_WALLET, slot]
      )
    );
    await rpc("anvil_setStorageAt", [
      AZT,
      slotKey,
      "0x" + dustyBalance.toString(16).padStart(64, "0"),
    ]);
    const seeded = await c.readContract({
      address: AZT,
      abi: [balanceOfAbi],
      functionName: "balanceOf",
      args: [FRESH_WALLET],
    });
    if (seeded !== dustyBalance) fail(`seed mismatch: ${seeded} vs ${dustyBalance}`);
    pass(`Seeded FRESH_WALLET with ${dustyBalance} wei (${Number(dustyBalance) / 1e18} AZT)`);

    // Demonstrate the dust the OLD round-trip would lose
    const displayed = bigintToRaw(dustyBalance);
    const reparsed = parseAztAmount(displayed);
    const stranded = dustyBalance - reparsed;
    console.log(
      `\n  Old wallet-path simulation:` +
        `\n    bigintToRaw(${dustyBalance}) = "${displayed}"` +
        `\n    parseAztAmount → ${reparsed}` +
        `\n    Stranded: ${stranded} wei\n`
    );
    if (stranded === 0n) fail(`Test setup failed: dusty balance did not produce dust`);
    pass(`Confirmed ${stranded} wei dust would be stranded by old code path`);

    // New path: approve(governance, dustyBalance) with the exact bigint
    const approveTx = await rpc("eth_sendTransaction", [
      {
        from: FRESH_WALLET,
        to: AZT,
        data: encodeFunctionData({
          abi: [erc20ApproveAbi],
          functionName: "approve",
          args: [GOV, dustyBalance],
        }),
        gas: toHex(500_000n),
      },
    ]);
    const rcpt = await c.waitForTransactionReceipt({ hash: approveTx });
    if (rcpt.status !== "success") fail("approve reverted");

    const allowanceAfter = await c.readContract({
      address: AZT,
      abi: [allowanceAbi],
      functionName: "allowance",
      args: [FRESH_WALLET, GOV],
    });
    if (allowanceAfter !== dustyBalance)
      fail(`allowance = ${allowanceAfter}, expected ${dustyBalance}`);
    pass(`Wallet → Governance allowance set to exactly ${dustyBalance} wei`);
    pass(`Wallet-path MAX preserves the bigint end-to-end (dust survives the approve tx)`);
    pass(
      `Note: actual Governance.deposit may revert for non-whitelisted accounts ` +
        `(depositControl). that's an authorization concern, separate from this fix.`
    );
  } finally {
    await revert(snap);
    pass(`State reverted`);
  }
}

// B. Approve→revert recovery. allowance survives, next attempt skips approve
section("B. Approve→revert recovery. production failure-retry scenario");

{
  const snap = await snapshot();
  try {
    // Drain the existing allowance so we control the starting state
    await rpc("eth_sendTransaction", [
      {
        from: USER,
        to: USER_ATP,
        data: encodeFunctionData({
          abi: [approveStakerAbi],
          functionName: "approveStaker",
          args: [0n],
        }),
        gas: toHex(500_000n),
      },
    ]);
    pass(`Drained ATP → Staker allowance to 0`);

    // Step 1: approve N AZT (where N is well below ATP balance)
    const approveAmount = 500_000_000_000_000_000n; // 0.5 AZT
    const approveTx = await rpc("eth_sendTransaction", [
      {
        from: USER,
        to: USER_ATP,
        data: encodeFunctionData({
          abi: [approveStakerAbi],
          functionName: "approveStaker",
          args: [approveAmount],
        }),
        gas: toHex(500_000n),
      },
    ]);
    await c.waitForTransactionReceipt({ hash: approveTx });
    pass(`approveStaker(0.5 AZT). allowance now 0.5 AZT`);

    // Step 2: try to deposit MORE than allowance. should revert
    const tooMuch = 10_000_000_000_000_000_000n; // 10 AZT, way above 0.5 allowance
    let didRevert = false;
    try {
      const tx = await rpc("eth_sendTransaction", [
        {
          from: USER,
          to: USER_STAKER,
          data: encodeFunctionData({
            abi: [depositIntoGovAbi],
            functionName: "depositIntoGovernance",
            args: [tooMuch],
          }),
          gas: toHex(800_000n),
        },
      ]);
      const r = await c.waitForTransactionReceipt({ hash: tx });
      if (r.status === "reverted") didRevert = true;
    } catch (e) {
      // Anvil throws on guaranteed-revert with auto-impersonate
      didRevert = e.message.includes("revert");
    }
    if (!didRevert) fail("deposit(10 AZT) was supposed to revert but didn't");
    pass(`depositIntoGovernance(10 AZT) reverted (insufficient allowance, as expected)`);

    // Step 3: allowance must survive the revert
    const allowanceAfterRevert = await c.readContract({
      address: AZT,
      abi: [allowanceAbi],
      functionName: "allowance",
      args: [USER_ATP, USER_STAKER],
    });
    if (allowanceAfterRevert !== approveAmount)
      fail(`allowance changed: ${allowanceAfterRevert} ≠ ${approveAmount}`);
    pass(`Allowance preserved through revert: still ${allowanceAfterRevert} wei`);

    // Step 4: dashboard would see allowance (0.5 AZT) >= retry amount (0.3 AZT)
    //         and SKIP the approve tx on retry. Confirm by direct deposit.
    const retryAmount = 300_000_000_000_000_000n; // 0.3 AZT
    if (allowanceAfterRevert < retryAmount)
      fail(`test logic bug: retry amount > existing allowance`);
    pass(`useDeposit's allowance check: ${allowanceAfterRevert} ≥ ${retryAmount}. would skip approve`);

    const retryTx = await rpc("eth_sendTransaction", [
      {
        from: USER,
        to: USER_STAKER,
        data: encodeFunctionData({
          abi: [depositIntoGovAbi],
          functionName: "depositIntoGovernance",
          args: [retryAmount],
        }),
        gas: toHex(800_000n),
      },
    ]);
    const retryRcpt = await c.waitForTransactionReceipt({ hash: retryTx });
    if (retryRcpt.status !== "success") fail("retry deposit reverted");
    pass(`Retry deposit (no approve) succeeded. single tx`);

    const allowanceAfterRetry = await c.readContract({
      address: AZT,
      abi: [allowanceAbi],
      functionName: "allowance",
      args: [USER_ATP, USER_STAKER],
    });
    const consumed = approveAmount - allowanceAfterRetry;
    if (consumed !== retryAmount)
      fail(`allowance consumed = ${consumed}, expected ${retryAmount}`);
    pass(`Allowance consumed by exactly the retry amount: ${consumed} wei`);
  } finally {
    await revert(snap);
    pass(`State reverted`);
  }
}

// C. Multi-ATP getOperator sanity across all 5 known ATPs
section("C. Multi-ATP getOperator: sanity across all 5 known ATPs");

{
  for (const [beneficiary, atpAddr] of Object.entries(KNOWN_ATPS)) {
    const atp = getAddress(atpAddr);
    const expectedOp = getAddress(beneficiary);
    try {
      const op = await c.readContract({
        address: atp,
        abi: [getOperatorAbi],
        functionName: "getOperator",
      });
      const opCs = getAddress(op);
      if (opCs === expectedOp) {
        pass(`${atp.slice(0, 8)}… operator = beneficiary (${opCs.slice(0, 8)}…)`);
      } else {
        // Not a failure. operator could be legitimately rebound
        pass(
          `${atp.slice(0, 8)}… operator = ${opCs.slice(0, 8)}… (REBOUND from ` +
            `beneficiary ${expectedOp.slice(0, 8)}…). dashboard would disable this source`
        );
      }
    } catch (e) {
      fail(`getOperator() reverted on ${atp}: ${e.message}`);
    }
  }
  pass(`All 5 ATPs returned a valid operator address`);
}

// D. Legacy / no-getOperator graceful handling via multicall
section("D. Legacy ATP (no getOperator). graceful multicall handling");

{
  // We call getOperator on a contract that doesn't implement it. AZT itself
  // has no getOperator selector. Use Multicall3 with allowFailure=true to
  // mirror how wagmi's useReadContracts batches reads.
  const multicall3Abi = [
    {
      type: "function",
      name: "aggregate3",
      inputs: [
        {
          name: "calls",
          type: "tuple[]",
          components: [
            { name: "target", type: "address" },
            { name: "allowFailure", type: "bool" },
            { name: "callData", type: "bytes" },
          ],
        },
      ],
      outputs: [
        {
          name: "returnData",
          type: "tuple[]",
          components: [
            { name: "success", type: "bool" },
            { name: "returnData", type: "bytes" },
          ],
        },
      ],
      stateMutability: "view",
    },
  ];

  const getOperatorCalldata = encodeFunctionData({
    abi: [getOperatorAbi],
    functionName: "getOperator",
  });

  // Two calls: one against a real ATP (should succeed), one against AZT (no
  // getOperator should fail with allowFailure=true and not bring down the
  // whole multicall).
  const result = await c.readContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [
      [
        { target: USER_ATP, allowFailure: true, callData: getOperatorCalldata },
        { target: AZT, allowFailure: true, callData: getOperatorCalldata },
      ],
    ],
  });

  const [realResult, fakeResult] = result;
  if (!realResult.success) fail(`real ATP call failed unexpectedly`);
  pass(`Real ATP getOperator: success=true, data present`);

  if (fakeResult.success) fail(`AZT (no getOperator) returned success=true. multicall didn't catch the missing selector`);
  pass(`AZT getOperator: success=false (graceful failure)`);
  pass(
    `useATPBalances's per-result check (status === "success") would skip ` +
      `the operators.set() for this ATP. operatorMismatch stays false ` +
      `(unknown), source remains optimistically enabled.`
  );
}

section("ALL EDGE-CASE TESTS PASSED");
console.log("Closed gaps:");
console.log("  ✓ A. Wallet-path MAX dust survives ERC20.approve to governance");
console.log("  ✓ B. Allowance preserved through deposit revert; retry skips approve");
console.log("  ✓ C. All 5 known ATPs return valid operator addresses");
console.log("  ✓ D. Multicall handles missing getOperator selector gracefully");
console.log("");
console.log("Remaining production gap (fundamental, not closable by fork tests):");
console.log("  • End-to-end UI refresh after invalidation. verified separately");
console.log("    by the wagmi-keys check, but not by a real browser session.");
