# Tests

Three layers of automation plus a manual walkthrough. Each catches a different
class of bug.

| Layer | Location | Driver | Verifies |
|---|---|---|---|
| Fork | [`fork/`](./fork) | Node + viem against anvil RPC | Contract invariants: calldata, allowances, balances, power |
| E2E | [`e2e/`](./e2e) | Playwright + Chromium + mocked `window.ethereum` | UI state machine, modal logic, invalidation refresh |
| Manual | [`manual/`](./manual) | Real wallet clicking through dashboard | Popup UX, Blockaid, gas estimation, network-switch |

`fixtures/` holds Storybook decorators and mock data used by `*.stories.tsx`.

## Quick start

Anvil must be running with a mainnet fork on `:8545` first.

```bash
yarn test:fork             # Layer 1, contract-level invariants
yarn test:e2e              # Layer 3, Playwright UI suite
yarn test:manual:setup     # Layer 4, pokes the fork for manual click-through
```

Each subdirectory has its own README with the per-file purpose.
