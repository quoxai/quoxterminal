/**
 * ReadFileCard — Collapsible file preview for Read tool calls.
 *
 * Shows file path in header, line count, and collapsible content.
 */

import type { ToolCall } from "../../services/claudeOutputParser";
import { CLAUDE_DEFAULTS } from "../../config/claudeConfig";
import "./ReadFileCard.css";

interface ReadFileCardProps {
  toolCall: ToolCall;
  onToggleCollapse: (id: string) => void;
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ReadFileCard({
  toolCall,
  onToggleCollapse,
}: ReadFileCardProps) {
  const filePath = String(toolCall.input.file_path || "");
  const output = toolCall.output || "";
  const lineCount = output ? output.split("\n").length : 0;
  const duration = formatDuration(toolCall.duration);

  // Extract file extension for syntax hint
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  return (
    <div
      className={`read-card ${toolCall.collapsed ? "read-card--collapsed" : ""}`}
    >
      <div
        className="read-card__header"
        onClick={() => onToggleCollapse(toolCall.id)}
      >
        <svg
          className="read-card__icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="read-card__label">Read</span>
        <span className="read-card__path" title={filePath}>
          {filePath}
        </span>
        <div className="read-card__spacer" />
        {lineCount > 0 && (
          <span className="read-card__lines">{lineCount} lines</span>
        )}
        {duration && (
          <span className="read-card__duration">{duration}</span>
        )}
        <span
          className={`read-card__status read-card__status--${toolCall.status}`}
        />
        <span className="read-card__chevron">
          {toolCall.collapsed ? "\u25B8" : "\u25BE"}
        </span>
      </div>

      {!toolCall.collapsed && output && (
        <div className="read-card__body">
          <pre className={`read-card__content read-card__lang--${ext}`}>
            {output.length > 5000
              ? output.slice(0, 5000) + "\n... (truncated)"
              : output}
          </pre>
        </div>
      )}
    </div>
  );
}
