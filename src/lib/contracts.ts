import { createPublicClient, defineChain, http, type Chain } from "viem";
import { mainnet, sepolia, foundry as foundryBase } from "viem/chains";
import { chainId } from "./config";

// Contract addresses are validated in ./config (throws at load if missing).
// Re-exported here so existing `@/lib/contracts` import sites keep working.
export { governanceAddress, stakingAssetAddress, gseAddress } from "./config";

// viem's foundry chain doesn't declare multicall3 — inject the canonical
// address so publicClient.multicall works against a local anvil where we've
// seeded the multicall3 contract via anvil_setCode.
const foundry = defineChain({
  ...foundryBase,
  contracts: {
    ...foundryBase.contracts,
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});

// ─── ABIs ────────────────────────────────────────────────────────────────────

export const GovernanceAbi = [
  {
    type: "function",
    name: "proposalCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPowerNow",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "_onBehalfOf", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "proposeWithLock",
    inputs: [
      { name: "_proposal", type: "address" },
      { name: "_to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_amount", type: "uint256" },
      { name: "_support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initiateWithdraw",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getProposal",
    inputs: [
      { name: "_proposalId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct DataStructures.ProposalData",
        components: [
          {
            name: "configuration",
            type: "tuple",
            internalType: "struct DataStructures.Configuration",
            components: [
              {
                name: "votingDelay",
                type: "uint256",
                internalType: "Timestamp",
              },
              {
                name: "votingDuration",
                type: "uint256",
                internalType: "Timestamp",
              },
              {
                name: "executionDelay",
                type: "uint256",
                internalType: "Timestamp",
              },
              {
                name: "gracePeriod",
                type: "uint256",
                internalType: "Timestamp",
              },
              {
                name: "quorum",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "voteDifferential",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "minimumVotes",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "state",
            type: "uint8",
            internalType: "enum DataStructures.ProposalState",
          },
          {
            name: "payload",
            type: "address",
            internalType: "contract IPayload",
          },
          { name: "creator", type: "address", internalType: "address" },
          {
            name: "creation",
            type: "uint256",
            internalType: "Timestamp",
          },
          {
            name: "summedBallot",
            type: "tuple",
            internalType: "struct DataStructures.Ballot",
            components: [
              { name: "yea", type: "uint256", internalType: "uint256" },
              { name: "nay", type: "uint256", internalType: "uint256" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "powerNow",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProposalState",
    inputs: [
      { name: "_proposalId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum DataStructures.ProposalState",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getConfiguration",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Configuration",
        components: [
          {
            name: "proposeConfig",
            type: "tuple",
            internalType: "struct ProposeWithLockConfiguration",
            components: [
              { name: "lockDelay", type: "uint256", internalType: "Timestamp" },
              { name: "lockAmount", type: "uint256", internalType: "uint256" },
            ],
          },
          { name: "votingDelay", type: "uint256", internalType: "Timestamp" },
          { name: "votingDuration", type: "uint256", internalType: "Timestamp" },
          { name: "executionDelay", type: "uint256", internalType: "Timestamp" },
          { name: "gracePeriod", type: "uint256", internalType: "Timestamp" },
          { name: "quorum", type: "uint256", internalType: "uint256" },
          { name: "requiredYeaMargin", type: "uint256", internalType: "uint256" },
          { name: "minimumVotes", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "finalizeWithdraw",
    inputs: [
      { name: "_withdrawalId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getWithdrawal",
    inputs: [
      { name: "_withdrawalId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IGovernance.Withdrawal",
        components: [
          { name: "amount", type: "uint256", internalType: "uint256" },
          { name: "unlocksAt", type: "uint256", internalType: "Timestamp" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "claimed", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ProposalExecuted",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: true, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "WithdrawInitiated",
    inputs: [
      { name: "withdrawalId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "recipient", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "WithdrawFinalized",
    inputs: [
      { name: "withdrawalId", type: "uint256", indexed: true, internalType: "uint256" },
    ],
  },
] as const;

export const ERC20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const GSEAbi = [
  {
    type: "function",
    name: "getVotingPower",
    inputs: [{ name: "_delegatee", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVotingPowerAt",
    inputs: [
      { name: "_delegatee", type: "address" },
      { name: "_timestamp", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPowerUsed",
    inputs: [
      { name: "_delegatee", type: "address" },
      { name: "_proposalId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "delegate",
    inputs: [
      { name: "_instance", type: "address" },
      { name: "_attester", type: "address" },
      { name: "_delegatee", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Spends power delegated to msg.sender; the GSE forwards to Governance.vote.
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_amount", type: "uint256" },
      { name: "_support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDelegatee",
    inputs: [
      { name: "_instance", type: "address" },
      { name: "_attester", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWithdrawer",
    inputs: [{ name: "_attester", type: "address" }],
    outputs: [{ name: "withdrawer", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "_instance", type: "address" },
      { name: "_attester", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBonusInstanceAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getLatestRollup",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supplyOf",
    inputs: [{ name: "_instance", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Attester enumeration lets discovery run on current state instead of
  // archive logs, which most public RPCs no longer serve.
  {
    type: "function",
    name: "getAttesterCountAtTime",
    inputs: [
      { name: "_instance", type: "address" },
      { name: "_timestamp", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestersFromIndicesAtTime",
    inputs: [
      { name: "_instance", type: "address" },
      { name: "_timestamp", type: "uint256" },
      { name: "_indices", type: "uint256[]" },
    ],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
] as const;

export const PayloadAbi = [
  {
    type: "function",
    name: "getURI",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

export const StakerAbi = [
  {
    type: "function",
    name: "voteInGovernance",
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_amount", type: "uint256" },
      { name: "_support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initiateWithdrawFromGovernance",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositIntoGovernance",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Re-delegates a Staker-held stake; resolves the instance from the registry
  // version, so it cannot reach bonus-instance ("follow latest rollup") stake.
  {
    type: "function",
    name: "delegate",
    inputs: [
      { name: "_version", type: "uint256" },
      { name: "_attester", type: "address" },
      { name: "_delegatee", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "ROLLUP_REGISTRY",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// Aztec Registry (rollup versions). Used to translate a rollup instance
// address into the version number Staker.delegate expects.
export const RegistryAbi = [
  {
    type: "function",
    name: "numberOfVersions",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersion",
    inputs: [{ name: "_index", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRollup",
    inputs: [{ name: "_version", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// ATP (Aztec Token Vault). The asset is implicit on the contract, so
// approveStaker takes only an amount.
export const ATPAbi = [
  {
    type: "function",
    name: "approveStaker",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getOperator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// ─── Config ──────────────────────────────────────────────────────────────────

const CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  31337: foundry,
};

const PUBLIC_FALLBACK_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  31337: "http://127.0.0.1:8545",
};

// RPC_URL is server-only (the browser reaches the chain through the proxy), so
// it can't live in ./config without throwing on every client load. In
// production the public fallback drops connections under load, so require an
// explicit RPC_URL on the server. Dev, fork tests and e2e keep the fallback.
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV === "production" &&
  !process.env.RPC_URL
) {
  throw new Error(
    "RPC_URL is not set. Set it in the deploy environment; the public RPC fallback is not reliable under load."
  );
}

const rpcUrl =
  process.env.RPC_URL ||
  PUBLIC_FALLBACK_RPC[chainId] ||
  "https://ethereum-rpc.publicnode.com";

export const publicClient = createPublicClient({
  chain: CHAINS[chainId] || sepolia,
  transport: http(rpcUrl),
});
