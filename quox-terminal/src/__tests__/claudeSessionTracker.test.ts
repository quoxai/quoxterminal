import { describe, it, expect } from "vitest";
import {
  createSessionStats,
  trackToolCall,
  trackUsage,
  getTrackedFiles,
  getSessionCost,
} from "../services/claudeSessionTracker";
import type { ToolCall } from "../services/claudeOutputParser";

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "tc-1",
    tool: "Read",
    input: { file_path: "/src/main.ts" },
    status: "done",
    collapsed: false,
    ...overrides,
  };
}

describe("claudeSessionTracker", () => {
  it("creates empty stats", () => {
    const stats = createSessionStats();
    expect(stats.files.size).toBe(0);
    expect(stats.inputTokens).toBe(0);
    expect(stats.outputTokens).toBe(0);
    expect(stats.toolCallCount).toBe(0);
  });

  it("tracks a Read tool call", () => {
    const stats = createSessionStats();
    trackToolCall(stats, makeToolCall());

    expect(stats.toolCallCount).toBe(1);
    expect(stats.files.size).toBe(1);

    const files = getTrackedFiles(stats);
    expect(files[0].path).toBe("/src/main.ts");
    expect(files[0].actions).toContain("read");
    expect(files[0].touchCount).toBe(1);
  });

  it("tracks an Edit tool call", () => {
    const stats = createSessionStats();
    trackToolCall(
      stats,
      makeToolCall({
        id: "tc-edit",
        tool: "Edit",
        input: {
          file_path: "/src/auth.ts",
          old_string: "a",
          new_string: "b",
        },
      }),
    );

    const files = getTrackedFiles(stats);
    expect(files[0].path).toBe("/src/auth.ts");
    expect(files[0].actions).toContain("edited");
  });

  it("tracks a Write tool call as created", () => {
    const stats = createSessionStats();
    trackToolCall(
      stats,
      makeToolCall({
        id: "tc-write",
        tool: "Write",
        input: { file_path: "/src/new-file.ts", content: "hello" },
      }),
    );

    const files = getTrackedFiles(stats);
    expect(files[0].actions).toContain("created");
  });

  it("accumulates actions for the same file", () => {
    const stats = createSessionStats();
    trackToolCall(
      stats,
      makeToolCall({ id: "tc-1", tool: "Read", input: { file_path: "/src/main.ts" } }),
    );
    trackToolCall(
      stats,
      makeToolCall({ id: "tc-2", tool: "Edit", input: { file_path: "/src/main.ts", old_string: "a", new_string: "b" } }),
    );

    expect(stats.files.size).toBe(1);
    const files = getTrackedFiles(stats);
    expect(files[0].actions).toContain("read");
    expect(files[0].actions).toContain("edited");
    expect(files[0].touchCount).toBe(2);
  });

  it("sorts files by touch count", () => {
    const stats = createSessionStats();
    trackToolCall(stats, makeToolCall({ id: "1", tool: "Read", input: { file_path: "/a.ts" } }));
    trackToolCall(stats, makeToolCall({ id: "2", tool: "Read", input: { file_path: "/b.ts" } }));
    trackToolCall(stats, makeToolCall({ id: "3", tool: "Read", input: { file_path: "/b.ts" } }));
    trackToolCall(stats, makeToolCall({ id: "4", tool: "Read", input: { file_path: "/b.ts" } }));

    const files = getTrackedFiles(stats);
    expect(files[0].path).toBe("/b.ts");
    expect(files[0].touchCount).toBe(3);
    expect(files[1].path).toBe("/a.ts");
    expect(files[1].touchCount).toBe(1);
  });

  it("does not track tools without file paths", () => {
    const stats = createSessionStats();
    trackToolCall(
      stats,
      makeToolCall({ tool: "Bash", input: { command: "npm test" } }),
    );
    trackToolCall(
      stats,
      makeToolCall({ tool: "Grep", input: { pattern: "TODO" } }),
    );

    expect(stats.files.size).toBe(0);
    expect(stats.toolCallCount).toBe(2);
  });

  it("tracks usage", () => {
    const stats = createSessionStats();
    trackUsage(stats, 5000, 1000, 500);

    expect(stats.inputTokens).toBe(5000);
    expect(stats.outputTokens).toBe(1000);
    expect(stats.cacheReadTokens).toBe(500);
  });

  it("calculates session cost", () => {
    const stats = createSessionStats();
    stats.model = "opus";
    stats.inputTokens = 1_000_000;
    stats.outputTokens = 100_000;

    const cost = getSessionCost(stats);
    // opus: $15/M input + $75/M output
    expect(cost).toBeCloseTo(15 + 7.5, 1);
  });
});
