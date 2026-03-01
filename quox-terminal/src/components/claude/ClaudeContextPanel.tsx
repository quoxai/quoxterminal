/**
 * ClaudeContextPanel — Right sidebar showing project context, token usage,
 * file heat map, and cost for a Claude Mode session.
 */

import TokenBudgetGauge from "./TokenBudgetGauge";
import FilesTracked from "./FilesTracked";
import CostTracker from "./CostTracker";
import type { TrackedFile } from "../../services/claudeSessionTracker";
import "./ClaudeContextPanel.css";

interface ClaudeContextPanelProps {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  files: TrackedFile[];
  durationSeconds: number;
  onClose: () => void;
}

export default function ClaudeContextPanel({
  model,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  files,
  durationSeconds,
  onClose,
}: ClaudeContextPanelProps) {
  return (
    <div className="claude-context-panel">
      <div className="claude-context-panel__header">
        <span className="claude-context-panel__title">Session Context</span>
        <button
          className="claude-context-panel__close"
          onClick={onClose}
          title="Close"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="claude-context-panel__body">
        <TokenBudgetGauge
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          cacheReadTokens={cacheReadTokens}
        />

        <FilesTracked files={files} />

        <CostTracker
          model={model}
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          durationSeconds={durationSeconds}
        />
      </div>
    </div>
  );
}
