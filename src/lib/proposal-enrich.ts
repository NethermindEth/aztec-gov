import { fetchAzupMeta, fetchAzupMetaFromRawUrl } from "./azup";
import { fetchGitHubMeta, fetchPrAzupRawUrl } from "./github";
import { fetchForumTopicMeta, getForumUrl, normalizeForumUrl } from "./forum";
import type { ProposalDetailView, ProposalView } from "./types";

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

// Server-side enrichment shared by list and detail pages. Precedence: AZUP
// (direct or inside the payload PR) > forum topic > GitHub PR/repo; fails soft.
export async function enrichProposalView(
  view: ProposalView | ProposalDetailView,
  uri: string | undefined
): Promise<void> {
  const github = view.githubInfo;

  // Independent first wave: AZUP-by-URI, GitHub meta, curated forum topic.
  const curatedForumUrl = getForumUrl(view.numericId);
  const [directAzup, githubMeta, curatedForum] = await Promise.all([
    uri ? fetchAzupMeta(uri) : Promise.resolve(null),
    github ? fetchGitHubMeta(github) : Promise.resolve(null),
    curatedForumUrl ? fetchForumTopicMeta(curatedForumUrl) : Promise.resolve(null),
  ]);

  if (github && githubMeta) {
    if (githubMeta.title) github.apiTitle = githubMeta.title;
    if (githubMeta.state) github.apiState = githubMeta.state;
    if (githubMeta.description) github.apiDescription = githubMeta.description;
  }

  // Second wave: an AZUP embedded in the payload PR, only if none was linked.
  let azup = directAzup;
  if (!azup && github) {
    const azupRawUrl = await fetchPrAzupRawUrl(github);
    if (azupRawUrl) azup = await fetchAzupMetaFromRawUrl(azupRawUrl, github.url);
  }
  if (azup) view.azupMeta = azup;

  // Forum: prefer the AZUP's own discussions-to, else the curated topic.
  const azupForumUrl = normalizeForumUrl(azup?.discussionsTo);
  const forumUrl = azupForumUrl ?? curatedForumUrl;
  if (forumUrl) view.forumUrl = forumUrl;
  const forumTopic = azupForumUrl
    ? await fetchForumTopicMeta(azupForumUrl)
    : curatedForum;

  const title = azup?.title ?? forumTopic?.title ?? github?.apiTitle;
  if (title) view.title = title;

  const prBody = github?.type === "pull" ? github.apiDescription : undefined;
  const repoDescription = github?.type === "repo" ? github.apiDescription : undefined;
  const summary =
    azup?.description ??
    azup?.abstract ??
    forumTopic?.excerpt ??
    firstMarkdownParagraph(prBody) ??
    repoDescription;
  if (summary) view.description = summary;

  // "enriched" means real data was found, not merely that this ran, so a
  // failed pass never latches a placeholder over a later good render.
  view.enriched = Boolean(title || summary || view.forumUrl);
}
