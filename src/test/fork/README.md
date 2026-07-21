# Fork tests

TypeScript scripts that exercise the on-chain contract surface directly against
an anvil mainnet fork. They build calldata with `viem`, submit txs via the fork
RPC, and assert post-state from `eth_call` reads. No browser, no React, no
wagmi. Contract correctness only.

## Prereqs

Anvil running on `:8545` against a mainnet fork:

```bash
anvil --fork-url <YOUR_RPC_URL> --chain-id 31337 --port 8545 --auto-impersonate
```

Some tests (`deposit.test.ts`, `deposit-edges.test.ts`) assume the canonical
user's ATP holds the ~2.962 AZT fixture balance. If real mainnet state has
drifted (e.g. the user did a MAX deposit and only dust is left), seed the
balance before running:

```bash
WALLET=0x78FA029F04251cc810DFF72CCC7B4764DBC16899 yarn test:manual:setup
```

That pokes the ATP balance back to 2962188205520823244 wei and sets the
operator to the canonical user (matches the mainnet operator). Skip this
step if `cast call $ATP balanceOf` already shows the canonical amount.

## Run

```bash
yarn test:fork                                # all tests sequentially
npx tsx src/test/fork/max-dust.test.ts        # a single test
```

Each test is self-contained. It impersonates the canonical user, snapshots
the fork, runs its assertions, and reverts before exiting. Order doesn't
matter.

## What each file covers

| File | Scope |
|---|---|
| [`deposit.test.ts`](./deposit.test.ts) | Deposit-via-Staker calldata identity, two-tx flow, skip-approve when allowance covers, exact allowance consumption |
| [`deposit-edges.test.ts`](./deposit-edges.test.ts) | Wallet (direct) path regression, multi-user picker math, amount validation edges |
| [`withdraw.test.ts`](./withdraw.test.ts) | Full withdraw lifecycle across 5 known stuck-users: initiate, time-advance, finalize, `recipient = ATP` invariant |
| [`max-dust.test.ts`](./max-dust.test.ts) | Post-audit fix: `ATP.getOperator` read; MAX-deposit and MAX-withdraw both land at exactly 0 wei |
| [`max-dust-edges.test.ts`](./max-dust-edges.test.ts) | Wallet-path MAX dust via `ERC20.approve`, approve-then-revert recovery, multi-ATP operators, multicall handling of missing `getOperator` selector |
| [`delegate.test.ts`](./delegate.test.ts) | GSE delegation (issue #13): attester-enumeration discovery, `GSE.delegate` as a real withdrawer, withdrawer-only auth, delegated `GSE.vote` into a fresh proposal, snapshot/powerUsed math parity with `useGseProposalPower` |

## What this layer can't catch

React render order, useEffect timing, modal phase transitions, or anything in
the wallet popup. Those are the e2e and manual layers' job.
