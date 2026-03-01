/**
 * CostTracker — Running cost display for Claude session.
 */

import { estimateCost } from "../../config/claudeConfig";
import "./CostTracker.css";

interface CostTrackerProps {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationSeconds: number;
}

export default function CostTracker({
  model,
  inputTokens,
  outputTokens,
  durationSeconds,
}: CostTrackerProps) {
  const cost = estimateCost(model || "opus", inputTokens, outputTokens);
  const modelLabel = model
    ? model.replace("claude-", "").replace(/-\d+(-\d+)?$/, "")
    : "claude";

  return (
    <div className="cost-tracker">
      <div className="cost-tracker__row">
        <span className="cost-tracker__label">Model</span>
        <span className="cost-tracker__value cost-tracker__value--model">
          {modelLabel}
        </span>
      </div>
      <div className="cost-tracker__row">
        <span className="cost-tracker__label">Session Cost</span>
        <span className="cost-tracker__value cost-tracker__value--cost">
          ${cost.toFixed(4)}
        </span>
      </div>
      <div className="cost-tracker__row">
        <span className="cost-tracker__label">Duration</span>
        <span className="cost-tracker__value">
          {formatDuration(durationSeconds)}
        </span>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
