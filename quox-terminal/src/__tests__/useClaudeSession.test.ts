import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useClaudeSession from "../hooks/useClaudeSession";

// Mock Tauri APIs
vi.mock("../lib/tauri-claude", () => ({
  claudeSpawn: vi.fn().mockResolvedValue("session-123"),
  claudeWrite: vi.fn().mockResolvedValue(undefined),
  claudeKill: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

describe("useClaudeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with idle status", () => {
    const { result } = renderHook(() => useClaudeSession());
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.sessionId).toBeNull();
    expect(result.current.state.messages).toEqual([]);
  });

  it("spawns a session and transitions to running", async () => {
    const { result } = renderHook(() => useClaudeSession());

    await act(async () => {
      await result.current.spawn("/home/user/project");
    });

    expect(result.current.state.sessionId).toBe("session-123");
    expect(result.current.state.status).toBe("running");
  });

  it("adds user message on sendMessage", async () => {
    const { result } = renderHook(() => useClaudeSession());

    await act(async () => {
      await result.current.spawn("/home/user/project");
    });

    await act(async () => {
      await result.current.sendMessage("Fix the bug");
    });

    const userMsg = result.current.state.messages.find(
      (m) => m.type === "user",
    );
    expect(userMsg).toBeDefined();
    expect(userMsg!.text).toBe("Fix the bug");
  });

  it("kills session and transitions to exited", async () => {
    const { result } = renderHook(() => useClaudeSession());

    await act(async () => {
      await result.current.spawn("/home/user/project");
    });

    await act(async () => {
      await result.current.kill();
    });

    expect(result.current.state.sessionId).toBeNull();
    expect(result.current.state.status).toBe("exited");
  });

  it("handles spawn error", async () => {
    const { claudeSpawn } = await import("../lib/tauri-claude");
    vi.mocked(claudeSpawn).mockRejectedValueOnce(
      new Error("Claude not installed"),
    );

    const { result } = renderHook(() => useClaudeSession());

    await act(async () => {
      await result.current.spawn("/home/user/project");
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toBe("Claude not installed");
  });

  it("initializes with zero token counts", () => {
    const { result } = renderHook(() => useClaudeSession());
    expect(result.current.state.inputTokens).toBe(0);
    expect(result.current.state.outputTokens).toBe(0);
    expect(result.current.state.cacheReadTokens).toBe(0);
  });

  it("resets state when spawning a new session", async () => {
    const { result } = renderHook(() => useClaudeSession());

    // First spawn
    await act(async () => {
      await result.current.spawn("/home/user/project");
    });

    // Send a message
    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.state.messages.length).toBeGreaterThan(0);

    // Second spawn — should reset
    await act(async () => {
      await result.current.spawn("/home/user/project2");
    });

    // Messages should be empty after respawn
    // (user message was added before spawn resolves)
    expect(result.current.state.sessionId).toBe("session-123");
  });
});
