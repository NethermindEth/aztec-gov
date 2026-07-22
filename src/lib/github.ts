// ─── GitHub URL Parser & API Fetcher ─────────────────────────────────────────

import { AZUP_PATH_PATTERN } from "./azup";

// Authenticated requests get 5000 req/hr vs 60 unauthenticated, so titles
// don't degrade under load; set GITHUB_TOKEN in the deploy environment.
function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// GitHub API calls sit on the SSR critical path; bound them so a slow API
// can't stall the whole page render.
const GITHUB_TIMEOUT_MS = 5000;

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
          headers: githubHeaders(),
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title,
        state: data.merged ? "merged" : data.state,
        description: data.body ?? undefined,
      };
    }

    if (info.type === "issue" && info.number) {
      const res = await fetch(
        `https://api.github.com/repos/${info.owner}/${info.repo}/issues/${info.number}`,
        {
          headers: githubHeaders(),
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
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
          headers: githubHeaders(),
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
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

// Raw URL of the AZUP document in a payload PR, but only when the PR touches
// exactly one; multiple AZUPs are ambiguous, so we return null rather than
// guess and enrich the proposal with the wrong document.
export async function fetchPrAzupRawUrl(
  info: GitHubLinkInfo
): Promise<string | null> {
  if (info.type !== "pull" || !info.number) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.number}/files?per_page=100`,
      {
        headers: githubHeaders(),
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const files: { filename?: string; raw_url?: string }[] = await res.json();
    const azupFiles = files.filter((f) => AZUP_PATH_PATTERN.test(f.filename ?? ""));
    return azupFiles.length === 1 ? azupFiles[0].raw_url ?? null : null;
  } catch {
    return null;
  }
}
