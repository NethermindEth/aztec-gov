import { truncateUrl } from "@/lib/format";

interface TruncatedLinkProps {
  href: string;
  maxLen?: number;
  className?: string;
}

export function TruncatedLink({ href, maxLen, className }: TruncatedLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-sm hover:underline ${className ?? ""}`}
      style={{ color: "var(--accent-tertiary)" }}
    >
      {truncateUrl(href, maxLen)}
    </a>
  );
}
