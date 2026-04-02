// ─── AZUP Markdown Parser & Fetcher ─────────────────────────────────────────

import type { AzupMeta } from "./types";

export interface AzupUrlInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  rawUrl: string;
}

// Match GitHub blob URLs: github.com/{owner}/{repo}/blob/{branch}/AZUPs/{file}.md
const BLOB_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(AZUPs\/[^?#]+\.md)/;

// Match raw URLs: raw.githubusercontent.com/{owner}/{repo}/{branch}/AZUPs/{file}.md
const RAW_PATTERN =
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(AZUPs\/[^?#]+\.md)/;

/**
 * Parse a GitHub AZUP markdown URL into structured data.
 * Returns null for non-AZUP URLs.
 */
export function parseAzupUrl(uri: string): AzupUrlInfo | null {
  let m = uri.match(BLOB_PATTERN);
  if (m) {
    const [, owner, repo, branch, path] = m;
    return {
      owner,
      repo,
      branch,
      path,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    };
  }

  m = uri.match(RAW_PATTERN);
  if (m) {
    const [, owner, repo, branch, path] = m;
    return {
      owner,
      repo,
      branch,
      path,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    };
  }

  return null;
}

/**
 * Fetch raw markdown content from raw.githubusercontent.com.
 */
export async function fetchAzupContent(info: AzupUrlInfo): Promise<string | null> {
  try {
    const res = await fetch(info.rawUrl, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Parse AZUP preamble from markdown content.
 * Extracts H1 title, table fields, and abstract section.
 */
export function parseAzupPreamble(markdown: string, sourceUrl: string): AzupMeta | null {
  // Extract title from H1: "# AZUP-X: Title" or "# Title"
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (!h1Match) return null;

  let title = h1Match[1].trim();
  // Skip template placeholder titles
  if (title.startsWith("[") || title === "AZUP-X: [Title]") return null;

  // Extract AZUP number from title if present: "AZUP-123: Some Title"
  let azupNumber: number | undefined;
  const azupTitleMatch = title.match(/^AZUP-(\d+):\s*(.+)/);
  if (azupTitleMatch) {
    azupNumber = parseInt(azupTitleMatch[1], 10);
    title = azupTitleMatch[2].trim();
  }

  // Parse preamble table rows: | `field` | value | or | field | value |
  const fields = new Map<string, string>();
  const tableRowRegex = /^\|\s*`?(\w[\w-]*)`?\s*\|\s*(.+?)\s*\|/gm;
  let rowMatch;
  while ((rowMatch = tableRowRegex.exec(markdown)) !== null) {
    const key = rowMatch[1].toLowerCase();
    const val = rowMatch[2].trim();
    // Skip placeholder values
    if (val && !val.startsWith("[") && val !== "--") {
      fields.set(key, val);
    }
  }

  // Override azupNumber from table if present
  const azupField = fields.get("azup");
  if (azupField) {
    const parsed = parseInt(azupField, 10);
    if (!isNaN(parsed)) azupNumber = parsed;
  }

  // Override title from table if present
  const titleField = fields.get("title");
  if (titleField) title = titleField;

  // Extract abstract section
  let abstract: string | undefined;
  const abstractMatch = markdown.match(/^##\s*Abstract\s*\n([\s\S]*?)(?=\n##\s|\n*$)/m);
  if (abstractMatch) {
    const text = abstractMatch[1].trim();
    if (text && !text.startsWith("[")) abstract = text;
  }

  // Parse azips-included as array
  let azipsIncluded: string[] | undefined;
  const azipsField = fields.get("azips-included");
  if (azipsField) {
    azipsIncluded = azipsField.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return {
    azupNumber,
    title,
    description: fields.get("description"),
    author: fields.get("author"),
    discussionsTo: fields.get("discussions-to"),
    azipsIncluded,
    created: fields.get("created"),
    abstract,
    sourceUrl,
  };
}

// In-memory cache for parsed AZUP metadata
const azupCache = new Map<string, AzupMeta | null>();

/**
 * Fetch and parse AZUP metadata from a GitHub URL.
 * Returns null for non-AZUP URIs (existing proposals fall through).
 */
export async function fetchAzupMeta(uri: string): Promise<AzupMeta | null> {
  const info = parseAzupUrl(uri);
  if (!info) return null;

  const cached = azupCache.get(info.rawUrl);
  if (cached !== undefined) return cached;

  const content = await fetchAzupContent(info);
  if (!content) {
    azupCache.set(info.rawUrl, null);
    return null;
  }

  const meta = parseAzupPreamble(content, uri);
  azupCache.set(info.rawUrl, meta);
  return meta;
}
