/**
 * TokenBudgetGauge — Stacked horizontal bar showing context window usage.
 *
 * Segments: conversation tokens, free space.
 * Turns amber < 20% free, red < 10% free.
 */

import { CONTEXT_WINDOW_TOKENS } from "../../config/claudeConfig";
import "./TokenBudgetGauge.css";

interface TokenBudgetGaugeProps {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

export default function TokenBudgetGauge({
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
}: TokenBudgetGaugeProps) {
  const totalUsed = inputTokens + outputTokens;
  const total = CONTEXT_WINDOW_TOKENS;
  const freeTokens = Math.max(0, total - totalUsed);
  const freePercent = (freeTokens / total) * 100;
  const usedPercent = Math.min(100, (totalUsed / total) * 100);

  const barClass =
    freePercent < 10
      ? "token-gauge__bar--critical"
      : freePercent < 20
        ? "token-gauge__bar--warning"
        : "";

  return (
    <div className="token-gauge">
      <div className="token-gauge__label">
        <span className="token-gauge__title">Context Window</span>
        <span className="token-gauge__total">
          {formatTokens(totalUsed)} / {formatTokens(total)}
        </span>
      </div>
      <div className={`token-gauge__bar ${barClass}`}>
        <div
          className="token-gauge__segment token-gauge__segment--input"
          style={{ width: `${Math.min(100, (inputTokens / total) * 100)}%` }}
          title={`Input: ${formatTokens(inputTokens)}`}
        />
        <div
          className="token-gauge__segment token-gauge__segment--output"
          style={{ width: `${Math.min(100 - (inputTokens / total) * 100, (outputTokens / total) * 100)}%` }}
          title={`Output: ${formatTokens(outputTokens)}`}
        />
      </div>
      <div className="token-gauge__legend">
        <span className="token-gauge__legend-item">
          <span className="token-gauge__dot token-gauge__dot--input" />
          In: {formatTokens(inputTokens)}
        </span>
        <span className="token-gauge__legend-item">
          <span className="token-gauge__dot token-gauge__dot--output" />
          Out: {formatTokens(outputTokens)}
        </span>
        {cacheReadTokens > 0 && (
          <span className="token-gauge__legend-item">
            <span className="token-gauge__dot token-gauge__dot--cache" />
            Cache: {formatTokens(cacheReadTokens)}
          </span>
        )}
        <span className="token-gauge__legend-item token-gauge__legend-item--free">
          Free: {freePercent.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
