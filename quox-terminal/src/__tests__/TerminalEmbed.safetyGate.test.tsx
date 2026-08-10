/**
 * TerminalEmbed.safetyGate.test.tsx
 *
 * Regression test for the interactive-typing safety gate: typed commands
 * must be validated against the same validate_command Tauri command the
 * AI-proposed-command flow uses, BEFORE Enter is forwarded to the pty.
 *
 * Drives the component through its real term.onData handler (captured from
 * the mocked xterm.js Terminal) to simulate a user typing a full line and
 * pressing Enter, then asserts on the mocked ptyWrite/invoke calls -- the
 * same technique already used in ClaudeNativeMode.test.tsx for this app.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

// Polyfill ResizeObserver for jsdom
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const mockPtyWrite = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/tauri-pty", () => ({
  ptySpawn: vi.fn().mockResolvedValue("mock-pty-session"),
  ptyWrite: (...args: unknown[]) => mockPtyWrite(...args),
  ptyResize: vi.fn().mockResolvedValue(undefined),
  ptySessionExists: vi.fn().mockResolvedValue(false),
  getTerminalOutput: vi.fn().mockResolvedValue(""),
  onPtyOutput: vi.fn().mockResolvedValue(() => {}),
  onPtyExit: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../services/terminalMemoryBridge", () => ({
  trackSessionStart: vi.fn().mockResolvedValue(undefined),
  trackSessionEnd: vi.fn().mockResolvedValue(undefined),
}));

// Capture the onData handler xterm.js would normally call per keystroke.
let capturedOnData: ((data: string) => void) | null = null;

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn().mockImplementation((cb: (data: string) => void) => {
      capturedOnData = cb;
      return { dispose: vi.fn() };
    }),
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

import TerminalEmbed from "../components/terminal/TerminalEmbed";

/** Feed a raw command string through the captured onData handler one
 *  character at a time, mirroring how xterm.js delivers real keystrokes. */
async function typeLine(line: string) {
  for (const ch of line) {
    await act(async () => {
      capturedOnData?.(ch);
      await Promise.resolve();
    });
  }
}

