/**
 * BashOutputCard — Command output card with ANSI color rendering.
 *
 * Shows command, exit code badge, and collapsible output.
 * Auto-collapses long output (>20 lines) with head/tail preview.
 */

import { useState } from "react";
import type { ToolCall } from "../../services/claudeOutputParser";
import { CLAUDE_DEFAULTS } from "../../config/claudeConfig";
import "./BashOutputCard.css";

interface BashOutputCardProps {
  toolCall: ToolCall;
  onToggleCollapse: (id: string) => void;
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getExitCode(toolCall: ToolCall): number | null {
  // Try to extract exit code from output
  if (toolCall.isError) return 1;
  if (toolCall.status === "done") return 0;
  return null;
}

/**
 * Strip basic ANSI escape codes for clean display.
 * We keep the text content but remove color/formatting codes.
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export default function BashOutputCard({
  toolCall,
  onToggleCollapse,
}: BashOutputCardProps) {
  const command = String(toolCall.input.command || "");
  const output = stripAnsi(toolCall.output || "");
  const duration = formatDuration(toolCall.duration);
  const exitCode = getExitCode(toolCall);
  const [expanded, setExpanded] = useState(false);

  const outputLines = output.split("\n");
  const isLong =
    outputLines.length > CLAUDE_DEFAULTS.AUTO_COLLAPSE_LINES;
  const previewLines = CLAUDE_DEFAULTS.COLLAPSED_PREVIEW_LINES;

  const statusClass = toolCall.isError
    ? "bash-card__exit--error"
    : "bash-card__exit--ok";

  return (
    <div
      className={`bash-card ${toolCall.collapsed ? "bash-card--collapsed" : ""}`}
    >
      <div
        className="bash-card__header"
        onClick={() => onToggleCollapse(toolCall.id)}
      >
        <svg
          className="bash-card__icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span className="bash-card__label">Bash</span>
        <span className="bash-card__command" title={command}>
          {command.length > 60
            ? command.slice(0, 59) + "\u2026"
            : command}
        </span>
        <div className="bash-card__spacer" />
        {duration && (
          <span className="bash-card__duration">{duration}</span>
        )}
        {exitCode !== null && (
          <span className={`bash-card__exit ${statusClass}`}>
            {exitCode === 0 ? "ok" : `exit ${exitCode}`}
          </span>
        )}
        <span className="bash-card__chevron">
          {toolCall.collapsed ? "\u25B8" : "\u25BE"}
        </span>
      </div>

      {!toolCall.collapsed && output && (
        <div className="bash-card__body">
          <pre className="bash-card__output">
            {isLong && !expanded ? (
              <>
                {outputLines.slice(0, previewLines).join("\n")}
                {"\n"}
                <span
                  className="bash-card__expand"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                >
                  ... {outputLines.length - previewLines * 2} more lines
                  (click to expand)
                </span>
                {"\n"}
                {outputLines.slice(-previewLines).join("\n")}
              </>
            ) : (
              output
            )}
          </pre>
          {isLong && expanded && (
            <button
              className="bash-card__collapse-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
            >
              Collapse
            </button>
          )}
        </div>
      )}
    </div>
  );
}
