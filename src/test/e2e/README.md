# E2E tests

Playwright suite driving the dashboard in headless Chromium. The wallet is an
injected EIP-1193 provider proxying to anvil. Everything else (React, wagmi,
RainbowKit, modal logic, invalidation) runs production code.

## Prereqs

1. Anvil on `:8545` with a mainnet fork. A paid RPC is strongly preferred;
   free public RPCs drop connections under the dashboard's log-scan load.
2. Dev server running with `NEXT_PUBLIC_E2E=1` so wagmi exposes the
   `injected()` connector and the `window.__wagmiConfig` test backdoor.
3. `NEXT_PUBLIC_DEV_BENEFICIARY=0x78FA029F04251cc810DFF72CCC7B4764DBC16899`
   in `.env.local` so the indexer surfaces the canonical user's ATP
   regardless of the connected wallet.
4. The fork ATP balance pre-poked to the dusty fixture value:
   ```bash
   ./src/test/manual/setup-fork.sh
   ```

## Run

```bash
yarn test:e2e                                 # full suite
yarn test:e2e:headed                          # with browser visible (debug)
npx playwright test --grep "MAX preserves"    # one test by name
```

## What each file covers

| File | Scope |
|---|---|
| [`smoke.spec.ts`](./smoke.spec.ts) | Page renders, mock wallet connects via the wagmi backdoor |
| [`voting-power.spec.ts`](./voting-power.spec.ts) | Voting power display, Deposit/Withdraw CTA gating (incl. ATP-only users) |
| [`deposit-modal.spec.ts`](./deposit-modal.spec.ts) | Source picker auto-select, MAX preserves bigint, source switch clears input, escape/X/click-outside closes, validation errors |
| [`withdraw-modal.spec.ts`](./withdraw-modal.spec.ts) | Same coverage shape for withdraw: picker, MAX dust, Cancel, delay note |
| [`integration.spec.ts`](./integration.spec.ts) | Full deposit and withdraw flows including invalidation: after a tx the CTAs update without a manual refresh |
| [`edge-cases.spec.ts`](./edge-cases.spec.ts) | Operator-mismatch UI, auto-select skips disabled vault, modal close mid-flow, disconnected state |

## How wallet mocking works

[`helpers/setup.ts`](./helpers/setup.ts) adds two things to the browser before
`page.goto`:

1. `window.ethereum`, an EIP-1193 + EIP-6963 provider that returns hardcoded
   `eth_accounts` and `eth_chainId` and forwards everything else (including
   `eth_sendTransaction`) to anvil. Anvil's `--auto-impersonate` accepts
   unsigned txs from the listed account.
2. A call to `window.__wagmiConnect(window.__wagmiConfig, { connector: injected })`
   to bypass RainbowKit's MetaMask SDK path. The SDK ignores injected
   providers in headless mode.

The whole backdoor sits behind `NEXT_PUBLIC_E2E=1` and has no effect when the
env var is absent.

## What this layer can't catch

Real wallet popups (Blockaid warnings, gas estimation prompts, signing UX,
user denying a tx) and cross-tab focus refetch behavior. Those are the
[`manual/`](../manual) layer's job.
