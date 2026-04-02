// ─── GitHub URL Parser & API Fetcher ─────────────────────────────────────────

export interface GitHubLinkInfo {
  owner: string;
  repo: string;
  type: "pull" | "issue" | "repo" | "commit" | "tree";
  number?: number;
  url: string;
}

export interface GitHubMeta {
  title?: string;
  state?: string; // "open" | "closed" | "merged"
  description?: string;
}

const GITHUB_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?(?:\/(pull|issues|commit|tree)\/?(.+?))?\/?$/;

/**
 * Parse a GitHub URL into structured data.
 * Returns null for non-GitHub URLs.
 */
export function parseGitHubUrl(url: string): GitHubLinkInfo | null {
  const m = url.match(GITHUB_PATTERN);
  if (!m) return null;

  const [, owner, repo, kind, ref] = m;

  if (!kind) {
    return { owner, repo, type: "repo", url };
  }

  const typeMap: Record<string, GitHubLinkInfo["type"]> = {
    pull: "pull",
    issues: "issue",
    commit: "commit",
    tree: "tree",
  };

  const type = typeMap[kind] ?? "repo";
  const number =
    (type === "pull" || type === "issue") && ref
      ? parseInt(ref, 10)
      : undefined;

  return { owner, repo, type, number: Number.isNaN(number) ? undefined : number, url };
}

/**
 * Human-readable title from parsed GitHub info.
 * PR: "aztec-packages#20865"
 * Issue: "aztec-packages#42"
 * Repo: "ignition-contracts"
 */
export function formatGitHubTitle(info: GitHubLinkInfo): string {
  if ((info.type === "pull" || info.type === "issue") && info.number) {
    return `${info.repo}#${info.number}`;
  }
  return info.repo;
}

/**
 * Fetch metadata from the GitHub REST API (unauthenticated, 60 req/hr).
 * Server-side only — returns null on any failure.
 */
export async function fetchGitHubMeta(
  info: GitHubLinkInfo
): Promise<GitHubMeta | null> {
  try {
    if (info.type === "pull" && info.number) {
      const res = await fetch(
        `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.number}`,
        {
          headers: { Accept: "application/vnd.github.v3+json" },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title,
        state: data.merged ? "merged" : data.state,
      };
    }

    if (info.type === "issue" && info.number) {
      const res = await fetch(
        `https://api.github.com/repos/${info.owner}/${info.repo}/issues/${info.number}`,
        {
          headers: { Accept: "application/vnd.github.v3+json" },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return { title: data.title, state: data.state };
    }

    if (info.type === "repo") {
      const res = await fetch(
        `https://api.github.com/repos/${info.owner}/${info.repo}`,
        {
          headers: { Accept: "application/vnd.github.v3+json" },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return { description: data.description };
    }

    return null;
  } catch {
    return null;
  }
}
