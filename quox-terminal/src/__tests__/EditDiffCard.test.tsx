import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EditDiffCard from "../components/claude/EditDiffCard";
import type { ToolCall } from "../services/claudeOutputParser";

function makeEditToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "toolu_edit_1",
    tool: "Edit",
    input: {
      file_path: "src/auth.ts",
      old_string: "if (exp < now) {",
      new_string: "if (exp <= now) {",
    },
    status: "done",
    collapsed: false,
    ...overrides,
  };
}

describe("EditDiffCard", () => {
  it("renders file path in header", () => {
    const { container } = render(
      <EditDiffCard
        toolCall={makeEditToolCall()}
        onToggleCollapse={vi.fn()}
      />,
    );
    const path = container.querySelector(".edit-diff__path");
    expect(path?.textContent).toBe("src/auth.ts");
  });

  it("renders Edit label", () => {
    render(
      <EditDiffCard
        toolCall={makeEditToolCall()}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("shows removed and added lines", () => {
    const { container } = render(
      <EditDiffCard
        toolCall={makeEditToolCall()}
        onToggleCollapse={vi.fn()}
      />,
    );
    const removedLines = container.querySelectorAll(
      ".edit-diff__line--removed",
    );
    const addedLines = container.querySelectorAll(
      ".edit-diff__line--added",
    );
    expect(removedLines.length).toBeGreaterThan(0);
    expect(addedLines.length).toBeGreaterThan(0);
  });

  it("shows diff stats (+N -N)", () => {
    const { container } = render(
      <EditDiffCard
        toolCall={makeEditToolCall()}
        onToggleCollapse={vi.fn()}
      />,
    );
    const addStat = container.querySelector(".edit-diff__stat--add");
    const removeStat = container.querySelector(
      ".edit-diff__stat--remove",
    );
    expect(addStat).toBeTruthy();
    expect(removeStat).toBeTruthy();
  });

  it("shows approve/deny buttons when pending", () => {
    render(
      <EditDiffCard
        toolCall={makeEditToolCall({ status: "pending" })}
        onToggleCollapse={vi.fn()}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
  });

  it("calls onApprove when approve clicked", () => {
    const onApprove = vi.fn();
    render(
      <EditDiffCard
        toolCall={makeEditToolCall({
          status: "pending",
          id: "toolu_xyz",
        })}
        onToggleCollapse={vi.fn()}
        onApprove={onApprove}
      />,
    );
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("toolu_xyz");
  });

  it("does not show approve/deny when done", () => {
    render(
      <EditDiffCard
        toolCall={makeEditToolCall({ status: "done" })}
        onToggleCollapse={vi.fn()}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Deny")).not.toBeInTheDocument();
  });

  it("hides body when collapsed", () => {
    const { container } = render(
      <EditDiffCard
        toolCall={makeEditToolCall({ collapsed: true })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(
      container.querySelector(".edit-diff--collapsed"),
    ).toBeTruthy();
  });

  it("calls onToggleCollapse when header clicked", () => {
    const onToggle = vi.fn();
    render(
      <EditDiffCard
        toolCall={makeEditToolCall({ id: "toolu_abc" })}
        onToggleCollapse={onToggle}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onToggle).toHaveBeenCalledWith("toolu_abc");
  });

  it("shows replace_all badge when set", () => {
    render(
      <EditDiffCard
        toolCall={makeEditToolCall({
          input: {
            file_path: "src/main.ts",
            old_string: "foo",
            new_string: "bar",
            replace_all: true,
          },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText("replace all")).toBeInTheDocument();
  });

  it("handles multi-line diffs", () => {
    const { container } = render(
      <EditDiffCard
        toolCall={makeEditToolCall({
          input: {
            file_path: "src/config.ts",
            old_string: "const a = 1;\nconst b = 2;\nconst c = 3;",
            new_string:
              "const a = 1;\nconst b = 20;\nconst c = 30;\nconst d = 4;",
          },
        })}
        onToggleCollapse={vi.fn()}
      />,
    );
    const allLines = container.querySelectorAll(".edit-diff__line");
    expect(allLines.length).toBeGreaterThan(0);
  });
});
