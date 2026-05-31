import { expect } from "@playwright/test";
import { keccak256, encodeAbiParameters } from "viem";
import {
  test,
  injectMockWallet,
  connectWallet,
  openDepositModal as openDepositModalHelper,
  CANONICAL_USER,
  CANONICAL_ATP,
  snapshot,
  revert,
  anvilRpc,
  AZT,
} from "./helpers/setup";

async function openDepositModal(page: import("@playwright/test").Page) {
  await injectMockWallet(page, CANONICAL_USER);
  await page.goto("/");
  await connectWallet(page);
  await openDepositModalHelper(page);
}

const atpBalanceCall = `0x70a08231${CANONICAL_ATP.slice(2).padStart(64, "0")}`;
async function readAtpBalance(): Promise<bigint> {
  return BigInt(
    await anvilRpc<string>("eth_call", [{ to: AZT, data: atpBalanceCall }, "latest"])
  );
}

test.describe("DepositModal", () => {
  test("opens, shows source picker with vault (ATP-only user)", async ({ page }) => {
    await openDepositModal(page);
    await expect(page.getByText(/deposit from/i)).toBeVisible();
    await expect(page.getByText(/wallet \(direct\)/i)).toBeVisible();
    const atpTruncated = `${CANONICAL_ATP.slice(0, 6)}…${CANONICAL_ATP.slice(-4)}`;
    await expect(page.getByText(atpTruncated, { exact: false })).toBeVisible();
  });

  test("auto-selects highest-balance source (vault, not Direct, for ATP-only user)", async ({ page }) => {
    // Wallet=0, vault=2.962188205520823244 AZT, so picker must pick vault.
    // Verify by MAX-populating the input; Direct (0 AZT) would produce "" or "0".
    await openDepositModal(page);
    await page.getByRole("button", { name: /^max$/i }).click();
    const value = await page.locator('input[placeholder="0"]').inputValue();
    expect(value.replace(/,/g, "")).toMatch(/^2\.962188/);
  });

  test("MAX preserves exact bigint on submit (no dust stranded)", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await openDepositModal(page);

      const balBefore = await readAtpBalance();
      expect(balBefore).toBeGreaterThan(0n);

      await page.getByRole("button", { name: /^max$/i }).click();
      await page
        .getByRole("dialog", { name: /deposit azt/i })
        .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i })
        .click();

      await expect(
        page.getByRole("heading", { name: /deposit successful/i })
      ).toBeVisible({ timeout: 30_000 });

      // ATP must hit 0 exactly; dust would mean maxOverride lost precision.
      expect(await readAtpBalance()).toBe(0n);
    } finally {
      await revert(snapId);
    }
  });

  test("typing into input clears maxOverride: submits typed value, not MAX bigint", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await openDepositModal(page);
      const input = page.locator('input[placeholder="0"]');
      const balBefore = await readAtpBalance();

      await page.getByRole("button", { name: /^max$/i }).click();
      expect(await input.inputValue()).not.toBe("");
      await input.fill("0.1");

      await page
        .getByRole("dialog", { name: /deposit azt/i })
        .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i })
        .click();
      await expect(
        page.getByRole("heading", { name: /deposit successful/i })
      ).toBeVisible({ timeout: 30_000 });

      // Delta must equal typed 0.1 AZT; a leaking maxOverride would send ~2.96 AZT.
      expect(balBefore - (await readAtpBalance())).toBe(10n ** 17n);
    } finally {
      await revert(snapId);
    }
  });

  test("source switch clears the amount input", async ({ page }) => {
    // Direct is disabled when wallet=0; poke a wallet balance so both sources
    // are selectable. AZT balance lives at slot 1 (empirically established).
    const snapId = await snapshot();
    try {
      const slotKey = keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [CANONICAL_USER as `0x${string}`, 1n]
        )
      );
      const fundAmount = "0x" + (10n ** 18n).toString(16).padStart(64, "0");
      await anvilRpc("anvil_setStorageAt", [AZT, slotKey, fundAmount]);

      await openDepositModal(page);
      const dialog = page.getByRole("dialog", { name: /deposit azt/i });

      await page.getByRole("button", { name: /^max$/i }).click();
      const input = page.locator('input[placeholder="0"]');
      expect(await input.inputValue()).not.toBe("");

      const directRow = dialog.getByRole("button", { name: /wallet \(direct\)/i });
      await expect(directRow).toBeEnabled();
      await directRow.click();

      await expect(input).toHaveValue("");
    } finally {
      await revert(snapId);
    }
  });

  test("Escape key closes the modal", async ({ page }) => {
    await openDepositModal(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /deposit azt/i })
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("close (X) button closes the modal", async ({ page }) => {
    await openDepositModal(page);
    const closeBtn = page
      .locator('button:has(svg path[d*="M1 1L11 11M1 11L11 1"])')
      .first();
    await closeBtn.click();
    await expect(
      page.getByRole("heading", { name: /deposit azt/i })
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("invalid amount > available shows error and disables submit", async ({ page }) => {
    await openDepositModal(page);
    await page.locator('input[placeholder="0"]').fill("100000");
    await expect(page.getByText(/exceeds available/i)).toBeVisible();
    const confirmBtn = page
      .getByRole("dialog", { name: /deposit azt/i })
      .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i });
    await expect(confirmBtn).toBeDisabled();
  });

  test("zero amount disables submit", async ({ page }) => {
    await openDepositModal(page);
    const input = page.locator('input[placeholder="0"]');
    await input.fill("0");
    const confirmBtn = page
      .getByRole("dialog", { name: /deposit azt/i })
      .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i });
    await expect(confirmBtn).toBeDisabled();
  });
});
