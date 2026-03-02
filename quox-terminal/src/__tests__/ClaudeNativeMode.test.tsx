import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Polyfill ResizeObserver for test environment
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Tauri IPC
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("mock-session-id"),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/mock/home"),
}));

vi.mock("../../lib/tauri-pty", () => ({
  ptySpawn: vi.fn().mockResolvedValue("mock-pty-session"),
  ptyWrite: vi.fn().mockResolvedValue(undefined),
  ptyResize: vi.fn().mockResolvedValue(undefined),
  ptySessionExists: vi.fn().mockResolvedValue(false),
  getTerminalOutput: vi.fn().mockResolvedValue(""),
  onPtyOutput: vi.fn().mockResolvedValue(() => {}),
  onPtyExit: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../lib/tauri-ssh", () => ({
  sshConnect: vi.fn(),
  sshDisconnect: vi.fn(),
}));

vi.mock("../../lib/tauri-claude", () => ({
  detectClaudeProject: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../lib/store", () => ({
  storeGet: vi.fn().mockResolvedValue(null),
  storeSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/localMemoryStore", () => ({
  getSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../services/terminalMemoryBridge", () => ({
  trackSessionStart: vi.fn().mockResolvedValue(undefined),
  trackSessionEnd: vi.fn().mockResolvedValue(undefined),
}));

// Minimal xterm.js mock
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onKey: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onResize: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    attachCustomKeyEventHandler: vi.fn(),
    dispose: vi.fn(),
    options: {},
    cols: 80,
    rows: 24,
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

import TerminalPane from "../components/terminal/TerminalPane";

describe("Claude Native Mode", () => {
  const defaultProps = {
    paneId: "pane-1",
    paneMode: "claude",
    sessionId: null,
    isFocused: true,
    showCloseBtn: true,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSessionId: vi.fn(),
    onFocus: vi.fn(),
    onClose: vi.fn(),
    onModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mode selector pills in claude mode", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Strict")).toBeDefined();
    expect(screen.getByText("Balanced")).toBeDefined();
    expect(screen.getByText("Builder")).toBeDefined();
    expect(screen.getByText("Audit")).toBeDefined();
  });

  it("renders view toggle button in claude mode", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Structured")).toBeDefined();
  });

  it("shows Terminal exit button in claude mode", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Terminal")).toBeDefined();
  });

  it("does not render mode pills in local mode", () => {
    render(<TerminalPane {...defaultProps} paneMode="local" />);
    expect(screen.queryByText("Strict")).toBeNull();
    expect(screen.queryByText("Balanced")).toBeNull();
  });

  it("switches view toggle text when clicked", () => {
    render(<TerminalPane {...defaultProps} />);
    const toggleBtn = screen.getByText("Structured");
    fireEvent.click(toggleBtn);
    // After clicking, it should show "Native" (the other view option)
    expect(screen.getByText("Native")).toBeDefined();
  });

  it("renders Claude status bar label in native mode", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Claude Code")).toBeDefined();
  });

  it("shows BALANCED as default active mode", () => {
    render(<TerminalPane {...defaultProps} />);
    const balancedBtn = screen.getByText("Balanced");
    expect(balancedBtn.className).toContain("--active");
  });

  it("clicking a mode pill makes it active", () => {
    render(<TerminalPane {...defaultProps} />);
    const strictBtn = screen.getByText("Strict");
    fireEvent.click(strictBtn);
    expect(strictBtn.className).toContain("--active");
  });

  it("mode change updates the active pill and status bar", () => {
    render(<TerminalPane {...defaultProps} />);
    // Default is Balanced
    expect(screen.getByText("Balanced").className).toContain("--active");
    // Click Builder
    const builderBtn = screen.getByText("Builder");
    fireEvent.click(builderBtn);
    expect(builderBtn.className).toContain("--active");
    // Balanced should no longer be active
    expect(screen.getByText("Balanced").className).not.toContain("--active");
    // Status bar shows BUILDER
    expect(screen.getByText("BUILDER")).toBeDefined();
  });

  it("view toggle renders correct component label", () => {
    render(<TerminalPane {...defaultProps} />);
    // In native mode, toggle says "Structured"
    expect(screen.getByText("Structured")).toBeDefined();
    // Click to switch to structured
    fireEvent.click(screen.getByText("Structured"));
    // Now it should say "Native"
    expect(screen.getByText("Native")).toBeDefined();
    // Click back
    fireEvent.click(screen.getByText("Native"));
    expect(screen.getByText("Structured")).toBeDefined();
  });

  it("renders model picker with default model", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Sonnet 4.6")).toBeDefined();
  });

  it("renders resume buttons", () => {
    render(<TerminalPane {...defaultProps} />);
    expect(screen.getByText("Continue")).toBeDefined();
    expect(screen.getByText("Resume")).toBeDefined();
  });

  it("does not render quick actions without sessionId", () => {
    render(<TerminalPane {...defaultProps} sessionId={null} />);
    expect(screen.queryByText("/compact")).toBeNull();
  });

  it("renders quick actions with sessionId", () => {
    render(<TerminalPane {...defaultProps} sessionId="test-session-123" />);
    expect(screen.getByText("/compact")).toBeDefined();
    expect(screen.getByText("/cost")).toBeDefined();
    expect(screen.getByText("/clear")).toBeDefined();
    expect(screen.getByText("/model")).toBeDefined();
  });
});
