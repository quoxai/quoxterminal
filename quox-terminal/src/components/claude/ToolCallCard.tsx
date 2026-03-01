/**
 * ToolCallCard — Generic card renderer for Claude tool calls.
 *
 * Renders a collapsible card with tool-specific coloring and icon.
 * Dispatches to specialized cards for Read, Edit, Bash when available.
 */

import { type ToolCall } from "../../services/claudeOutputParser";
import { getToolStyle } from "../../config/claudeConfig";
import EditDiffCard from "./EditDiffCard";
import BashOutputCard from "./BashOutputCard";
import ReadFileCard from "./ReadFileCard";
import "./ToolCallCard.css";

interface ToolCallCardProps {
  toolCall: ToolCall;
  onToggleCollapse: (id: string) => void;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

function getStatusDot(status: ToolCall["status"]): string {
  switch (status) {
    case "pending":
      return "tool-card__status--pending";
    case "approved":
    case "running":
      return "tool-card__status--running";
    case "done":
      return "tool-card__status--done";
    case "denied":
      return "tool-card__status--denied";
    case "error":
      return "tool-card__status--error";
    default:
      return "";
  }
}

function getToolSummary(toolCall: ToolCall): string {
  const input = toolCall.input;
  switch (toolCall.tool) {
    case "Read":
      return String(input.file_path || "");
    case "Edit":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    case "Bash":
      return truncate(String(input.command || ""), 60);
    case "Grep":
      return truncate(String(input.pattern || ""), 40);
    case "Glob":
      return truncate(String(input.pattern || ""), 40);
    case "Agent":
      return truncate(String(input.description || input.prompt || ""), 50);
    case "WebSearch":
      return truncate(String(input.query || ""), 50);
    case "WebFetch":
      return truncate(String(input.url || ""), 50);
    case "AskUserQuestion": {
      const questions = input.questions;
      if (Array.isArray(questions) && questions.length > 0) {
        const q = questions[0] as Record<string, unknown>;
        return truncate(String(q.question || ""), 60);
      }
      return "Question";
    }
    default:
      return toolCall.tool;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getToolIcon(icon: string): JSX.Element {
  switch (icon) {
    case "file":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "pencil":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      );
    case "plus":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "terminal":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case "search":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "users":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "globe":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "help":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
  }
}

export default function ToolCallCard({
  toolCall,
  onToggleCollapse,
  onApprove,
  onDeny,
}: ToolCallCardProps) {
  // Dispatch to specialized cards for common tool types
  if (toolCall.tool === "Edit") {
    return (
      <EditDiffCard
        toolCall={toolCall}
        onToggleCollapse={onToggleCollapse}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    );
  }

  if (toolCall.tool === "Bash") {
    return (
      <BashOutputCard
        toolCall={toolCall}
        onToggleCollapse={onToggleCollapse}
      />
    );
  }

  if (toolCall.tool === "Read") {
    return (
      <ReadFileCard
        toolCall={toolCall}
        onToggleCollapse={onToggleCollapse}
      />
    );
  }

  // Generic card for all other tool types
  const style = getToolStyle(toolCall.tool);
  const summary = getToolSummary(toolCall);
  const statusClass = getStatusDot(toolCall.status);
  const duration = formatDuration(toolCall.duration);
  const isPending = toolCall.status === "pending";

  return (
    <div
      className={`tool-card ${toolCall.collapsed ? "tool-card--collapsed" : ""}`}
      style={{ borderLeftColor: style.color }}
    >
      <div
        className="tool-card__header"
        onClick={() => onToggleCollapse(toolCall.id)}
      >
        <span className="tool-card__icon" style={{ color: style.color }}>
          {getToolIcon(style.icon)}
        </span>
        <span className="tool-card__tool-name">{style.label}</span>
        <span className="tool-card__summary" title={summary}>
          {summary}
        </span>
        <div className="tool-card__spacer" />
        {duration && <span className="tool-card__duration">{duration}</span>}
        <span className={`tool-card__status ${statusClass}`} />
        <span className="tool-card__chevron">
          {toolCall.collapsed ? "\u25B8" : "\u25BE"}
        </span>
      </div>

      {!toolCall.collapsed && (
        <div className="tool-card__body">
          {/* Tool input */}
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div className="tool-card__input">
              <pre className="tool-card__pre">
                {renderToolInput(toolCall)}
              </pre>
            </div>
          )}

          {/* Tool output */}
          {toolCall.output && (
            <div className="tool-card__output">
              <pre className="tool-card__pre">{toolCall.output}</pre>
            </div>
          )}

          {/* Approval buttons */}
          {isPending && (
            <div className="tool-card__actions">
              {onApprove && (
                <button
                  className="tool-card__btn tool-card__btn--approve"
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
                  className="tool-card__btn tool-card__btn--deny"
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

function renderToolInput(toolCall: ToolCall): string {
  const input = toolCall.input;
  switch (toolCall.tool) {
    case "Bash":
      return String(input.command || "");
    case "Read":
      return String(input.file_path || "");
    case "Edit": {
      const lines: string[] = [];
      if (input.file_path) lines.push(`File: ${input.file_path}`);
      if (input.old_string) {
        lines.push("--- old");
        lines.push(String(input.old_string));
      }
      if (input.new_string) {
        lines.push("+++ new");
        lines.push(String(input.new_string));
      }
      return lines.join("\n");
    }
    case "Write": {
      const lines: string[] = [];
      if (input.file_path) lines.push(`File: ${input.file_path}`);
      if (input.content) {
        const content = String(input.content);
        const preview =
          content.length > 500 ? content.slice(0, 500) + "\n..." : content;
        lines.push(preview);
      }
      return lines.join("\n");
    }
    case "Grep":
    case "Glob":
      return `Pattern: ${input.pattern || ""}\nPath: ${input.path || "."}`;
    default:
      return JSON.stringify(input, null, 2);
  }
}
