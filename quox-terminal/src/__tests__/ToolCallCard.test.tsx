import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToolCallCard from "../components/claude/ToolCallCard";
import type { ToolCall } from "../services/claudeOutputParser";

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "toolu_test",
    tool: "Grep", // Use a generic tool (not Read/Edit/Bash which dispatch to specialized cards)
    input: { pattern: "TODO", path: "src/" },
    status: "done",
    collapsed: false,
    ...overrides,
  };
}

describe("ToolCallCard", () => {
  // ── Generic card tests (non-specialized tools) ──

  it("renders tool name and summary for generic tools", () => {
    render(
      <ToolCallCard
        toolCall={makeToolCall()}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Grep")).toBeInTheDocument();
  });

  it("renders Grep pattern in summary", () => {
    const { container } = render(
      <ToolCallCard
        toolCall={makeToolCall({
          tool: "Grep",
          input: { pattern: "TODO", path: "src/" },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Grep")).toBeInTheDocument();
    const summary = container.querySelector(".tool-card__summary");
    expect(summary?.textContent).toBe("TODO");
  });

  it("shows duration when available", () => {
    render(
      <ToolCallCard
        toolCall={makeToolCall({ duration: 1500 })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("1.5s")).toBeInTheDocument();
  });

  it("shows approve/deny buttons for pending generic tool calls", () => {
    render(
      <ToolCallCard
        toolCall={makeToolCall({ status: "pending" })}
        onToggleCollapse={vi.fn()}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
  });

  it("calls onApprove when approve button clicked", () => {
    const onApprove = vi.fn();
    render(
      <ToolCallCard
        toolCall={makeToolCall({ status: "pending", id: "toolu_abc" })}
        onToggleCollapse={vi.fn()}
        onApprove={onApprove}
      />,
    );
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("toolu_abc");
  });

  it("calls onDeny when deny button clicked", () => {
    const onDeny = vi.fn();
    render(
      <ToolCallCard
        toolCall={makeToolCall({ status: "pending", id: "toolu_abc" })}
        onToggleCollapse={vi.fn()}
        onDeny={onDeny}
      />,
    );
    fireEvent.click(screen.getByText("Deny"));
    expect(onDeny).toHaveBeenCalledWith("toolu_abc");
  });

  it("does not show approve/deny for completed generic tool calls", () => {
    render(
      <ToolCallCard
        toolCall={makeToolCall({ status: "done" })}
        onToggleCollapse={vi.fn()}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Deny")).not.toBeInTheDocument();
  });

  it("calls onToggleCollapse when header clicked", () => {
    const onToggle = vi.fn();
    render(
      <ToolCallCard
        toolCall={makeToolCall({ id: "toolu_xyz" })}
        onToggleCollapse={onToggle}
      />,
    );
    fireEvent.click(screen.getByText("Grep"));
    expect(onToggle).toHaveBeenCalledWith("toolu_xyz");
  });

  it("hides body when collapsed", () => {
    const { container } = render(
      <ToolCallCard
        toolCall={makeToolCall({ collapsed: true })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(container.querySelector(".tool-card--collapsed")).toBeTruthy();
  });

  it("shows tool output when available and not collapsed", () => {
    render(
      <ToolCallCard
        toolCall={makeToolCall({
          output: "3 matches found",
          collapsed: false,
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("3 matches found")).toBeInTheDocument();
  });

  // ── Dispatch tests (ensures specialized cards render) ──

  it("dispatches Read tool to ReadFileCard", () => {
    const { container } = render(
      <ToolCallCard
        toolCall={makeToolCall({
          tool: "Read",
          input: { file_path: "/src/main.rs" },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    // ReadFileCard uses .read-card class
    expect(container.querySelector(".read-card")).toBeTruthy();
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("dispatches Edit tool to EditDiffCard", () => {
    const { container } = render(
      <ToolCallCard
        toolCall={makeToolCall({
          tool: "Edit",
          input: {
            file_path: "src/auth.ts",
            old_string: "if (exp < now)",
            new_string: "if (exp <= now)",
          },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(container.querySelector(".edit-diff")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("dispatches Bash tool to BashOutputCard", () => {
    const { container } = render(
      <ToolCallCard
        toolCall={makeToolCall({
          tool: "Bash",
          input: { command: "npm test" },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(container.querySelector(".bash-card")).toBeTruthy();
    expect(screen.getByText("Bash")).toBeInTheDocument();
  });
});
