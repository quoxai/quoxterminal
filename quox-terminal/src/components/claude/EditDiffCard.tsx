/**
 * EditDiffCard — Syntax-highlighted diff card for Claude Edit tool calls.
 *
 * Shows old_string → new_string as a unified diff with red/green highlighting.
 * Includes approve/deny buttons when pending, collapses when done.
 */

import type { ToolCall } from "../../services/claudeOutputParser";
import { getToolStyle } from "../../config/claudeConfig";
import "./EditDiffCard.css";

interface EditDiffCardProps {
  toolCall: ToolCall;
  onToggleCollapse: (id: string) => void;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
}

function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const lines: DiffLine[] = [];

  // Simple line-by-line diff (not Myers — good enough for tool call diffs)
  const maxLen = Math.max(oldLines.length, newLines.length);

  // Find common prefix
  let prefixLen = 0;
  while (
    prefixLen < oldLines.length &&
    prefixLen < newLines.length &&
    oldLines[prefixLen] === newLines[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < oldLines.length - prefixLen &&
    suffixLen < newLines.length - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] ===
      newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Context lines (prefix)
  for (let i = Math.max(0, prefixLen - 2); i < prefixLen; i++) {
    lines.push({ type: "context", content: oldLines[i] });
  }

  // Removed lines
  for (let i = prefixLen; i < oldLines.length - suffixLen; i++) {
    lines.push({ type: "removed", content: oldLines[i] });
  }

  // Added lines
  for (let i = prefixLen; i < newLines.length - suffixLen; i++) {
    lines.push({ type: "added", content: newLines[i] });
  }

  // Context lines (suffix)
  const suffixStart = Math.max(
    oldLines.length - suffixLen,
    newLines.length - suffixLen,
  );
  for (
    let i = maxLen - suffixLen;
    i < Math.min(maxLen - suffixLen + 2, maxLen);
    i++
  ) {
    if (i >= 0 && i < oldLines.length) {
      lines.push({ type: "context", content: oldLines[i] });
    }
  }

  return lines;
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function EditDiffCard({
  toolCall,
  onToggleCollapse,
  onApprove,
  onDeny,
}: EditDiffCardProps) {
  const style = getToolStyle("Edit");
  const filePath = String(toolCall.input.file_path || "");
  const oldString = String(toolCall.input.old_string || "");
  const newString = String(toolCall.input.new_string || "");
  const replaceAll = toolCall.input.replace_all as boolean | undefined;
  const isPending = toolCall.status === "pending";
  const duration = formatDuration(toolCall.duration);

  const diffLines = computeDiff(oldString, newString);
  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  const statusClass = `edit-diff__status--${toolCall.status}`;

  return (
    <div
      className={`edit-diff ${toolCall.collapsed ? "edit-diff--collapsed" : ""}`}
      style={{ borderLeftColor: style.color }}
    >
      <div
        className="edit-diff__header"
        onClick={() => onToggleCollapse(toolCall.id)}
      >
        <svg
          className="edit-diff__icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={style.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        <span className="edit-diff__label">Edit</span>
        <span className="edit-diff__path" title={filePath}>
          {filePath}
        </span>
        {replaceAll && (
          <span className="edit-diff__badge">replace all</span>
        )}
        <span className="edit-diff__stats">
          <span className="edit-diff__stat edit-diff__stat--add">
            +{addedCount}
          </span>
          <span className="edit-diff__stat edit-diff__stat--remove">
            -{removedCount}
          </span>
        </span>
        <div className="edit-diff__spacer" />
        {duration && (
          <span className="edit-diff__duration">{duration}</span>
        )}
        <span className={`edit-diff__status ${statusClass}`} />
        <span className="edit-diff__chevron">
          {toolCall.collapsed ? "\u25B8" : "\u25BE"}
        </span>
      </div>

      {!toolCall.collapsed && (
        <div className="edit-diff__body">
          <div className="edit-diff__lines">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`edit-diff__line edit-diff__line--${line.type}`}
              >
                <span className="edit-diff__line-prefix">
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                </span>
                <span className="edit-diff__line-content">
                  {line.content || " "}
                </span>
              </div>
            ))}
          </div>

          {isPending && (
            <div className="edit-diff__actions">
              {onApprove && (
                <button
                  className="edit-diff__btn edit-diff__btn--approve"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(toolCall.id);
                  }}
                >
                  Approve
                </button>
              )}
              {onDeny && (
                <button
                  className="edit-diff__btn edit-diff__btn--deny"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeny(toolCall.id);
                  }}
                >
                  Deny
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
