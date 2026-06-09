import { expect } from "@playwright/test";
import {
  test,
  injectMockWallet,
  connectWallet,
  waitForDashboardReady,
  CANONICAL_USER,
  CANONICAL_ATP,
  CANONICAL_STAKER,
  snapshot,
  revert,
  anvilRpc,
  AZT,
  GOV,
} from "./helpers/setup";

async function readBalance(addr: string, holder: string): Promise<bigint> {
  const r = await anvilRpc<string>("eth_call", [
    { to: addr, data: `0x70a08231${holder.slice(2).padStart(64, "0")}` },
    "latest",
  ]);
  return BigInt(r);
}

async function readPower(holder: string): Promise<bigint> {
  const r = await anvilRpc<string>("eth_call", [
    { to: GOV, data: `0xe1d74644${holder.slice(2).padStart(64, "0")}` },
    "latest",
  ]);
  return BigInt(r);
}

test.describe("integration: full flows + invalidation refresh", () => {
  test("deposit via staker: ATP balance → 0, staker power increases, UI refreshes", async ({ page }) => {
    const snapId = await snapshot();
    try {
      const atpBalBefore = await readBalance(AZT, CANONICAL_ATP);
      const stakerPowerBefore = await readPower(CANONICAL_STAKER);
      expect(atpBalBefore).toBeGreaterThan(0n);

      await injectMockWallet(page, CANONICAL_USER);
      await page.goto("/");
      await connectWallet(page);
      await waitForDashboardReady(page);

      await page.getByRole("button", { name: /^deposit$/i }).first().click();
      await expect(
        page.getByRole("dialog", { name: /deposit azt/i })
      ).toBeVisible();

      await page.getByRole("button", { name: /^max$/i }).click();
      await page
        .getByRole("dialog", { name: /deposit azt/i })
        .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i })
        .click();
      await expect(
        page.getByRole("heading", { name: /deposit successful/i })
      ).toBeVisible({ timeout: 30_000 });

      expect(await readBalance(AZT, CANONICAL_ATP)).toBe(0n);
      expect((await readPower(CANONICAL_STAKER)) - stakerPowerBefore).toBe(atpBalBefore);

      await page
        .getByRole("dialog", { name: /deposit azt/i })
        .getByRole("button", { name: /^close$/i })
        .click();

      // Invalidation drained the only depositable source → Deposit CTA hides;
      // Withdraw stays because staker power grew.
      await expect(
        page.getByRole("button", { name: /^deposit$/i }).first()
      ).not.toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole("button", { name: /^withdraw$/i }).first()
      ).toBeVisible();
    } finally {
      await revert(snapId);
    }
  });

  test("withdraw via staker: staker power → 0, Withdraw CTA hides after invalidation", async ({ page }) => {
    const snapId = await snapshot();
    try {
      const stakerPowerBefore = await readPower(CANONICAL_STAKER);
      expect(stakerPowerBefore).toBeGreaterThan(0n);

      await injectMockWallet(page, CANONICAL_USER);
      await page.goto("/");
      await connectWallet(page);
      await waitForDashboardReady(page);

      await page.getByRole("button", { name: /^withdraw$/i }).first().click();
      const dialog = page.getByRole("dialog", { name: /withdraw from position/i });
      await expect(dialog).toBeVisible();

      await page.getByRole("button", { name: /^max$/i }).click();
      await dialog.getByRole("button", { name: /confirm withdrawal/i }).click();
      await expect(
        page.getByRole("heading", { name: /withdrawal initiated/i })
      ).toBeVisible({ timeout: 30_000 });

      expect(await readPower(CANONICAL_STAKER)).toBe(0n);

      // CTA hiding is a deterministic invalidation signal that avoids waiting
      // on the 20s+ log-scan refetch.
      await dialog.getByRole("button", { name: /^done$/i }).click();
      await expect(
        page.getByRole("button", { name: /^withdraw$/i }).first()
      ).not.toBeVisible({ timeout: 15_000 });
    } finally {
      await revert(snapId);
    }
  });

  // Regression guard against NEXT_PUBLIC_DEV_NOW_OVERRIDE leaking into a
  // production-style test run. A fresh withdrawal unlocks ~37 days out, so
  // it must surface as "Unlocking" with a countdown, never "Ready to claim".
  // If a future date override is set, this test fails immediately.
  test("fresh withdrawal surfaces with Unlocking status, not Ready to claim", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await injectMockWallet(page, CANONICAL_USER);
      await page.goto("/");
      await connectWallet(page);
      await waitForDashboardReady(page);

      await page.getByRole("button", { name: /^withdraw$/i }).first().click();
      const dialog = page.getByRole("dialog", { name: /withdraw from position/i });
      await page.getByRole("button", { name: /^max$/i }).click();
      await dialog.getByRole("button", { name: /confirm withdrawal/i }).click();
      await expect(
        page.getByRole("heading", { name: /withdrawal initiated/i })
      ).toBeVisible({ timeout: 30_000 });
      await dialog.getByRole("button", { name: /^done$/i }).click();

      // useWithdrawals log scan needs to pick up the new entry. In E2E mode
      // MAX_BLOCKS_BACK shrinks to 50k so this resolves in ~2s.
      await expect(
        page.getByText(/withdrawals\s*\(\d+\)/i)
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^unlocking$/i).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/ready to claim/i)).not.toBeVisible();
      await expect(page.getByText(/unlocks in/i).first()).toBeVisible();
    } finally {
      await revert(snapId);
    }
  });
});