async function pressEnter() {
  await act(async () => {
    capturedOnData?.("\r");
    // Let the async validate_command round-trip settle.
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Feed one raw chunk through the captured onData handler exactly as
 *  xterm.js would deliver it (e.g. an entire bracketed-paste sequence
 *  arriving as a single onData call, or split across two calls for a
 *  large paste). */
async function sendChunk(chunk: string) {
  await act(async () => {
    capturedOnData?.(chunk);
    // Let the async validate_command round-trip settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TerminalEmbed safety gate (typed-command validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnData = null;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command") {
        return Promise.resolve({
          action: "ALLOW",
          severity: "GREEN",
          description: null,
          pattern: null,
          blocked: false,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it("forwards a safe command's newline to the pty", async () => {
    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await typeLine("ls -la");
    await pressEnter();

    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "ls -la" });
    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\r");
  });

  it("blocks a RED command and withholds the newline from the pty", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command" && args?.command === "rm -rf /") {
        return Promise.resolve({
          action: "BLOCK",
          severity: "RED",
          description: "Recursive delete from root or home",
          pattern: null,
          blocked: true,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await typeLine("rm -rf /");
    await pressEnter();

    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "rm -rf /" });
    // Every typed character is forwarded (so the user sees what they typed
    // and can edit it), but the newline that would execute it must not be.
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\n");

    expect(await screen.findByText(/Blocked:/)).toBeDefined();

    // Pressing Enter again on the unchanged line must not bypass the block.
    mockPtyWrite.mockClear();
    await pressEnter();
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");
  });

  it("requires a second Enter for a WARN command", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command" && args?.command === "docker stop mycontainer") {
        return Promise.resolve({
          action: "WARN",
          severity: "AMBER",
          description: "Docker container stop",
          pattern: null,
          blocked: false,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await typeLine("docker stop mycontainer");
    await pressEnter();

    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");
    expect(await screen.findByText(/Warning:/)).toBeDefined();

    // Second Enter on the same, unedited line should run it without
    // re-invoking validate_command.
    mockInvoke.mockClear();
    await pressEnter();

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "validate_command",
      expect.anything(),
    );
    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\r");
  });

  it("shows the confirm modal for REQUIRE_OVERRIDE and only sends the newline on confirm", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command" && args?.command === "qm destroy 100") {
        return Promise.resolve({
          action: "REQUIRE_OVERRIDE",
          severity: "RED",
          description: "VM destruction command",
          pattern: null,
          blocked: false,
          requires_auth: true,
        });
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await typeLine("qm destroy 100");
    await pressEnter();

    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");

    const confirmBtn = await screen.findByText("Override & Run");
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\r");
  });
});

describe("TerminalEmbed safety gate (bracketed paste)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnData = null;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command") {
        return Promise.resolve({
          action: "ALLOW",
          severity: "GREEN",
          description: null,
          pattern: null,
          blocked: false,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  /** Every fixed-code ptyWrite call to the pty either withholds a gated
   *  newline (a bare "\r"/"\n") or is buffered text that never itself
   *  contains an embedded "\r"/"\n". The pre-fix bug forwarded a single
   *  combined write containing both the pasted command text AND its
   *  executing newline in one un-gated call -- this asserts that shape
   *  never occurs. */
  function assertNoUngatedNewlineWrite() {
    for (const call of mockPtyWrite.mock.calls) {
      const written = call[1] as string;
      if (written === "\r" || written === "\n") continue; // gated newline, fine
      expect(written).not.toMatch(/[\r\n]/);
    }
  }

  it("gates a bracketed-paste of a BLOCK-tier command delivered in one chunk", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command" && args?.command === "rm -rf /") {
        return Promise.resolve({
          action: "BLOCK",
          severity: "RED",
          description: "Recursive delete from root or home",
          pattern: null,
          blocked: true,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    // Bracketed paste of a dangerous command with an embedded trailing
    // Enter, delivered as xterm.js would deliver it: one onData chunk.
    await sendChunk("\x1b[200~rm -rf /\x1b[201~\r");

    // The gate must actually have fired on the pasted content -- if this
    // fails, the paste bypassed gateLine() entirely (the pre-fix bug).
    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "rm -rf /" });

    // The executing newline must never reach the pty.
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\n");

    // No single write may combine the dangerous text with its execute byte.
    assertNoUngatedNewlineWrite();

    // The raw wrapped chunk (markers + text + newline) must never be
    // forwarded verbatim -- that is exactly the pre-fix vulnerable write.
    expect(mockPtyWrite).not.toHaveBeenCalledWith(
      "mock-pty-session",
      "\x1b[200~rm -rf /\x1b[201~\r",
    );

    expect(await screen.findByText(/Blocked:/)).toBeDefined();
  });

  it("gates a bracketed-paste of a BLOCK-tier command split across two onData chunks", async () => {
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "pty_spawn") return Promise.resolve("mock-pty-session");
      if (cmd === "validate_command" && args?.command === "rm -rf /") {
        return Promise.resolve({
          action: "BLOCK",
          severity: "RED",
          description: "Recursive delete from root or home",
          pattern: null,
          blocked: true,
          requires_auth: false,
        });
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    // A large paste can straddle onData chunks: paste-start + content in
    // one chunk, paste-end + Enter in a second, later chunk.
    await sendChunk("\x1b[200~rm -rf /");
    await sendChunk("\x1b[201~\r");

    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "rm -rf /" });
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\r");
    expect(mockPtyWrite).not.toHaveBeenCalledWith("mock-pty-session", "\n");
    assertNoUngatedNewlineWrite();

    expect(await screen.findByText(/Blocked:/)).toBeDefined();
  });

  it("still runs a safe pasted command (ALLOW) once gated", async () => {
    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await sendChunk("\x1b[200~ls -la\x1b[201~\r");

    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "ls -la" });
    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\r");
  });

  it("still forwards a genuine (non-paste) escape sequence raw, e.g. arrow-key history recall", async () => {
    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await sendChunk("\x1b[A");

    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\x1b[A");
    expect(mockInvoke).not.toHaveBeenCalledWith("validate_command", expect.anything());
  });

  it("still forwards normal typed characters immediately", async () => {
    await act(async () => {
      render(<TerminalEmbed />);
    });
    await waitFor(() => expect(capturedOnData).not.toBeNull());

    await typeLine("ls -la");
    await pressEnter();

    expect(mockInvoke).toHaveBeenCalledWith("validate_command", { command: "ls -la" });
    expect(mockPtyWrite).toHaveBeenCalledWith("mock-pty-session", "\r");
  });
});
