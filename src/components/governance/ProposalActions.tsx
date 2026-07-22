import { truncateAddress, getExplorerUrl } from "@/lib/format";
import type { ProposalAction } from "@/lib/types";

interface ProposalActionsProps {
  actions: ProposalAction[];
}

// A signature is "name(uint256,address)"; show just the name, which is what
// reads. Falls back to the raw selector when the lookup found nothing.
function callLabel(action: ProposalAction): string {
  if (action.signature) return `${action.signature.split("(")[0]}()`;
  return action.selector;
}

export function ProposalActions({ actions }: ProposalActionsProps) {
  const explorerUrl = getExplorerUrl();

  return (
    <div className="border" style={{ borderColor: "var(--border-default)" }}>
      <h3
        className="text-sm font-medium tracking-widest uppercase px-6 py-4 border-b flex items-center justify-between"
        style={{ color: "var(--text-primary)", borderColor: "var(--border-default)" }}
      >
        <span>Execution</span>
        <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
          {actions.length} action{actions.length === 1 ? "" : "s"}
        </span>
      </h3>
      <div className="flex flex-col">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-6 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border-default)" }}
          >
            <span
              className="text-xs tabular-nums shrink-0"
              style={{ color: "var(--text-faint)" }}
            >
              {i + 1}
            </span>
            <code
              className="text-sm truncate"
              style={{ color: "var(--accent-primary)" }}
            >
              {callLabel(action)}
            </code>
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              on
            </span>
            <a
              href={`${explorerUrl}/address/${action.target}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm ml-auto shrink-0 hover:underline"
              style={{ color: "var(--accent-tertiary)" }}
            >
              {action.targetLabel ?? truncateAddress(action.target)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
