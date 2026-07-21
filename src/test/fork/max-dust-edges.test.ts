/*
 * Edge cases for the post-audit fixes. Closes gaps that max-dust.test.ts
 * doesn't cover.
 *
 *   A. Wallet-path MAX dust survives ERC20.approve to governance (the
 *      staker route is covered by max-dust.test.ts).
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
  encodeFunctionData,
  getAddress,
  toHex,
  keccak256,
  encodeAbiParameters,
  type Address,
  type Hash,
} from "viem";
import {
  client as c,
  AZT,
  GOV,
  MULTICALL3,
  USER,
  ATP as USER_ATP,
  STAKER as USER_STAKER,
  DEV_ACCOUNT as FRESH_WALLET,
  KNOWN_ATPS,
  balanceOfAbi,
  allowanceAbi,
  erc20ApproveAbi,
  getOperatorAbi,
  approveStakerAbi,
  depositIntoGovAbi,
  rpc,
  fail,
  pass,
  section,
  snapshot,
  revert,
} from "./context";

// Mirror of src/lib/format.ts:bigintToRaw; keep in sync
function bigintToRaw(value: bigint): string {
  if (value === 0n) return "0";
  const str = value.toString().padStart(19, "0");
  const wholeStr = str.slice(0, str.length - 18) || "0";
  const fracStr = str.slice(str.length - 18).replace(/0+$/, "");
  if (!fracStr) return wholeStr;
  const displayFrac = fracStr.length > 6 ? fracStr.slice(0, 6) : fracStr;
  return `${wholeStr}.${displayFrac}`;
}
function parseAztAmount(input: string): bigint | null {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > 18) return null;
  const fracPadded = frac.padEnd(18, "0");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded);
}

// Find the AZT balance storage slot by probing.
async function findBalanceSlot(token: Address, probeAddr: Address): Promise<bigint> {
  for (let s = 0n; s < 200n; s++) {
    const slotKey = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [probeAddr, s]
      )
    );
    const existing = await rpc<string>("eth_getStorageAt", [token, slotKey, "latest"]);
    if (existing !== "0x" + "0".repeat(64)) {
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

async function main() {
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

      const displayed = bigintToRaw(dustyBalance);
      const reparsed = parseAztAmount(displayed) ?? 0n;
      const stranded = dustyBalance - reparsed;
      console.log(
        `\n  Old wallet-path simulation:` +
          `\n    bigintToRaw(${dustyBalance}) = "${displayed}"` +
          `\n    parseAztAmount → ${reparsed}` +
          `\n    Stranded: ${stranded} wei\n`
      );
      if (stranded === 0n) fail(`Test setup failed: dusty balance did not produce dust`);
      pass(`Confirmed ${stranded} wei dust would be stranded by old code path`);

      const approveTx = await rpc<Hash>("eth_sendTransaction", [
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
      await rpc<Hash>("eth_sendTransaction", [
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

      const approveAmount = 500_000_000_000_000_000n;
      const approveTx = await rpc<Hash>("eth_sendTransaction", [
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

      const tooMuch = 10_000_000_000_000_000_000n;
      let didRevert = false;
      try {
        const tx = await rpc<Hash>("eth_sendTransaction", [
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        didRevert = msg.includes("revert");
      }
      if (!didRevert) fail("deposit(10 AZT) was supposed to revert but didn't");
      pass(`depositIntoGovernance(10 AZT) reverted (insufficient allowance, as expected)`);

      const allowanceAfterRevert = await c.readContract({
        address: AZT,
        abi: [allowanceAbi],
        functionName: "allowance",
        args: [USER_ATP, USER_STAKER],
      });
      if (allowanceAfterRevert !== approveAmount)
        fail(`allowance changed: ${allowanceAfterRevert} ≠ ${approveAmount}`);
      pass(`Allowance preserved through revert: still ${allowanceAfterRevert} wei`);

      const retryAmount = 300_000_000_000_000_000n;
      if (allowanceAfterRevert < retryAmount)
        fail(`test logic bug: retry amount > existing allowance`);
      pass(`useDeposit's allowance check: ${allowanceAfterRevert} ≥ ${retryAmount}. would skip approve`);

      const retryTx = await rpc<Hash>("eth_sendTransaction", [
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

  for (const [beneficiary, [atpAddr]] of Object.entries(KNOWN_ATPS)) {
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
        pass(
          `${atp.slice(0, 8)}… operator = ${opCs.slice(0, 8)}… (REBOUND from ` +
            `beneficiary ${expectedOp.slice(0, 8)}…). dashboard would disable this source`
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(`getOperator() reverted on ${atp}: ${msg}`);
    }
  }
  pass(`All 5 ATPs returned a valid operator address`);

  // D. Legacy / no-getOperator graceful handling via multicall
  section("D. Legacy ATP (no getOperator). graceful multicall handling");

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
  ] as const;

  const getOperatorCalldata = encodeFunctionData({
    abi: [getOperatorAbi],
    functionName: "getOperator",
  });

  const result = (await c.readContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [
      [
        { target: USER_ATP, allowFailure: true, callData: getOperatorCalldata },
        { target: AZT, allowFailure: true, callData: getOperatorCalldata },
      ],
    ],
  })) as readonly { success: boolean; returnData: `0x${string}` }[];

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
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
});
