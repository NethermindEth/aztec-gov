import { expect } from "@playwright/test";
import {
  test,
  injectMockWallet,
  connectWallet,
  openWithdrawModal as openWithdrawModalHelper,
  CANONICAL_USER,
  CANONICAL_STAKER,
  snapshot,
  revert,
  anvilRpc,
  GOV,
} from "./helpers/setup";

async function openWithdrawModal(page: import("@playwright/test").Page) {
  await injectMockWallet(page, CANONICAL_USER);
  await page.goto("/");
  await connectWallet(page);
  await openWithdrawModalHelper(page);
}

const powerNowCall = `0xe1d74644${CANONICAL_STAKER.slice(2).padStart(64, "0")}`;
async function readStakerPower(): Promise<bigint> {
  return BigInt(
    await anvilRpc<string>("eth_call", [{ to: GOV, data: powerNowCall }, "latest"])
  );
}

test.describe("WithdrawModal", () => {
  test("opens, shows source picker with staker", async ({ page }) => {
    await openWithdrawModal(page);
    const dialog = page.getByRole("dialog", { name: /withdraw from position/i });
    await expect(
      dialog.getByText(/^withdraw from$/i, { exact: false }).first()
    ).toBeVisible();
    await expect(dialog.getByText(/direct deposit/i)).toBeVisible();
    const stakerTrunc = `${CANONICAL_STAKER.slice(0, 6)}…${CANONICAL_STAKER.slice(-4)}`;
    await expect(dialog.getByText(stakerTrunc, { exact: false })).toBeVisible();
  });

  test("MAX preserves exact bigint: staker power lands at 0", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await openWithdrawModal(page);

      const powerBefore = await readStakerPower();
      expect(powerBefore).toBeGreaterThan(0n);

      await page.getByRole("button", { name: /^max$/i }).click();
      await page
        .getByRole("dialog", { name: /withdraw from position/i })
        .getByRole("button", { name: /confirm withdrawal/i })
        .click();

      await expect(
        page.getByRole("heading", { name: /withdrawal initiated/i })
      ).toBeVisible({ timeout: 30_000 });

      // Power must hit 0 exactly; any leftover would be stranded dust.
      expect(await readStakerPower()).toBe(0n);
    } finally {
      await revert(snapId);
    }
  });

  test("typing clears maxOverride: submits typed value, not MAX bigint", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await openWithdrawModal(page);
      const powerBefore = await readStakerPower();
      expect(powerBefore).toBeGreaterThan(10n ** 18n);

      await page.getByRole("button", { name: /^max$/i }).click();
      const input = page.locator('input[placeholder="0"]');
      expect(await input.inputValue()).not.toBe("");
      await input.fill("0.5");

      await page
        .getByRole("dialog", { name: /withdraw from position/i })
        .getByRole("button", { name: /confirm withdrawal/i })
        .click();
      await expect(
        page.getByRole("heading", { name: /withdrawal initiated/i })
      ).toBeVisible({ timeout: 30_000 });

      // Delta must equal typed 0.5 AZT; a leaking maxOverride would zero the staker.
      expect(powerBefore - (await readStakerPower())).toBe(5n * 10n ** 17n);
    } finally {
      await revert(snapId);
    }
  });

  test("amount > available shows error and disables submit", async ({ page }) => {
    await openWithdrawModal(page);
    const input = page.locator('input[placeholder="0"]');
    await input.fill("999999999");
    const dialog = page.getByRole("dialog", { name: /withdraw from position/i });
    await expect(dialog.getByText(/exceeds available power/i)).toBeVisible();
    const confirm = dialog.getByRole("button", { name: /confirm withdrawal/i });
    await expect(confirm).toBeDisabled();
  });

  test("Cancel button closes the modal", async ({ page }) => {
    await openWithdrawModal(page);
    await page
      .getByRole("dialog", { name: /withdraw from position/i })
      .getByRole("button", { name: /^cancel$/i })
      .click();
    await expect(
      page.getByRole("dialog", { name: /withdraw from position/i })
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("Escape closes the modal", async ({ page }) => {
    await openWithdrawModal(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: /withdraw from position/i })
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("Withdrawal note matches selected source (staker → vault-release copy + delay)", async ({ page }) => {
    // ATP-only user auto-selects staker, so must show the vault-release
    // copy and the resolved delay from Configuration.withdrawDelay().
    await openWithdrawModal(page);
    const dialog = page.getByRole("dialog", { name: /withdraw from position/i });
    await expect(dialog.getByText(/funds will be released to your vault/i)).toBeVisible();
    await expect(dialog.getByText(/voting power will decrease immediately/i)).not.toBeVisible();
    await expect(dialog.getByText(/withdrawal delay:\s*~?\d+d/i)).toBeVisible();
  });
});
