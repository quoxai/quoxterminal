import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ClaudeConversation from "../components/claude/ClaudeConversation";
import type { ClaudeMessage } from "../services/claudeOutputParser";

function makeMessage(overrides: Partial<ClaudeMessage> = {}): ClaudeMessage {
  return {
    id: "msg-1",
    type: "assistant",
    text: "Hello world",
    toolCalls: [],
    timestamp: Date.now(),
    pending: false,
    ...overrides,
  };
}

describe("ClaudeConversation", () => {
  it("shows welcome state when no messages and idle", () => {
    render(
      <ClaudeConversation
        messages={[]}
        status="idle"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText(/Claude Mode/)).toBeInTheDocument();
  });

  it("renders user message", () => {
    render(
      <ClaudeConversation
        messages={[
          makeMessage({
            id: "msg-user",
            type: "user",
            text: "Fix the auth bug",
          }),
        ]}
        status="running"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("renders assistant message with markdown", () => {
    render(
      <ClaudeConversation
        messages={[
          makeMessage({
            type: "assistant",
            text: "I'll fix the **auth bug** now.",
          }),
        ]}
        status="running"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText(/auth bug/)).toBeInTheDocument();
  });

  it("renders system message", () => {
    render(
      <ClaudeConversation
        messages={[
          makeMessage({
            id: "msg-sys",
            type: "system",
            text: "Error: rate limited",
          }),
        ]}
        status="error"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Error: rate limited")).toBeInTheDocument();
  });

  it("renders tool calls within assistant message", () => {
    const { container } = render(
      <ClaudeConversation
        messages={[
          makeMessage({
            type: "assistant",
            text: "Let me read the file.",
            toolCalls: [
              {
                id: "tc-1",
                tool: "Read",
                input: { file_path: "/src/main.rs" },
                status: "done",
                collapsed: false,
              },
            ],
          }),
        ]}
        status="running"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    // Read dispatches to ReadFileCard
    expect(container.querySelector(".read-card")).toBeTruthy();
    expect(screen.getByText("Read")).toBeInTheDocument();
    const path = container.querySelector(".read-card__path");
    expect(path?.textContent).toBe("/src/main.rs");
  });

  it("shows typing indicator when message is pending", () => {
    const { container } = render(
      <ClaudeConversation
        messages={[makeMessage({ pending: true, text: "Thinking" })]}
        status="running"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(
      container.querySelector(".claude-conv__typing"),
    ).toBeTruthy();
  });

  it("shows spawning status", () => {
    render(
      <ClaudeConversation
        messages={[]}
        status="spawning"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Starting Claude...")).toBeInTheDocument();
  });

  it("renders multiple messages in order", () => {
    render(
      <ClaudeConversation
        messages={[
          makeMessage({ id: "m1", type: "user", text: "First" }),
          makeMessage({ id: "m2", type: "assistant", text: "Second" }),
          makeMessage({ id: "m3", type: "user", text: "Third" }),
        ]}
        status="running"
        onToggleToolCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });
});
