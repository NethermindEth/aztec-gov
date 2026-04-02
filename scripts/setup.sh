#!/bin/bash
set -euo pipefail

# One-command local setup: deploy governance contracts to Sepolia and seed
# them with deposits + test proposals.
#
# Usage:
#   PRIVATE_KEY=0x... yarn setup
#
# Optional env vars (passed through to sub-scripts):
#   AZTEC_PACKAGES_PATH  Path to aztec-packages repo (default: ../aztec-packages)
#   RPC_URL              RPC endpoint (default: Sepolia public node)
#   CHAIN_ID             Chain ID (default: 11155111)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local"

# ── 1. Validate prerequisites ────────────────────────────────────────────

AZTEC_PACKAGES_PATH="${AZTEC_PACKAGES_PATH:-../aztec-packages}"

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Error: PRIVATE_KEY env var is required"
  echo "Usage: PRIVATE_KEY=0x... yarn setup"
  exit 1
fi

if ! command -v forge &>/dev/null; then
  echo "Error: forge (Foundry) is not installed"
  echo "Install it: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

if [ ! -d "$AZTEC_PACKAGES_PATH/l1-contracts" ]; then
  echo "Error: aztec-packages/l1-contracts not found at $AZTEC_PACKAGES_PATH/l1-contracts"
  echo "Set AZTEC_PACKAGES_PATH to your aztec-packages repo"
  exit 1
fi

# ── 2. Deploy contracts ──────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Step 1/2: Deploying governance contracts to Sepolia"
echo "══════════════════════════════════════════════════════"
echo ""

PRIVATE_KEY="$PRIVATE_KEY" "$SCRIPT_DIR/deploy-test-governance.sh"

# ── 3. Read addresses back from .env.local ────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local was not created by deploy script"
  exit 1
fi

STAKING_ASSET=$(grep "^NEXT_PUBLIC_STAKING_ASSET_ADDRESS=" "$ENV_FILE" | cut -d'=' -f2)
GOVERNANCE=$(grep "^NEXT_PUBLIC_GOVERNANCE_ADDRESS=" "$ENV_FILE" | cut -d'=' -f2)
GSE=$(grep "^NEXT_PUBLIC_GSE_ADDRESS=" "$ENV_FILE" | cut -d'=' -f2)

if [ -z "$STAKING_ASSET" ] || [ -z "$GOVERNANCE" ]; then
  echo "Error: Could not read deployed addresses from .env.local"
  exit 1
fi

# ── 4. Seed governance ───────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Step 2/2: Seeding governance with test proposals"
echo "══════════════════════════════════════════════════════"
echo ""

PRIVATE_KEY="$PRIVATE_KEY" \
  STAKING_ASSET_ADDRESS="$STAKING_ASSET" \
  GOVERNANCE_ADDRESS="$GOVERNANCE" \
  "$SCRIPT_DIR/seed-governance.sh"

# ── 5. Summary ───────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Deployed addresses:"
echo "    Governance:     $GOVERNANCE"
echo "    Staking Asset:  $STAKING_ASSET"
echo "    GSE:            ${GSE:-N/A}"
echo ""
echo "  .env.local has been updated."
echo ""
echo "  Next step: yarn dev"
echo ""
