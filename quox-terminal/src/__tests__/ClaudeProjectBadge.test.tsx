import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import ClaudeProjectBadge from "../components/claude/ClaudeProjectBadge";

describe("ClaudeProjectBadge", () => {
  it("renders nothing when no project detected", () => {
    const { container } = render(
      <ClaudeProjectBadge hasClaudeMd={false} hasClaudeDir={false} />,
    );
    expect(container.querySelector(".claude-project-badge")).toBeNull();
  });

  it("renders badge when CLAUDE.md detected", () => {
    const { container } = render(
      <ClaudeProjectBadge hasClaudeMd={true} hasClaudeDir={false} />,
    );
    expect(
      container.querySelector(".claude-project-badge"),
    ).toBeTruthy();
  });

  it("renders badge when .claude/ detected", () => {
    const { container } = render(
      <ClaudeProjectBadge hasClaudeMd={false} hasClaudeDir={true} />,
    );
    expect(
      container.querySelector(".claude-project-badge"),
    ).toBeTruthy();
  });

  it("renders badge when both detected", () => {
    const { container } = render(
      <ClaudeProjectBadge hasClaudeMd={true} hasClaudeDir={true} />,
    );
    const badge = container.querySelector(".claude-project-badge");
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute("title")).toContain("CLAUDE.md");
    expect(badge?.getAttribute("title")).toContain(".claude/");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ClaudeProjectBadge
        hasClaudeMd={true}
        hasClaudeDir={false}
        onClick={onClick}
      />,
    );
    const badge = container.querySelector(".claude-project-badge");
    if (badge) fireEvent.click(badge);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
