import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
  sshWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/tauri-claude", () => ({
  detectClaudeProject: vi.fn().mockResolvedValue({
    is_claude_project: false,
    claude_md_path: null,
  }),
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
    focus: vi.fn(),
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
  // Claude mode activated via paneMode="claude" (legacy/team path)
  const claudeProps = {
    paneId: "pane-1",
    paneMode: "claude",
    sessionId: null as string | null,
    isFocused: true,
    showCloseBtn: true,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSessionId: vi.fn(),
    onFocus: vi.fn(),
    onClose: vi.fn(),
    onModeChange: vi.fn(),
  };

  const localProps = {
    ...claudeProps,
    paneMode: "local",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mode selector pills in claude mode", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    expect(screen.getByText("Strict")).toBeDefined();
    expect(screen.getByText("Balanced")).toBeDefined();
    expect(screen.getByText("Builder")).toBeDefined();
    expect(screen.getByText("Audit")).toBeDefined();
  });

  it("shows Terminal exit button in claude mode", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    expect(screen.getByText("Terminal")).toBeDefined();
  });

  it("does not render mode pills in local mode", async () => {
    await act(async () => {
      render(<TerminalPane {...localProps} />);
    });
    expect(screen.queryByText("Strict")).toBeNull();
    expect(screen.queryByText("Balanced")).toBeNull();
  });

  it("renders Claude status bar label in claude mode", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    expect(screen.getByText("Claude Code")).toBeDefined();
  });

  it("shows BALANCED as default active mode", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    const balancedBtn = screen.getByText("Balanced");
    expect(balancedBtn.className).toContain("--active");
  });

  it("clicking a mode pill makes it active", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    const strictBtn = screen.getByText("Strict");
    await act(async () => {
      fireEvent.click(strictBtn);
    });
    expect(strictBtn.className).toContain("--active");
  });

  it("mode change updates the active pill and status bar", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    // Default is Balanced
    expect(screen.getByText("Balanced").className).toContain("--active");
    // Click Builder
    const builderBtn = screen.getByText("Builder");
    await act(async () => {
      fireEvent.click(builderBtn);
    });
    expect(builderBtn.className).toContain("--active");
    // Balanced should no longer be active
    expect(screen.getByText("Balanced").className).not.toContain("--active");
    // Status bar shows BUILDER
    expect(screen.getByText("BUILDER")).toBeDefined();
  });

  it("renders model picker with default model", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    expect(screen.getByText("Sonnet 4.6")).toBeDefined();
  });

  it("renders resume buttons", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} />);
    });
    expect(screen.getByText("Continue")).toBeDefined();
    expect(screen.getByText("Resume")).toBeDefined();
  });

  it("does not render quick actions without sessionId", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} sessionId={null} />);
    });
    expect(screen.queryByText("/compact")).toBeNull();
  });

  it("renders quick actions with sessionId", async () => {
    await act(async () => {
      render(<TerminalPane {...claudeProps} sessionId="test-session-123" />);
    });
    expect(screen.getByText("/compact")).toBeDefined();
    expect(screen.getByText("/cost")).toBeDefined();
    expect(screen.getByText("/clear")).toBeDefined();
    expect(screen.getByText("/model")).toBeDefined();
  });

  it("shows Claude toggle button on local pane with session", async () => {
    await act(async () => {
      render(<TerminalPane {...localProps} sessionId="test-session" />);
    });
    // Should show Claude button on local pane
    expect(screen.getByText("Claude")).toBeDefined();
  });

  it("shows Claude toggle button on SSH pane with session", async () => {
    await act(async () => {
      render(
        <TerminalPane
          {...localProps}
          paneMode="ssh"
          paneHostId="user@host"
          sessionId="ssh-session"
        />,
      );
    });
    // Should show Claude button on SSH pane
    expect(screen.getByText("Claude")).toBeDefined();
  });

  it("does not show Claude toggle without sessionId", async () => {
    await act(async () => {
      render(<TerminalPane {...localProps} sessionId={null} />);
    });
    // No Claude button without a session
    expect(screen.queryByTitle("Start Claude Code (Ctrl+Shift+K)")).toBeNull();
  });

  it("shows team role badge when teamRole is set", async () => {
    await act(async () => {
      render(
        <TerminalPane
          {...claudeProps}
          teamRole={{ name: "Architect", color: "#f97316", isLead: true }}
        />,
      );
    });
    expect(screen.getByText("Architect")).toBeDefined();
    expect(screen.getByText("LEAD")).toBeDefined();
  });

  it("exposes toggle via claudeToggleRef", async () => {
    const toggleRef = { current: null as (() => void) | null };
    await act(async () => {
      render(
        <TerminalPane {...localProps} sessionId="test-session" claudeToggleRef={toggleRef} />,
      );
    });
    // After mount, the ref should be populated
    expect(toggleRef.current).toBeInstanceOf(Function);
  });
});
