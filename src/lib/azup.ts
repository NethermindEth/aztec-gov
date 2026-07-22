// ─── AZUP Markdown Parser & Fetcher ─────────────────────────────────────────

import type { AzupMeta } from "./types";

export interface AzupUrlInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  rawUrl: string;
}

// A repo-relative AZUP document path, e.g. "AZUPs/azup-1.md" (nested allowed).
export const AZUP_PATH_PATTERN = /(?:^|\/)AZUPs\/[^?#]+\.md$/;

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
export async function fetchAzupContent(
  info: Pick<AzupUrlInfo, "rawUrl">
): Promise<string | null> {
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
const PREAMBLE_FIELDS = new Set([
  "azup",
  "title",
  "description",
  "author",
  "azips-included",
  "discussions-to",
  "created",
]);

// Parses the AZUP preamble table, whether horizontal (field names in a header
// row, values below) or vertical (| key | value |), to lowercased field->value.
function parsePreambleTable(markdown: string): Map<string, string> {
  const fields = new Map<string, string>();
  const rows = markdown
    .split("\n")
    .filter((l) => /^\s*\|/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|\s*$/, "")
        // Split on unescaped pipes; a value may contain an escaped "\|".
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replace(/\\\|/g, "|").replace(/^`|`$/g, ""))
    );
  const dataRows = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
  if (dataRows.length === 0) return fields;

  const header = dataRows[0].map((c) => c.toLowerCase());
  const set = (key: string, val: string) => {
    if (val && !val.startsWith("[") && val !== "--") fields.set(key, val);
  };

  if (header.length > 2 && header.some((c) => PREAMBLE_FIELDS.has(c)) && dataRows[1]) {
    const values = dataRows[1];
    header.forEach((key, i) => set(key, (values[i] ?? "").trim()));
  } else {
    for (const r of dataRows) if (r.length >= 2) set(r[0].toLowerCase(), r[1].trim());
  }
  return fields;
}

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

  const fields = parsePreambleTable(markdown);

  // Override azupNumber from table if present
  const azupField = fields.get("azup");
  if (azupField) {
    const parsed = parseInt(azupField, 10);
    if (!isNaN(parsed)) azupNumber = parsed;
  }

  // Override title from table if present, dropping any redundant "AZUP-N:"
  // prefix so it isn't shown twice alongside the proposal id.
  const titleField = fields.get("title");
  if (titleField) title = titleField.replace(/^AZUP-\d+:\s*/, "");

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

// Fetch+parse AZUP metadata from a GitHub URL; null for non-AZUP URIs.
export async function fetchAzupMeta(uri: string): Promise<AzupMeta | null> {
  const info = parseAzupUrl(uri);
  return info ? fetchAzupMetaFromRawUrl(info.rawUrl, uri) : null;
}

// Same fetch+parse for a raw file URL discovered inside a payload PR, where
// the on-chain URI itself is not an AZUP link.
export async function fetchAzupMetaFromRawUrl(
  rawUrl: string,
  sourceUrl: string
): Promise<AzupMeta | null> {
  const cached = azupCache.get(rawUrl);
  if (cached !== undefined) return cached;

  const content = await fetchAzupContent({ rawUrl });
  const meta = content ? parseAzupPreamble(content, sourceUrl) : null;
  azupCache.set(rawUrl, meta);
  return meta;
}
