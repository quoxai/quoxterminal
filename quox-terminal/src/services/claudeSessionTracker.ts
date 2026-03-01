/**
 * claudeSessionTracker.ts — Tracks files read/edited/created, token usage, and cost.
 *
 * Accumulates data from Claude events for the context panel sidebar.
 */

import type { ClaudeEvent, ToolCall } from "./claudeOutputParser";
import { estimateCost } from "../config/claudeConfig";

export type FileAction = "read" | "edited" | "created";

export interface TrackedFile {
  path: string;
  actions: FileAction[];
  lastToolCallId: string;
  touchCount: number;
}

export interface SessionStats {
  files: Map<string, TrackedFile>;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
  toolCallCount: number;
  startTime: number;
}

export function createSessionStats(): SessionStats {
  return {
    files: new Map(),
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    model: "",
    toolCallCount: 0,
    startTime: Date.now(),
  };
}

/**
 * Update session stats based on a tool call.
 */
export function trackToolCall(stats: SessionStats, toolCall: ToolCall): void {
  stats.toolCallCount++;

  const filePath = extractFilePath(toolCall);
  if (!filePath) return;

  const action = getFileAction(toolCall.tool);
  if (!action) return;

  const existing = stats.files.get(filePath);
  if (existing) {
    if (!existing.actions.includes(action)) {
      existing.actions.push(action);
    }
    existing.lastToolCallId = toolCall.id;
    existing.touchCount++;
  } else {
    stats.files.set(filePath, {
      path: filePath,
      actions: [action],
      lastToolCallId: toolCall.id,
      touchCount: 1,
    });
  }
}

/**
 * Update stats from a usage event.
 */
export function trackUsage(
  stats: SessionStats,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
): void {
  stats.inputTokens = inputTokens;
  stats.outputTokens = outputTokens;
  if (cacheReadTokens !== undefined) {
    stats.cacheReadTokens = cacheReadTokens;
  }
}

/**
 * Get estimated cost for the session.
 */
export function getSessionCost(stats: SessionStats): number {
  return estimateCost(stats.model || "opus", stats.inputTokens, stats.outputTokens);
}

/**
 * Get files sorted by touch count (most touched first).
 */
export function getTrackedFiles(stats: SessionStats): TrackedFile[] {
  return Array.from(stats.files.values()).sort(
    (a, b) => b.touchCount - a.touchCount,
  );
}

/**
 * Get session duration in seconds.
 */
export function getSessionDuration(stats: SessionStats): number {
  return Math.floor((Date.now() - stats.startTime) / 1000);
}

function extractFilePath(toolCall: ToolCall): string | null {
  const input = toolCall.input;
  if (input.file_path) return String(input.file_path);
  if (input.notebook_path) return String(input.notebook_path);
  return null;
}

function getFileAction(tool: string): FileAction | null {
  switch (tool) {
    case "Read":
      return "read";
    case "Edit":
      return "edited";
    case "Write":
    case "NotebookEdit":
      return "created";
    default:
      return null;
  }
}
