// GSE delegation + delegated voting (issue #13) against live mainnet-fork
// state: discovery, delegate, withdrawer auth, GSE.vote, snapshot math parity.
import {
  encodeFunctionData,
  getAddress,
  parseAbiItem,
  toHex,
  type Address,
  type Hash,
} from "viem";
import {
  client as c,
  GOV,
  AZT,
  DEV_ACCOUNT,
  erc20ApproveAbi,
  govDepositAbi,
  rpc,
  snapshot,
  revert,
  fail,
  pass,
} from "./context";
import {
  resolveGse,
  findEoaWithdrawerActor,
  getDelegateeAbi,
  gseDelegateAbi,
} from "../shared/gse";

// Fork-only ABI fragments; the shared GSE set lives in ../shared/gse.
const getVotingPowerAbi = parseAbiItem(
  "function getVotingPower(address _delegatee) view returns (uint256)"
);
const getVotingPowerAtAbi = parseAbiItem(
  "function getVotingPowerAt(address _delegatee, uint256 _timestamp) view returns (uint256)"
);
const getPowerUsedAbi = parseAbiItem(
  "function getPowerUsed(address _delegatee, uint256 _proposalId) view returns (uint256)"
);
const gseVoteAbi = parseAbiItem(
  "function vote(uint256 _proposalId, uint256 _amount, bool _support)"
);

const erc20TransferAbi = parseAbiItem(
  "function transfer(address to, uint256 amount) returns (bool)"
);
const floodgatesAbi = parseAbiItem(
  "function isAllBeneficiariesAllowed() view returns (bool)"
);
const proposeWithLockAbi = parseAbiItem(
  "function proposeWithLock(address _proposal, address _to) returns (uint256)"
);
const proposalCountAbi = parseAbiItem(
  "function proposalCount() view returns (uint256)"
);
const proposalStateAbi = parseAbiItem(
  "function getProposalState(uint256 _proposalId) view returns (uint8)"
);
// Full ProposalData tuple, matching GovernanceAbi's getProposal output shape.
const getProposalAbi = parseAbiItem(
  "function getProposal(uint256 _proposalId) view returns (((uint256 votingDelay, uint256 votingDuration, uint256 executionDelay, uint256 gracePeriod, uint256 quorum, uint256 voteDifferential, uint256 minimumVotes) configuration, uint8 state, address payload, address creator, uint256 creation, (uint256 yea, uint256 nay) summedBallot))"
);
const getConfigurationAbi = parseAbiItem(
  "function getConfiguration() view returns (((uint256 lockDelay, uint256 lockAmount) proposeConfig, uint256 votingDelay, uint256 votingDuration, uint256 executionDelay, uint256 gracePeriod, uint256 quorum, uint256 requiredYeaMargin, uint256 minimumVotes))"
);

const GAS = toHex(1_000_000n);

async function send(from: Address, to: Address, data: `0x${string}`, gas = GAS) {
  await rpc("anvil_impersonateAccount", [from]);
  const tx = await rpc<Hash>("eth_sendTransaction", [{ from, to, data, gas }]);
  return c.waitForTransactionReceipt({ hash: tx });
}

