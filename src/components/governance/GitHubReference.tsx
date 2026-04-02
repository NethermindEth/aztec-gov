import type { GitHubInfo } from "@/lib/types";
import { TruncatedLink } from "@/components/ui/TruncatedLink";

interface GitHubReferenceProps {
  uri: string;
  description?: string;
  githubInfo?: GitHubInfo;
}

const TYPE_LABELS: Record<string, string> = {
  pull: "Pull Request",
  issue: "Issue",
  repo: "Repository",
  commit: "Commit",
  tree: "Branch",
};

export function GitHubReference({ uri, description, githubInfo }: GitHubReferenceProps) {
  return (
    <div
      className="border p-6"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <GitHubIcon />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          GitHub Reference
        </span>
        {githubInfo && (
          <span
            className="ml-1 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{
              backgroundColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            {TYPE_LABELS[githubInfo.type] ?? githubInfo.type}
          </span>
        )}
      </div>

      {githubInfo && (
        <div className="flex flex-col gap-1 mb-2">
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {githubInfo.owner}/{githubInfo.repo}
            {githubInfo.number ? ` #${githubInfo.number}` : ""}
          </span>
          {githubInfo.apiTitle && (
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {githubInfo.apiTitle}
            </span>
          )}
          {githubInfo.apiState && (
            <span
              className="text-xs capitalize"
              style={{ color: "var(--text-muted)" }}
            >
              {githubInfo.apiState}
            </span>
          )}
        </div>
      )}

      <TruncatedLink href={uri} />
      {description && (
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-secondary)" }}
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}
