/**
 * Hardcoded mapping from on-chain proposal numeric ID to Aztec forum topic URL.
 * The Discourse forum uses slug-based URLs with no predictable pattern,
 * so we maintain this mapping manually as new governance proposals appear.
 *
 * Values are stored WITHOUT the protocol prefix — callers prepend `https://`.
 */
const FORUM_URLS: Record<number, string> = {
  0: "forum.aztec.network/t/proposal-execute-tge-payload-to-unlock-aztec-token-transfers/8380",
  1: "forum.aztec.network/t/proposal-allocate-remaining-ecosystem-grants-to-community-contributors-operator-roles-and-testnet-validators/8465",
  2: "forum.aztec.network/t/proposal-aztec-alpha-payload/8515",
};

export function getForumUrl(proposalId: number): string | undefined {
  return FORUM_URLS[proposalId];
}