async function main() {
  console.log("\n--- Setup: resolve GSE from the registry, pick a live attester ---");

  const { rollup, gse, bonus } = await resolveGse(c);
  console.log(`  rollup=${rollup}\n  gse=${gse}\n  bonus instance=${bonus}`);

  const { attester, withdrawer, balance } = await findEoaWithdrawerActor(c, gse, bonus);
  const delegatee0 = getAddress(
    await c.readContract({
      address: gse,
      abi: [getDelegateeAbi],
      functionName: "getDelegatee",
      args: [bonus, attester],
    })
  );
  console.log(
    `  attester=${attester}\n  withdrawer=${withdrawer}\n  stake=${Number(balance) / 1e18} AZT\n  current delegatee=${delegatee0}${delegatee0 === bonus ? " (rollup default)" : ""}`
  );
  pass("Discovery: attester enumeration surfaced a live EOA-withdrawer stake");

  const snapId = await snapshot();
  try {
    await rpc("anvil_setBalance", [withdrawer, toHex(10n * 10n ** 18n)]);

    console.log("\n--- Test 1: delegate to self as the withdrawer (dashboard calldata) ---");
    const delegateCalldata = encodeFunctionData({
      abi: [gseDelegateAbi],
      functionName: "delegate",
      args: [bonus, attester, withdrawer],
    });
    console.log(`  calldata: ${delegateCalldata.slice(0, 42)}…`);

    const powerSelfBefore = await c.readContract({
      address: gse,
      abi: [getVotingPowerAbi],
      functionName: "getVotingPower",
      args: [withdrawer],
    });
    const powerOldBefore = await c.readContract({
      address: gse,
      abi: [getVotingPowerAbi],
      functionName: "getVotingPower",
      args: [delegatee0],
    });

    const rcpt = await send(withdrawer, gse, delegateCalldata);
    if (rcpt.status !== "success") fail("delegate tx reverted for the legitimate withdrawer");

    const delegateeAfter = getAddress(
      await c.readContract({
        address: gse,
        abi: [getDelegateeAbi],
        functionName: "getDelegatee",
        args: [bonus, attester],
      })
    );
    if (delegateeAfter !== withdrawer)
      fail(`delegatee not updated (${delegateeAfter} vs ${withdrawer})`);

    const powerSelfAfter = await c.readContract({
      address: gse,
      abi: [getVotingPowerAbi],
      functionName: "getVotingPower",
      args: [withdrawer],
    });
    const powerOldAfter = await c.readContract({
      address: gse,
      abi: [getVotingPowerAbi],
      functionName: "getVotingPower",
      args: [delegatee0],
    });
    if (powerSelfAfter - powerSelfBefore !== balance)
      fail(`delegatee power didn't gain the stake (Δ ${powerSelfAfter - powerSelfBefore} vs ${balance})`);
    if (powerOldBefore - powerOldAfter !== balance)
      fail(`old delegatee power didn't drop by the stake (Δ ${powerOldBefore - powerOldAfter} vs ${balance})`);
    pass(`Delegate: power moved ${Number(balance) / 1e18} AZT from ${delegatee0.slice(0, 10)}… to the withdrawer`);

    console.log("\n--- Test 2: non-withdrawer cannot delegate ---");
    await rpc("anvil_setBalance", [DEV_ACCOUNT, toHex(10n * 10n ** 18n)]);
    const stealCalldata = encodeFunctionData({
      abi: [gseDelegateAbi],
      functionName: "delegate",
      args: [bonus, attester, DEV_ACCOUNT],
    });
    const stealRcpt = await send(DEV_ACCOUNT, gse, stealCalldata);
    if (stealRcpt.status !== "reverted")
      fail("delegate from a non-withdrawer did NOT revert");
    pass("Authorization: GSE__NotWithdrawer enforced for non-withdrawers");

    console.log("\n--- Test 3: vote with delegated power via GSE.vote ---");
    const floodgates = await c.readContract({
      address: GOV,
      abi: [floodgatesAbi],
      functionName: "isAllBeneficiariesAllowed",
    });
    if (!floodgates) fail("deposit floodgates closed on fork; direct deposit path gone");

    const config = await c.readContract({
      address: GOV,
      abi: [getConfigurationAbi],
      functionName: "getConfiguration",
    });
    const lockAmount = config.proposeConfig.lockAmount;
    const votingDelay = config.votingDelay;
    console.log(`  lockAmount=${Number(lockAmount) / 1e18} AZT, votingDelay=${votingDelay}s`);

    // Fund the proposer with AZT out of the governance pool (harmless inside
    // the snapshot), deposit it, and lock it into a fresh proposal.
    await rpc("anvil_setBalance", [GOV, toHex(10n * 10n ** 18n)]);
    const fundRcpt = await send(
      GOV,
      AZT,
      encodeFunctionData({
        abi: [erc20TransferAbi],
        functionName: "transfer",
        args: [withdrawer, lockAmount],
      })
    );
    if (fundRcpt.status !== "success") fail("funding transfer reverted");

    const approveRcpt = await send(
      withdrawer,
      AZT,
      encodeFunctionData({
        abi: [erc20ApproveAbi],
        functionName: "approve",
        args: [GOV, lockAmount],
      })
    );
    if (approveRcpt.status !== "success") fail("approve reverted");
    const depositRcpt = await send(
      withdrawer,
      GOV,
      encodeFunctionData({
        abi: [govDepositAbi],
        functionName: "deposit",
        args: [withdrawer, lockAmount],
      })
    );
    if (depositRcpt.status !== "success") fail("governance deposit reverted");

    // Reuse a past proposal's payload; it's only dereferenced at execution.
    const proposal0 = await c.readContract({
      address: GOV,
      abi: [getProposalAbi],
      functionName: "getProposal",
      args: [0n],
    });
    const payload = proposal0.payload;

    const proposeRcpt = await send(
      withdrawer,
      GOV,
      encodeFunctionData({
        abi: [proposeWithLockAbi],
        functionName: "proposeWithLock",
        args: [payload, withdrawer],
      }),
      toHex(2_000_000n)
    );
    if (proposeRcpt.status !== "success") fail("proposeWithLock reverted");

    const pid =
      (await c.readContract({
        address: GOV,
        abi: [proposalCountAbi],
        functionName: "proposalCount",
      })) - 1n;

    await rpc("evm_increaseTime", [Number(votingDelay) + 1]);
    await rpc("evm_mine", []);

    const state = await c.readContract({
      address: GOV,
      abi: [proposalStateAbi],
      functionName: "getProposalState",
      args: [pid],
    });
    if (state !== 1) fail(`proposal ${pid} not Active after warp (state=${state})`);
    pass(`Fresh proposal id=${pid} is Active`);

    const voteAmount = balance / 2n;
    const voteRcpt = await send(
      withdrawer,
      gse,
      encodeFunctionData({
        abi: [gseVoteAbi],
        functionName: "vote",
        args: [pid, voteAmount, true],
      })
    );
    if (voteRcpt.status !== "success") fail("GSE.vote reverted for the delegatee");

    const used = await c.readContract({
      address: gse,
      abi: [getPowerUsedAbi],
      functionName: "getPowerUsed",
      args: [withdrawer, pid],
    });
    if (used !== voteAmount) fail(`powerUsed wrong (${used} vs ${voteAmount})`);

    const proposalAfter = await c.readContract({
      address: GOV,
      abi: [getProposalAbi],
      functionName: "getProposal",
      args: [pid],
    });
    if (proposalAfter.summedBallot.yea !== voteAmount)
      fail(`ballot yea wrong (${proposalAfter.summedBallot.yea} vs ${voteAmount})`);
    pass(`GSE.vote: ${Number(voteAmount) / 1e18} AZT of delegated power landed as yea votes`);

    // Overspending the snapshot allowance must revert.
    const overspendRcpt = await send(
      withdrawer,
      gse,
      encodeFunctionData({
        abi: [gseVoteAbi],
        functionName: "vote",
        args: [pid, balance, true],
      })
    );
    if (overspendRcpt.status !== "reverted") fail("overspend vote did NOT revert");
    pass("Overspend beyond snapshot power reverts (Delegation__InsufficientPower)");

    console.log("\n--- Test 4: dashboard read parity (useGseProposalPower math) ---");
    const snapshotTs = proposalAfter.creation + proposalAfter.configuration.votingDelay;
    const powerAt = await c.readContract({
      address: gse,
      abi: [getVotingPowerAtAbi],
      functionName: "getVotingPowerAt",
      args: [withdrawer, snapshotTs],
    });
    const available = powerAt > used ? powerAt - used : 0n;
    if (powerAt !== balance)
      fail(`snapshot power != stake (${powerAt} vs ${balance}): delegation missed the snapshot`);
    if (available !== balance - voteAmount)
      fail(`modal available-power math wrong (${available} vs ${balance - voteAmount})`);
    pass(`Read parity: available = powerAt(${Number(powerAt) / 1e18}) − used(${Number(used) / 1e18}) matches contract behavior`);
  } finally {
    await revert(snapId);
    pass("State reverted via evm_revert");
  }

  console.log("\n  ALL TESTS PASSED");
  console.log("Verified end-to-end:");
  console.log("  ✓ Delegate: withdrawer re-delegates a real bonus-instance stake, power moves 1:1");
  console.log("  ✓ Authorization: non-withdrawers are rejected");
  console.log("  ✓ Delegated vote: GSE.vote spends the delegated power into a live proposal's ballot");
  console.log("  ✓ Accounting: per-proposal snapshot + powerUsed math matches the modal's max calculation");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
});
