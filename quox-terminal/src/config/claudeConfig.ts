/**
 * claudeConfig.ts — Configuration for Claude Mode
 *
 * Tool card visual coding, model pricing, and defaults.
 */

// ── Tool Card Visual Coding ──────────────────────────────────────────────────

export interface ToolCardStyle {
  color: string;
  icon: string;
  label: string;
}

export const TOOL_CARD_STYLES: Record<string, ToolCardStyle> = {
  Read: { color: "#38bdf8", icon: "file", label: "Read" },
  Edit: { color: "#4ade80", icon: "pencil", label: "Edit" },
  Write: { color: "#facc15", icon: "plus", label: "Write" },
  Bash: { color: "#f59e0b", icon: "terminal", label: "Bash" },
  Grep: { color: "#a78bfa", icon: "search", label: "Grep" },
  Glob: { color: "#a78bfa", icon: "search", label: "Glob" },
  Agent: { color: "#818cf8", icon: "users", label: "Agent" },
  WebSearch: { color: "#22d3ee", icon: "globe", label: "WebSearch" },
  WebFetch: { color: "#22d3ee", icon: "globe", label: "WebFetch" },
  AskUserQuestion: { color: "#f472b6", icon: "help", label: "Question" },
  NotebookEdit: { color: "#facc15", icon: "notebook", label: "Notebook" },
  TodoWrite: { color: "#fb923c", icon: "list", label: "Todo" },
};

export function getToolStyle(toolName: string): ToolCardStyle {
  return (
    TOOL_CARD_STYLES[toolName] || {
      color: "#94a3b8",
      icon: "tool",
      label: toolName,
    }
  );
}

// ── Model Pricing (per 1M tokens, USD) ──────────────────────────────────────

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.8, outputPerMillion: 4 },
  // Fallback
  opus: { inputPerMillion: 15, outputPerMillion: 75 },
  sonnet: { inputPerMillion: 3, outputPerMillion: 15 },
  haiku: { inputPerMillion: 0.8, outputPerMillion: 4 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["opus"];
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

// ── Context Window ──────────────────────────────────────────────────────────

export const CONTEXT_WINDOW_TOKENS = 200_000;

// ── Defaults ────────────────────────────────────────────────────────────────

export const CLAUDE_DEFAULTS = {
  /** Max lines of output before auto-collapsing a tool card */
  AUTO_COLLAPSE_LINES: 20,
  /** Lines to show at head/tail when collapsed */
  COLLAPSED_PREVIEW_LINES: 5,
  /** Max raw debug buffer lines */
  MAX_RAW_BUFFER: 1000,
};
