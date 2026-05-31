import { expect } from "@playwright/test";
import { keccak256, encodeAbiParameters } from "viem";
import {
  test,
  injectMockWallet,
  connectWallet,
  openDepositModal,
  CANONICAL_USER,
  CANONICAL_ATP,
  snapshot,
  revert,
  anvilRpc,
  AZT,
} from "./helpers/setup";

// Anvil dev account 0. Connects as non-operator while DEV_BENEFICIARY keeps
// surfacing the canonical user's ATPs.
const NON_OPERATOR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function pokeAztBalance(addr: string, amount: bigint) {
  const slotKey = keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [addr as `0x${string}`, 1n]
    )
  );
  await anvilRpc("anvil_setStorageAt", [
    AZT,
    slotKey,
    "0x" + amount.toString(16).padStart(64, "0"),
  ]);
}

test.describe("edges: operator mismatch + close-mid-flow + disconnected", () => {
  test("operator mismatch: vault row shows 'Operator reassigned' and is disabled", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await pokeAztBalance(NON_OPERATOR, 5n * 10n ** 18n);
      await injectMockWallet(page, NON_OPERATOR);
      await page.goto("/");
      await connectWallet(page);

      await openDepositModal(page);
      const dialog = page.getByRole("dialog", { name: /deposit azt/i });

      const atpTrunc = `${CANONICAL_ATP.slice(0, 6)}…${CANONICAL_ATP.slice(-4)}`;
      await expect(dialog.getByText(/operator reassigned/i)).toBeVisible({
        timeout: 10_000,
      });
      const vaultRow = dialog.getByRole("button", {
        name: new RegExp(`vault ${atpTrunc}`, "i"),
      });
      await expect(vaultRow).toBeDisabled();
      await expect(vaultRow).toHaveAttribute(
        "title",
        /operator was reassigned/i
      );
    } finally {
      await revert(snapId);
    }
  });

  test("operator mismatch: auto-select picks Wallet (Direct) when vault is gated", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await pokeAztBalance(NON_OPERATOR, 5n * 10n ** 18n);
      await injectMockWallet(page, NON_OPERATOR);
      await page.goto("/");
      await connectWallet(page);

      await openDepositModal(page);
      const dialog = page.getByRole("dialog", { name: /deposit azt/i });

      const submit = dialog.getByRole("button", {
        name: /(approve.*deposit|^deposit\b)/i,
      });
      await expect(submit).toBeEnabled({ timeout: 10_000 });

      // MAX must put wallet (5 AZT), not the gated vault.
      await page.getByRole("button", { name: /^max$/i }).click();
      const value = await page.locator('input[placeholder="0"]').inputValue();
      expect(value.replace(/,/g, "")).toBe("5");
    } finally {
      await revert(snapId);
    }
  });

  test("clicking outside the modal closes it", async ({ page }) => {
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    await connectWallet(page);

    await openDepositModal(page);
    const dialog = page.getByRole("dialog", { name: /deposit azt/i });
    await page.mouse.click(5, 5); // backdrop
    await expect(dialog).not.toBeVisible({ timeout: 2_000 });
  });

  test("close mid-flow: X-button closes the dialog cleanly after submit", async ({ page }) => {
    const snapId = await snapshot();
    try {
      await injectMockWallet(page, CANONICAL_USER);
      await page.goto("/");
      await connectWallet(page);

      await openDepositModal(page);
      const dialog = page.getByRole("dialog", { name: /deposit azt/i });
      await page.getByRole("button", { name: /^max$/i }).click();
      await dialog
        .getByRole("button", { name: /(approve.*deposit|^deposit\b)/i })
        .click();

      // The X in the header closes from any phase (pending Cancel only resets
      // the tx state, success Close only fires in success).
      const xButton = dialog
        .locator('button:has(svg path[d*="M1 1L11 11M1 11L11 1"])')
        .first();
      await xButton.click();
      await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    } finally {
      await revert(snapId);
    }
  });

  test("disconnected state hides Deposit and Withdraw CTAs", async ({ page }) => {
    // Connect-CTA visibility is covered by smoke.spec.ts; this guards the
    // action buttons specifically.
    await injectMockWallet(page, CANONICAL_USER);
    await page.goto("/");
    // Positive gate prevents the not-visible checks from passing on empty paint.
    await expect(page.getByRole("heading", { name: /governance/i })).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.getByRole("button", { name: /^deposit$/i }).first()
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /^withdraw$/i }).first()
    ).not.toBeVisible();
  });
});
