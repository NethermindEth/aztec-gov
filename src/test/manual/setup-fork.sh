#!/usr/bin/env bash
#
# Bootstrap an anvil mainnet fork for manual MetaMask testing.
#
# Pokes the canonical ATP storage so that $WALLET is its operator (slots 1+3),
# seeds the ATP with 2.962188205520823244 AZT (a dust-shaped fixture that
# exercises MAX-amount preservation), and funds the wallet with 10 ETH for gas.
#
# Override WALLET, ATP, AZT, RPC via env vars if needed.
#
# Usage:
#   ./src/test/manual/setup-fork.sh                          # default wallet
#   WALLET=0xYourMetaMaskAddress ./src/test/manual/setup-fork.sh
#
# Prereqs: anvil + cast (foundry), an anvil fork running on :8545.

set -euo pipefail

WALLET="${WALLET:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
ATP="${ATP:-0x2C4464618f9b5d7601bED221Ad02cABB285245D8}"
AZT="${AZT:-0xa27Ec0006E59F245217ff08CD52A7E8b169e62d2}"
STAKER="${STAKER:-0xEaDd1e65dCCeB249156bB3E558479418E19B4fC0}"
GOV="${GOV:-0x1102471Eb3378FEE427121c9EfcEa452E4B6B75e}"
RPC="${RPC:-http://localhost:8545}"

# OpenZeppelin ERC20 stores balances at keccak256(abi.encode(account, slot=1)).
BAL_SLOT=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$ATP" 1)")
# Non-clean balance (sub-0.000001 AZT dust) exposes any rounding in MAX.
ATP_BALANCE=0x000000000000000000000000000000000000000000000000291bce7a83eba3cc
PADDED_WALLET="0x000000000000000000000000$(echo "$WALLET" | sed 's/^0x//' | tr 'A-F' 'a-f')"

echo "[setup-fork] WALLET=$WALLET ATP=$ATP RPC=$RPC"

cast rpc --rpc-url "$RPC" anvil_setStorageAt "$AZT" "$BAL_SLOT"    "$ATP_BALANCE"    > /dev/null
cast rpc --rpc-url "$RPC" anvil_setStorageAt "$ATP" 0x1            "$PADDED_WALLET"  > /dev/null
cast rpc --rpc-url "$RPC" anvil_setStorageAt "$ATP" 0x3            "$PADDED_WALLET"  > /dev/null
cast rpc --rpc-url "$RPC" anvil_setBalance   "$WALLET"             0x8ac7230489e80000 > /dev/null

echo "[setup-fork] verifying:"
printf "  ATP balance:   "; cast call --rpc-url "$RPC" "$AZT" "balanceOf(address)(uint256)" "$ATP"
printf "  ATP operator:  "; cast call --rpc-url "$RPC" "$ATP" "getOperator()(address)"
printf "  Staker power:  "; cast call --rpc-url "$RPC" "$GOV" "powerNow(address)(uint256)" "$STAKER"
printf "  Wallet ETH:    "; cast balance --rpc-url "$RPC" "$WALLET"

echo "[setup-fork] ready. Point MetaMask at $RPC (chainId 31337) as $WALLET."
