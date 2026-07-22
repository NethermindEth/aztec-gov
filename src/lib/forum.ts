// Curated proposal-id -> forum topic map (protocol-less), used when the AZUP
// has no discussions-to link; Discourse slugs aren't derivable, so hand-added.
const FORUM_URLS: Record<number, string> = {
  0: "forum.aztec.network/t/proposal-execute-tge-payload-to-unlock-aztec-token-transfers/8380",
  1: "forum.aztec.network/t/proposal-allocate-remaining-ecosystem-grants-to-community-contributors-operator-roles-and-testnet-validators/8465",
  2: "forum.aztec.network/t/proposal-aztec-alpha-payload/8515",
  4: "forum.aztec.network/t/proposal-v5-payload-deployed/8606",
};

const FORUM_HOST = "forum.aztec.network";

export function getForumUrl(proposalId: number): string | undefined {
  return FORUM_URLS[proposalId];
}

// AZUP discussions-to may be a forum thread, another site (e.g. GitHub
// Discussions), or a placeholder like "None". Accept any real http(s) URL as
// a discussion link, normalized to the protocol-less form; reject the rest.
export function normalizeDiscussionUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${url.host}${url.pathname}${url.search}`.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

// True only for the real forum host (boundary-matched so a lookalike like
// "forum.aztec.network.evil.com" fails); gates the Discourse API call.
export function isForumUrl(protocollessUrl: string | undefined): boolean {
  if (!protocollessUrl) return false;
  return protocollessUrl === FORUM_HOST || protocollessUrl.startsWith(`${FORUM_HOST}/`);
}

export interface ForumTopicMeta {
  title: string;
  excerpt?: string;
}

const EXCERPT_MAX_CHARS = 220;

// Discourse first posts open with an H1 repeating the topic title; drop it,
// strip the remaining tags, and keep a snippet-sized plain-text excerpt.
function excerptFromCookedHtml(cooked: string): string | undefined {
  const text = decodeEntities(
    cooked
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= EXCERPT_MAX_CHARS) return text;
  const cut = text.slice(0, EXCERPT_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

// Decodes the handful of entities Discourse emits; &amp; must be last so an
// already-escaped "&amp;lt;" doesn't get double-decoded.
function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Topic title + first-post excerpt via the Discourse JSON API; server-side
// only, null on any failure.
export async function fetchForumTopicMeta(
  forumUrl: string
): Promise<ForumTopicMeta | null> {
  const topicId = forumUrl.match(/\/(\d+)(?:[/?#]|$)/)?.[1];
  if (!topicId) return null;
  try {
    const res = await fetch(`https://${FORUM_HOST}/t/${topicId}.json`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.title !== "string" || !data.title) return null;
    const cooked = data.post_stream?.posts?.[0]?.cooked;
    return {
      title: data.title,
      excerpt: typeof cooked === "string" ? excerptFromCookedHtml(cooked) : undefined,
    };
  } catch {
    return null;
  }
}
