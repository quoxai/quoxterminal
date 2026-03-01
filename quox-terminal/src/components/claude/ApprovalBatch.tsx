/**
 * ApprovalBatch — Grouped pending tool call approval UI.
 *
 * When 2+ tool calls are pending, renders a batch card with
 * "Approve All" / "Deny All" plus individual toggles.
 */

import type { ToolCall } from "../../services/claudeOutputParser";
import { getToolStyle } from "../../config/claudeConfig";
import "./ApprovalBatch.css";

interface ApprovalBatchProps {
  pendingCalls: ToolCall[];
  onApproveAll: () => void;
  onDenyAll: () => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export default function ApprovalBatch({
  pendingCalls,
  onApproveAll,
  onDenyAll,
  onApprove,
  onDeny,
}: ApprovalBatchProps) {
  if (pendingCalls.length === 0) return null;

  return (
    <div className="approval-batch">
      <div className="approval-batch__header">
        <span className="approval-batch__count">
          {pendingCalls.length} pending approval{pendingCalls.length > 1 ? "s" : ""}
        </span>
        <div className="approval-batch__spacer" />
        <button
          className="approval-batch__btn approval-batch__btn--approve-all"
          onClick={onApproveAll}
        >
          Approve All ({pendingCalls.length})
        </button>
        <button
          className="approval-batch__btn approval-batch__btn--deny-all"
          onClick={onDenyAll}
        >
          Deny All
        </button>
      </div>

      <div className="approval-batch__list">
        {pendingCalls.map((tc) => {
          const style = getToolStyle(tc.tool);
          const summary = getSummary(tc);
          return (
            <div key={tc.id} className="approval-batch__item">
              <span
                className="approval-batch__tool-dot"
                style={{ background: style.color }}
              />
              <span className="approval-batch__tool-name">
                {style.label}
              </span>
              <span className="approval-batch__tool-summary">
                {summary}
              </span>
              <div className="approval-batch__item-spacer" />
              <button
                className="approval-batch__item-btn approval-batch__item-btn--approve"
                onClick={() => onApprove(tc.id)}
                title="Approve"
              >
                &#x2713;
              </button>
              <button
                className="approval-batch__item-btn approval-batch__item-btn--deny"
                onClick={() => onDeny(tc.id)}
                title="Deny"
              >
                &#x2717;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getSummary(tc: ToolCall): string {
  const input = tc.input;
  switch (tc.tool) {
    case "Read":
    case "Edit":
    case "Write":
      return String(input.file_path || "");
    case "Bash":
      return truncate(String(input.command || ""), 40);
    case "Grep":
    case "Glob":
      return truncate(String(input.pattern || ""), 30);
    default:
      return tc.tool;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
}
