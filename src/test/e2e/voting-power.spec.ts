import { expect } from "@playwright/test";
import {
  test,
  injectMockWallet,
  connectWallet,
  waitForDashboardReady,
  CANONICAL_USER,
} from "./helpers/setup";

test.describe("VotingPowerPanel: read-side", () => {
  test("connected user sees voting power + supply % rendered", async ({ page }) => {
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await connectWallet(page);
    await waitForDashboardReady(page);

    // % label is the residual signal after waitForDashboardReady proved the AZT value.
    await expect(page.getByText(/of total supply/i).first()).toBeVisible();
  });

  test("Withdraw button is enabled when staker power > 0", async ({ page }) => {
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await connectWallet(page);
    await waitForDashboardReady(page);

    const withdrawBtn = page.getByRole("button", { name: /^withdraw$/i });
    await expect(withdrawBtn).toBeVisible();
    await expect(withdrawBtn).toBeEnabled();
  });

  test("Deposit CTA visible for ATP-operator with balance", async ({ page }) => {
    // Exercises the depositableATP branch of the gate (wallet=0, vault>0).
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await connectWallet(page);
    await waitForDashboardReady(page);

    const depositBtn = page.getByRole("button", { name: /^deposit$/i });
    await expect(depositBtn).toBeVisible();
  });
});
