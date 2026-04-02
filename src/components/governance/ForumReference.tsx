import { TruncatedLink } from "@/components/ui/TruncatedLink";

interface ForumReferenceProps {
  url: string;
}

export function ForumReference({ url }: ForumReferenceProps) {
  const href = `https://${url}`;

  return (
    <div
      className="border p-6"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <ForumIcon />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Forum Discussion
        </span>
      </div>

      <TruncatedLink href={href} />
      <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
        View the community discussion and feedback on this proposal.
      </p>
    </div>
  );
}

function ForumIcon() {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
