import { fetchAzupMeta, fetchAzupMetaFromRawUrl } from "./azup";
import { fetchGitHubMeta, fetchPrAzupRawUrl } from "./github";
import {
  fetchForumTopicMeta,
  getForumUrl,
  isForumUrl,
  normalizeDiscussionUrl,
} from "./forum";
import type { GitHubInfo, ProposalEnrichment } from "./types";

// First non-empty markdown paragraph as plain text; HTML comments (PR
// templates) and images/links are stripped so they never leak into a summary.
function firstMarkdownParagraph(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined;
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, "");
  for (const block of withoutComments.split(/\r?\n\s*\r?\n/)) {
    const text = block
      .replace(/^#{1,6}\s.*$/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
  }
  return undefined;
}

// Server-side metadata for a proposal, shared by list and detail pages.
// Precedence: AZUP (direct or inside the payload PR) > forum topic > GitHub
// PR/repo; every fetch fails soft. Returns null when nothing resolved, so a
// failed pass never latches a placeholder over a later good render.
export async function fetchProposalEnrichment(
  githubInfo: GitHubInfo | undefined,
  uri: string | undefined,
  numericId: number
): Promise<ProposalEnrichment | null> {
  const github = githubInfo ? { ...githubInfo } : undefined;

  // Independent first wave: AZUP-by-URI, GitHub meta, curated forum topic.
  const curatedForumUrl = getForumUrl(numericId);
  const [directAzup, githubMeta, curatedForum] = await Promise.all([
    uri ? fetchAzupMeta(uri) : Promise.resolve(null),
    github ? fetchGitHubMeta(github) : Promise.resolve(null),
    curatedForumUrl ? fetchForumTopicMeta(curatedForumUrl) : Promise.resolve(null),
  ]);

  const githubApi = githubMeta
    ? {
        apiTitle: githubMeta.title,
        apiState: githubMeta.state,
        apiDescription: githubMeta.description,
      }
    : undefined;

  // Second wave: an AZUP embedded in the payload PR, only if none was linked.
  let azup = directAzup;
  if (!azup && github) {
    const azupRawUrl = await fetchPrAzupRawUrl(github);
    if (azupRawUrl) azup = await fetchAzupMetaFromRawUrl(azupRawUrl, github.url);
  }

  // Discussion link: the AZUP's own discussions-to (any host), else the
  // curated forum topic. Only forum-host links get a title/excerpt.
  const discussionUrl = normalizeDiscussionUrl(azup?.discussionsTo) ?? curatedForumUrl;
  const forumTopic = isForumUrl(discussionUrl)
    ? discussionUrl === curatedForumUrl
      ? curatedForum
      : await fetchForumTopicMeta(discussionUrl!)
    : null;

  const title = azup?.title ?? forumTopic?.title ?? githubMeta?.title;
  const summary =
    azup?.description ??
    azup?.abstract ??
    forumTopic?.excerpt ??
    firstMarkdownParagraph(github?.type === "pull" ? githubMeta?.description : undefined) ??
    (github?.type === "repo" ? githubMeta?.description : undefined);

  const enrichment: ProposalEnrichment = {};
  if (title) enrichment.title = title;
  if (summary) enrichment.description = summary;
  if (discussionUrl) enrichment.discussionUrl = discussionUrl;
  if (azup) enrichment.azupMeta = azup;
  if (githubApi) enrichment.githubApi = githubApi;

  return Object.keys(enrichment).length > 0 ? enrichment : null;
}
