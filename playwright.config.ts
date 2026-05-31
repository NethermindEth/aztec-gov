import { defineConfig, devices } from "@playwright/test";

// E2E tests run against an already-running dev server (yarn dev) and the
// anvil mainnet fork (port 8545). The suite injects a mock EIP-1193
// provider that proxies to anvil with impersonated accounts. See
// src/test/e2e/helpers/setup.ts.
export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: false, // anvil state is shared; run serially.
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
