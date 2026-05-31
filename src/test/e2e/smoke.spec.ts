import { expect } from "@playwright/test";
import {
  test,
  injectMockWallet,
  CANONICAL_USER,
  connectWallet,
} from "./helpers/setup";

test.describe("smoke: mock wallet + page load", () => {
  test("page loads with wallet disconnected, shows Connect CTA", async ({ page }) => {
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await expect(page).toHaveTitle(/aztec|governance/i);
    const connectBtn = page.getByRole("button", { name: /connect.*wallet/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });
  });

  test("can connect mock wallet via RainbowKit and address renders", async ({ page }) => {
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await connectWallet(page);

    const truncated = `${CANONICAL_USER.slice(0, 6)}...${CANONICAL_USER.slice(-4)}`;
    await expect(page.getByText(truncated, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
