# Manual wallet walkthrough

End-to-end click-through with a real MetaMask against a local anvil mainnet
fork. Covers what the automated layers can't reach: real wallet popups,
Blockaid warnings, gas estimation prompts, network-switch UX.

## When to use this

- Before merging any change that touches the deposit, withdraw, or claim
  modal flows (`useDeposit`, `useWithdraw`, `useFinalizeWithdraw`).
- After bumping `wagmi` or `@rainbow-me/rainbowkit`. The automated suite
  covers invalidation but not the connector path.

## Prereqs

1. Anvil with a mainnet fork on `:8545`:
   ```bash
   anvil --fork-url <YOUR_RPC_URL> --chain-id 31337 --port 8545 --auto-impersonate
   ```
   A paid RPC is strongly preferred. Free public RPCs drop under load.
2. `yarn dev` running.
3. MetaMask configured with a network pointing at `http://localhost:8545`,
   chain id `31337`.

## Setup

```bash
yarn test:manual:setup                                  # anvil dev account 0
WALLET=0xYourAddress yarn test:manual:setup             # any wallet
```

The script pokes ATP storage slots 1 + 3 so your wallet becomes the operator,
seeds the ATP with `2.962188205520823244` AZT (a dust-shaped fixture), and
funds your wallet with 10 ETH for gas.

## Walkthrough

1. Open `http://localhost:3000` and connect MetaMask.
2. **Deposit**: pick the vault source, MAX, sign both popups. Expect the
   success view and the ATP balance drained to exactly 0 wei.
3. **Withdraw**: pick the staker source, type or MAX, sign. Expect the
   "Withdrawal Initiated" view and a pending row in the withdrawals list.
4. **Claim**: only after the lock period (~37 days). Either wait or
   fast-forward the fork:
   ```bash
   cast rpc --rpc-url http://localhost:8545 anvil_setNextBlockTimestamp $(date -v+38d +%s)
   cast rpc --rpc-url http://localhost:8545 anvil_mine 1
   ```
   Set `NEXT_PUBLIC_DEV_NOW_OVERRIDE=<future-unix-seconds>` in `.env.local`
   so the UI's "Ready to claim" gate uses fork time, not the wall clock.
   Restart `yarn dev` after setting it.

## After the run

Unset `NEXT_PUBLIC_DEV_NOW_OVERRIDE`, `NEXT_PUBLIC_DEV_BENEFICIARY`, and
`NEXT_PUBLIC_E2E` before pushing. `.env.local` is gitignored so they don't
leak by default, but worth a glance.
