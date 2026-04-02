#!/bin/bash
set -euo pipefail

# Deploy governance-only contracts to Sepolia (or any EVM chain).
#
# Usage:
#   PRIVATE_KEY=0x... ./scripts/deploy-test-governance.sh
#
# Optional env vars:
#   AZTEC_PACKAGES_PATH  Path to aztec-packages repo (default: ../aztec-packages)
#   RPC_URL              RPC endpoint (default: Sepolia public node)
#   CHAIN_ID             Chain ID (default: 11155111)

AZTEC_PACKAGES_PATH="${AZTEC_PACKAGES_PATH:-../aztec-packages}"
RPC_URL="${RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
CHAIN_ID="${CHAIN_ID:-11155111}"

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Error: PRIVATE_KEY env var is required"
  echo "Usage: PRIVATE_KEY=0x... ./scripts/deploy-test-governance.sh"
  exit 1
fi

L1_CONTRACTS_DIR="$AZTEC_PACKAGES_PATH/l1-contracts"

if [ ! -d "$L1_CONTRACTS_DIR" ]; then
  echo "Error: l1-contracts directory not found at $L1_CONTRACTS_DIR"
  echo "Set AZTEC_PACKAGES_PATH to your aztec-packages repo"
  exit 1
fi

echo "=== Deploying Governance Contracts ==="
echo "RPC:      $RPC_URL"
echo "Chain ID: $CHAIN_ID"
echo ""

# Run forge script and capture output
OUTPUT=$(cd "$L1_CONTRACTS_DIR" && forge script script/deploy/DeployGovernanceOnly.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  --chain-id "$CHAIN_ID" \
  --use 0.8.30 \
  --skip test \
  2>&1)

echo "$OUTPUT"

# Parse deployed addresses from console output
STAKING_ASSET=$(echo "$OUTPUT" | grep "StakingAsset:" | awk '{print $2}')
GOVERNANCE=$(echo "$OUTPUT" | grep "Governance:" | grep -v "GovernanceProposer" | awk '{print $2}')
GSE=$(echo "$OUTPUT" | grep "GSE:" | awk '{print $2}')

if [ -z "$STAKING_ASSET" ] || [ -z "$GOVERNANCE" ] || [ -z "$GSE" ]; then
  echo ""
  echo "Error: Could not parse deployed addresses from output"
  exit 1
fi

echo ""
echo "=== Updating .env.local ==="

# Script directory -> project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local"

# Helper to upsert a key=value in .env.local
upsert_env() {
  local key="$1" value="$2"
  if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
    # Use a temp file for portability (macOS sed -i requires backup arg)
    sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

upsert_env "NEXT_PUBLIC_GOVERNANCE_ADDRESS" "$GOVERNANCE"
upsert_env "NEXT_PUBLIC_STAKING_ASSET_ADDRESS" "$STAKING_ASSET"
upsert_env "NEXT_PUBLIC_GSE_ADDRESS" "$GSE"

echo "  NEXT_PUBLIC_GOVERNANCE_ADDRESS=$GOVERNANCE"
echo "  NEXT_PUBLIC_STAKING_ASSET_ADDRESS=$STAKING_ASSET"
echo "  NEXT_PUBLIC_GSE_ADDRESS=$GSE"
echo ""
echo "Done! Run 'yarn dev' to test the dashboard with the new contracts."
echo ""
echo "To seed proposals:"
echo "  PRIVATE_KEY=0x... STAKING_ASSET_ADDRESS=$STAKING_ASSET GOVERNANCE_ADDRESS=$GOVERNANCE ./scripts/seed-governance.sh"
