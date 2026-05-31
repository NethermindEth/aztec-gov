# Fork tests

Node scripts that exercise the on-chain contract surface directly against an
anvil mainnet fork. They build calldata with `viem`, submit txs via the fork
RPC, and assert post-state from `eth_call` reads. No browser, no React, no
wagmi. Contract correctness only.

## Prereqs

Anvil running on `:8545` against a mainnet fork:

```bash
anvil --fork-url <YOUR_RPC_URL> --chain-id 31337 --port 8545 --auto-impersonate
```

## Run

```bash
yarn test:fork                                # all tests sequentially
node src/test/fork/max-dust.test.mjs          # a single test
```

Each test is self-contained. It impersonates the canonical user, snapshots
the fork, runs its assertions, and reverts before exiting. Order doesn't
matter.

## What each file covers

| File | Scope |
|---|---|
| [`deposit.test.mjs`](./deposit.test.mjs) | Deposit-via-Staker calldata identity, two-tx flow, skip-approve when allowance covers, exact allowance consumption |
| [`deposit-edges.test.mjs`](./deposit-edges.test.mjs) | Wallet (direct) path regression, multi-user picker math, amount validation edges |
| [`withdraw.test.mjs`](./withdraw.test.mjs) | Full withdraw lifecycle across 5 known stuck-users: initiate, time-advance, finalize, `recipient = ATP` invariant |
| [`max-dust.test.mjs`](./max-dust.test.mjs) | Post-audit fix: `ATP.getOperator` read; MAX-deposit and MAX-withdraw both land at exactly 0 wei |
| [`max-dust-edges.test.mjs`](./max-dust-edges.test.mjs) | Wallet-path MAX dust via `ERC20.approve`, approve-then-revert recovery, multi-ATP operators, multicall handling of missing `getOperator` selector |

## What this layer can't catch

React render order, useEffect timing, modal phase transitions, or anything in
the wallet popup. Those are the e2e and manual layers' job.
