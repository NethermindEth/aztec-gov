# Aztec Governance Dashboard

A Next.js dashboard for monitoring and interacting with Aztec's on-chain governance contracts on Sepolia.

## Prerequisites

- **Node.js** 20+
- **Yarn** 1.22+ (pinned via `.tool-versions` for asdf)
- **Foundry** (`forge`) — required only for deploying/seeding contracts
- **aztec-packages** repo cloned as a sibling directory (`../aztec-packages`) — required only for deploying/seeding

## Quick Start

```bash
yarn install
cp .env.local.example .env.local
# Fill in the required values (see Environment Variables below)
yarn dev
```

## Environment Variables

We recommend using [direnv](https://direnv.net/) to manage environment variables per-directory. Install it, then create an `.envrc` file:

```bash
# Install direnv (macOS)
brew install direnv

# Add the hook to your shell (add to ~/.zshrc or ~/.bashrc)
eval "$(direnv hook zsh)"

# Create .envrc that loads .env.local
echo 'dotenv .env.local' > .envrc
direnv allow
```

This way `.env.local` values are automatically loaded into your shell, so scripts like `deploy-test-governance.sh` pick up `PRIVATE_KEY` and contract addresses without manual `export` commands.

### Required Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_GOVERNANCE_ADDRESS` | Governance contract address |
| `NEXT_PUBLIC_STAKING_ASSET_ADDRESS` | Staking token (ERC20) address |
| `NEXT_PUBLIC_GSE_ADDRESS` | Governance Staking Escrow address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID ([get one here](https://cloud.walletconnect.com)) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` | Ethereum RPC endpoint (server-only) |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` | Chain ID (Sepolia) |
| `AZTEC_NODE_URL` | `https://rpc.testnet.aztec-labs.com` | Aztec node URL (for `get-l1-addresses`) |
| `PRIVATE_KEY` | — | Deployer private key (for deploy/seed scripts only) |
| `AZTEC_PACKAGES_PATH` | `../aztec-packages` | Path to aztec-packages repo (for deploy/seed scripts) |

## Scripts

### `yarn dev`

Start the development server with Turbopack on http://localhost:3000.

### `yarn build`

Production build.

### `yarn lint`

Run ESLint.

### `yarn get-l1-addresses`

Fetch governance contract addresses from a running Aztec node and write them to `.env.local`.

```bash
# Use default testnet RPC
yarn get-l1-addresses

# Use a custom Aztec node
yarn get-l1-addresses http://localhost:8080
```

### `yarn setup`

**One-command local setup.** Deploys governance contracts to Sepolia, seeds them with deposits and 5 test proposals, and updates `.env.local` — all in one step.

**Requires:** `PRIVATE_KEY`, Foundry (`forge`), `../aztec-packages` checkout.

```bash
# Full setup with defaults (Sepolia)
PRIVATE_KEY=0x... yarn setup

# With custom paths/chain
PRIVATE_KEY=0x... AZTEC_PACKAGES_PATH=~/aztec-packages RPC_URL=http://localhost:8545 CHAIN_ID=31337 yarn setup
```

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Deployer wallet private key (needs gas on target chain) |
| `AZTEC_PACKAGES_PATH` | No | `../aztec-packages` | Path to aztec-packages repo |
| `RPC_URL` | No | Sepolia public node | RPC endpoint |
| `CHAIN_ID` | No | `11155111` | Target chain ID |

### `./scripts/deploy-test-governance.sh`

Deploy your own independent governance contract stack to Sepolia (or any EVM chain). Deploys 5 contracts: TestERC20, Registry, GSE, GovernanceProposer, and Governance with test-friendly parameters (60s voting delay, 5min voting window, open deposits).

Automatically updates `.env.local` with the new addresses.

**Requires:** `PRIVATE_KEY`, Foundry (`forge`), `../aztec-packages` checkout.

```bash
# Deploy with defaults (Sepolia)
PRIVATE_KEY=0x... ./scripts/deploy-test-governance.sh

# Deploy to a different chain
PRIVATE_KEY=0x... RPC_URL=http://localhost:8545 CHAIN_ID=31337 ./scripts/deploy-test-governance.sh
```

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Deployer wallet private key (needs gas on target chain) |
| `AZTEC_PACKAGES_PATH` | No | `../aztec-packages` | Path to aztec-packages repo |
| `RPC_URL` | No | Sepolia public node | RPC endpoint |
| `CHAIN_ID` | No | `11155111` | Target chain ID |

### `yarn seed-governance`

Seed a deployed governance with token deposits and 5 test proposals (deploys `TestPayload` contracts on-chain with sample forum URIs). Reads contract addresses from env or the project root `.env.local`.

```bash
PRIVATE_KEY=0x... yarn seed-governance
```

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Deployer wallet private key |
| `STAKING_ASSET_ADDRESS` | No | `NEXT_PUBLIC_STAKING_ASSET_ADDRESS` from `.env.local` | Deployed TestERC20 address |
| `GOVERNANCE_ADDRESS` | No | `NEXT_PUBLIC_GOVERNANCE_ADDRESS` from `.env.local` | Deployed Governance address |
| `TEST_VOTER` | No | — | Also deposit voting power for this address |

## End-to-End Test Workflow

The fastest path from zero to a running dashboard:

```bash
# 1. Deploy + seed in one command
PRIVATE_KEY=0x... yarn setup

# 2. Start dashboard
yarn dev

# 3. Proposals become Active after 60s, then have a 5min voting window
```

<details>
<summary>Manual step-by-step alternative</summary>

```bash
# 1. Deploy your own governance stack
PRIVATE_KEY=0x... ./scripts/deploy-test-governance.sh

# 2. Seed with deposits + proposals
#    (addresses come from .env.local, updated by step 1)
PRIVATE_KEY=0x... yarn seed-governance

# 3. Start dashboard
yarn dev
```

</details>

## Governance Config (Test Deployment)

The `deploy-test-governance.sh` script deploys with these parameters:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Voting delay | 60s | Time before proposal becomes Active |
| Voting duration | 300s (5 min) | Active voting window |
| Execution delay | 60s | Timelock after voting passes |
| Grace period | 3600s (1 hour) | Window to execute a passed proposal |
| Quorum | 10% | Required participation |
| Yea margin | 4% | Required yea-over-nay margin |
| Minimum votes | 100 STK | Absolute minimum votes |
| Lock amount | 100 STK | Tokens locked per `proposeWithLock` |
| Lock delay | 60s | Withdrawal delay for locked tokens |
| Beneficiary | `address(0)` | Open floodgates — anyone can `deposit()` |
