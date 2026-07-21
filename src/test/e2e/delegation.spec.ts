import { expect } from "@playwright/test";
import { createPublicClient, http, getAddress, toHex, type Address } from "viem";
import {
  test,
  injectMockWallet,
  connectWallet,
  waitForDashboardReady,
  anvilRpc,
  snapshot,
  revert,
  RPC,
} from "./helpers/setup";
import {
  resolveGse,
  findEoaWithdrawerActor,
  getDelegateeAbi,
  getLatestRollupAbi,
  supplyOfAbi,
  getAttesterCountAtTimeAbi,
  type GseDeployment,
  type WithdrawerActor,
} from "../shared/gse";

// Delegation UI (issue #13) against real fork state, acting as a runtime-
// discovered EOA withdrawer. GSE.vote coverage lives in the delegate fork test.

const client = createPublicClient({ transport: http(RPC) });

let deployment: GseDeployment;
let actor: WithdrawerActor;

// Touches the supply/count slots discovery reads; the actor sweep already
// warmed attesters and withdrawers. Cold slots are upstream fetches on a fork.
async function warmDiscoveryPath(gse: Address, bonus: Address): Promise<void> {
  const ts = (await client.getBlock()).timestamp;
  const latest = getAddress(
    await client.readContract({
      address: gse,
      abi: [getLatestRollupAbi],
      functionName: "getLatestRollup",
    })
  );
  for (const instance of [bonus, latest]) {
    await client.readContract({
      address: gse,
      abi: [supplyOfAbi],
      functionName: "supplyOf",
      args: [instance],
    });
    await client.readContract({
      address: gse,
      abi: [getAttesterCountAtTimeAbi],
      functionName: "getAttesterCountAtTime",
      args: [instance, ts],
    });
  }
}

test.describe("Delegation (GSE)", () => {
  // Discovery through a cold fork pulls storage from the upstream RPC.
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    // Actor discovery plus cache warmup walk a few hundred cold fork slots.
    test.setTimeout(300_000);
    deployment = await resolveGse(client);
    actor = await findEoaWithdrawerActor(client, deployment.gse, deployment.bonus);
    await anvilRpc("anvil_setBalance", [actor.withdrawer, toHex(10n * 10n ** 18n)]);
    await warmDiscoveryPath(deployment.gse, deployment.bonus);
  });

  test("panel surfaces the stake; modal lists it with the rollup default", async ({
    page,
  }) => {
    await injectMockWallet(page, actor.withdrawer);
    await page.goto("/");
    await connectWallet(page);
    await waitForDashboardReady(page);

    await expect(page.getByText(/of staked voting power/i)).toBeVisible({
      timeout: 120_000,
    });
    await page.getByRole("button", { name: /^delegate$/i }).click();

    const dialog = page.getByRole("dialog", { name: /delegate voting power/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^sequencer 0x/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(dialog.getByText(/rollup \(default\)/i).first()).toBeVisible();
    await expect(dialog.getByText(/my wallet \(vote yourself\)/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("delegate to self lands on-chain and the panel updates", async ({
    page,
  }) => {
    const snapId = await snapshot();
    try {
      await injectMockWallet(page, actor.withdrawer);
      await page.goto("/");
      await connectWallet(page);
      await waitForDashboardReady(page);

      await expect(page.getByText(/of staked voting power/i)).toBeVisible({
        timeout: 120_000,
      });
      await expect(page.getByText(/delegated to the rollup/i)).toBeVisible();
      await page.getByRole("button", { name: /^delegate$/i }).click();

      const dialog = page.getByRole("dialog", {
        name: /delegate voting power/i,
      });
      await expect(dialog.getByText(/^sequencer 0x/i).first()).toBeVisible({
        timeout: 60_000,
      });
      await dialog.getByRole("button", { name: /^delegate/i }).click();

      await expect(dialog.getByText(/delegation updated/i)).toBeVisible({
        timeout: 60_000,
      });

      // Contract state agrees before the UI assertion.
      const delegatee = await client.readContract({
        address: deployment.gse,
        abi: [getDelegateeAbi],
        functionName: "getDelegatee",
        args: [deployment.bonus, actor.attester],
      });
      expect(getAddress(delegatee)).toBe(actor.withdrawer);

      await dialog.getByRole("button", { name: /^close$/i }).click();

      // Invalidation refetches discovery; the summary flips to "you".
      await expect(page.getByText(/delegated to you/i)).toBeVisible({
        timeout: 120_000,
      });
    } finally {
      await revert(snapId);
    }
  });
});
