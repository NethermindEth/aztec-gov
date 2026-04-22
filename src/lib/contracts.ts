import { createPublicClient, http, isAddress, type Address, type Chain } from "viem";
import { mainnet, sepolia } from "viem/chains";

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
        internalType: "struct DataStructures.Configuration",
        components: [
          { name: "votingDelay", type: "uint256", internalType: "Timestamp" },
          { name: "votingDuration", type: "uint256", internalType: "Timestamp" },
          { name: "executionDelay", type: "uint256", internalType: "Timestamp" },
          { name: "gracePeriod", type: "uint256", internalType: "Timestamp" },
          { name: "quorum", type: "uint256", internalType: "uint256" },
          { name: "voteDifferential", type: "uint256", internalType: "uint256" },
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
] as const;

// ─── Config ──────────────────────────────────────────────────────────────────

const CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
};

const rawChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
const chainId = (() => {
  if (CHAINS[rawChainId]) return rawChainId;
  console.warn(
    `[Aztec Gov] NEXT_PUBLIC_CHAIN_ID=${rawChainId} is not supported (supported: ${Object.keys(CHAINS).join(", ")}). Defaulting to Sepolia.`
  );
  return 11155111;
})();

const PUBLIC_FALLBACK_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
};

const rpcUrl =
  process.env.RPC_URL ||
  PUBLIC_FALLBACK_RPC[chainId] ||
  "https://ethereum-rpc.publicnode.com";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function validateAddress(value: string | undefined, name: string): Address {
  const raw = value || "";
  if (!raw) {
    console.warn(`[Aztec Gov] ${name} not configured — set it in .env`);
    return ZERO_ADDRESS;
  }
  if (!isAddress(raw)) {
    console.warn(`[Aztec Gov] ${name} is not a valid Ethereum address: ${raw}`);
    return ZERO_ADDRESS;
  }
  return raw as Address;
}

export const governanceAddress = validateAddress(
  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS, "NEXT_PUBLIC_GOVERNANCE_ADDRESS"
);
export const stakingAssetAddress = validateAddress(
  process.env.NEXT_PUBLIC_STAKING_ASSET_ADDRESS, "NEXT_PUBLIC_STAKING_ASSET_ADDRESS"
);
export const gseAddress = validateAddress(
  process.env.NEXT_PUBLIC_GSE_ADDRESS, "NEXT_PUBLIC_GSE_ADDRESS"
);

export const publicClient = createPublicClient({
  chain: CHAINS[chainId] || sepolia,
  transport: http(rpcUrl),
});
