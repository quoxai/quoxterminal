import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClaudePaneEmbed from "../components/claude/ClaudePaneEmbed";

// Mock Tauri dependencies
vi.mock("../lib/tauri-claude", () => ({
  claudeSpawn: vi.fn(() => Promise.resolve("session-1")),
  claudeWrite: vi.fn(() => Promise.resolve()),
  claudeKill: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("../lib/store", () => ({
  storeGet: vi.fn(() => Promise.resolve(null)),
  storeSet: vi.fn(() => Promise.resolve()),
}));

describe("Claude Mode Selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four mode buttons", () => {
    render(<ClaudePaneEmbed paneId="pane-1" />);
    expect(screen.getByText("Strict")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Builder")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
  });

  it("defaults to Balanced mode as active", () => {
    render(<ClaudePaneEmbed paneId="pane-1" />);
    const balanced = screen.getByText("Balanced");
    expect(balanced.className).toContain("--active");
  });

  it("switches active mode on click", () => {
    render(<ClaudePaneEmbed paneId="pane-1" />);
    const strict = screen.getByText("Strict");
    fireEvent.click(strict);
    expect(strict.className).toContain("--active");
    // Balanced should no longer be active
    const balanced = screen.getByText("Balanced");
    expect(balanced.className).not.toContain("--active");
  });

  it("persists mode selection to store", async () => {
    const { storeSet } = await import("../lib/store");
    render(<ClaudePaneEmbed paneId="pane-42" />);
    fireEvent.click(screen.getByText("Audit"));
    expect(storeSet).toHaveBeenCalledWith(
      "quox-terminal-mode-pane-42",
      "audit",
    );
  });

  it("shows mode description as tooltip", () => {
    render(<ClaudePaneEmbed paneId="pane-1" />);
    const audit = screen.getByText("Audit");
    expect(audit.getAttribute("title")).toBe("Read-only diagnosis mode");
  });
});
