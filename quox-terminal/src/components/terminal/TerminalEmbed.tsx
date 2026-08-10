/**
 * TerminalEmbed — Rebuilt xterm.js terminal component for Tauri Desktop
 *
 * Replaces WebSocket communication with Tauri IPC to the Rust PTY backend.
 * Spawns a local PTY via invoke('pty_spawn'), streams output via Tauri events,
 * writes input via invoke('pty_write'), and resizes via invoke('pty_resize').
 *
 * Props:
 *   shell?       — Shell to spawn (defaults to system detection)
 *   cwd?         — Working directory (defaults to $HOME)
 *   onConnect    — Callback when terminal connects
 *   onDisconnect — Callback when terminal disconnects
 *   onSessionId  — Callback when session ID is assigned
 *   onData       — Callback for terminal output data
 *   customKeyHandler — Custom keyboard handler
 *   clearRef     — Ref for clear() function
 *   reconnectRef — Ref for reconnect() function
 *   scrollRef    — Ref for scroll API (vim mode)
 *   visible      — Whether this terminal is currently visible
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./TerminalEmbed.css";
import { TERMINAL_LIMITS } from "../../config/terminalConfig";
import {
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptySessionExists,
  getTerminalOutput,
  onPtyOutput,
  onPtyExit,
} from "../../lib/tauri-pty";
import { trackSessionStart, trackSessionEnd } from "../../services/terminalMemoryBridge";
import { useCommandSafety, type ValidationResult } from "../../hooks/useCommandSafety";
import TerminalExecConfirmModal from "./TerminalExecConfirmModal";
import type { UnlistenFn } from "@tauri-apps/api/event";

export const TERM_THEME = {
  background: "#0a0e14",
  foreground: "#b3b1ad",
  cursor: "#38bdf8",
  cursorAccent: "#0a0e14",
  selectionBackground: "#1a1f29",
  selectionForeground: "#e6e1cf",
  black: "#01060e",
  red: "#ea6c73",
  green: "#91b362",
  yellow: "#f9af4f",
  blue: "#53bdfa",
  magenta: "#fae994",
  cyan: "#90e1c6",
  white: "#c7c7c7",
  brightBlack: "#686868",
  brightRed: "#f07178",
  brightGreen: "#c2d94c",
  brightYellow: "#ffb454",
  brightBlue: "#59c2ff",
  brightMagenta: "#ffee99",
  brightCyan: "#95e6cb",
  brightWhite: "#ffffff",
};

type TerminalStatus = "connecting" | "connected" | "disconnected" | "error";

interface ScrollRef {
  scrollLines: (n: number) => void;
  scrollPages: (n: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

interface TerminalEmbedProps {
  shell?: string;
  shellArgs?: string[];
  cwd?: string;
  env?: Record<string, string>;
  sessionId?: string | null;
  onConnect?: () => void;
  onDisconnect?: (code?: number) => void;
  onSessionId?: (sessionId: string | null) => void;
  onData?: (data: string) => void;
  customKeyHandler?: (event: KeyboardEvent) => boolean;
  clearRef?: React.MutableRefObject<(() => void) | null>;
  reconnectRef?: React.MutableRefObject<(() => void) | null>;
  scrollRef?: React.MutableRefObject<ScrollRef | null>;
  fontSize?: number;
  className?: string;
  visible?: boolean;
}

export default function TerminalEmbed({
  shell,
  shellArgs,
  cwd,
  env,
  sessionId: sessionIdProp,
  onConnect,
  onDisconnect,
  onSessionId,
  onData,
  customKeyHandler,
  clearRef,
  reconnectRef,
  scrollRef,
  fontSize = 14,
  className = "",
  visible = true,
}: TerminalEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const termDataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const termResizeListenerRef = useRef<{ dispose: () => void } | null>(null);

  // ── Command safety (typed input path) ──────────────────────────────
  // Best-effort tracking of the line currently being typed at the shell
  // prompt, so it can be validated against the safety denylist (the same
  // validate_command Tauri command the AI-proposed-command flow uses) before
  // Enter is forwarded to the pty. This cannot see real readline state
  // (history recall, cursor movement) -- it tracks plain typing + backspace
  // + Ctrl-C/Ctrl-U resets, which covers normal interactive use.
  const lineBufferRef = useRef<string>("");
  const warnConfirmedLineRef = useRef<string | null>(null);
  const inputQueueRef = useRef<Promise<void>>(Promise.resolve());
  const { validateCommand } = useCommandSafety();
  const [safetyBanner, setSafetyBanner] = useState<
    | null
    | { kind: "blocked" | "warn"; command: string; description: string }
  >(null);
  const [safetyModal, setSafetyModal] = useState<
    | null
    | {
        command: string;
        validation: { action?: string; severity?: string; description?: string };
        sid: string;
        newline: string;
      }
  >(null);
  const safetyBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store callbacks in refs to avoid re-render loops
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onSessionIdRef = useRef(onSessionId);
  const onDataRef = useRef(onData);
  const customKeyHandlerRef = useRef(customKeyHandler);
  const [status, setStatus] = useState<TerminalStatus>("disconnected");

  // Keep refs current
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onSessionIdRef.current = onSessionId;
  onDataRef.current = onData;
  customKeyHandlerRef.current = customKeyHandler;

  /** Show the blocked/warn banner for a limited time, then auto-hide it.
   *  (The underlying gate itself is not time-limited -- re-pressing Enter
   *  on an unchanged blocked line re-shows it.) */
  const showSafetyBanner = useCallback(
    (kind: "blocked" | "warn", command: string, description: string) => {
      if (safetyBannerTimerRef.current) clearTimeout(safetyBannerTimerRef.current);
      setSafetyBanner({ kind, command, description });
      safetyBannerTimerRef.current = setTimeout(() => {
        setSafetyBanner(null);
      }, kind === "blocked" ? 6000 : 4000);
    },
    [],
  );

  /** Validate a completed line before it is allowed to reach the pty as a
   *  command. Returns true if the withheld newline should now be sent. */
  const gateLine = useCallback(
    async (sid: string, rawLine: string, newline: string): Promise<boolean> => {
      const command = rawLine.trim();
      if (!command) return true;

      // Second Enter press on an unchanged WARN line -- run it now.
      if (warnConfirmedLineRef.current === command) {
        warnConfirmedLineRef.current = null;
        return true;
      }

      let result: ValidationResult;
      try {
        result = await validateCommand(command);
      } catch (err) {
        // Fail open on a validator error -- don't hang the terminal on a
        // backend fault. This mirrors how a validation-layer outage should
        // not itself become a denial-of-service on the terminal.
        console.error("[TerminalEmbed] validate_command failed:", err);
        return true;
      }

      if (result.action === "BLOCK") {
        warnConfirmedLineRef.current = null;
        showSafetyBanner("blocked", command, result.description || "This command is blocked by the safety policy.");
        return false;
      }

      if (result.action === "REQUIRE_APPROVAL" || result.action === "REQUIRE_OVERRIDE") {
        warnConfirmedLineRef.current = null;
        setSafetyModal({
          command,
          validation: {
            action: result.action,
            severity: result.severity,
            description: result.description ?? undefined,
          },
          sid,
          newline,
        });
        return false;
      }

      if (result.action === "WARN") {
        warnConfirmedLineRef.current = command;
        showSafetyBanner("warn", command, result.description || "This command may be risky. Press Enter again to run it.");
        return false;
      }

      return true; // ALLOW
    },
    [validateCommand, showSafetyBanner],
  );

  /** Process one onData chunk: forward benign input immediately, but hold
   *  back Enter/newline on a completed line until gateLine() clears it. */
  const forwardGated = useCallback(
    async (sid: string, chunk: string) => {
      let segment = "";

      const flush = async () => {
        if (!segment) return;
        const toSend = segment;
        segment = "";
        try {
          await ptyWrite(sid, toSend);
        } catch (err) {
          console.error("PTY write failed:", err);
          setStatus("error");
        }
      };

      for (let idx = 0; idx < chunk.length; idx++) {
        const ch = chunk[idx];

        if (ch === "\x1b") {
          // Escape sequence (arrow keys, history recall, etc). Best-effort
          // only: we don't track cursor movement against the line buffer,
          // so just forward the rest of this chunk untouched.
          segment += chunk.slice(idx);
          idx = chunk.length;
          break;
        }

        if (ch === "\r" || ch === "\n") {
          await flush();
          const allowed = await gateLine(sid, lineBufferRef.current, ch);
          if (allowed) {
            try {
              await ptyWrite(sid, ch);
            } catch (err) {
              console.error("PTY write failed:", err);
              setStatus("error");
            }
            lineBufferRef.current = "";
            warnConfirmedLineRef.current = null;
          }
          continue;
        }

        if (ch === "\x7f" || ch === "\b") {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          warnConfirmedLineRef.current = null;
          setSafetyBanner(null);
          segment += ch;
          continue;
        }

        if (ch === "\x03" || ch === "\x15") {
          // Ctrl-C / Ctrl-U -- reset tracked line
          lineBufferRef.current = "";
          warnConfirmedLineRef.current = null;
          setSafetyBanner(null);
          segment += ch;
          continue;
        }

        lineBufferRef.current += ch;
        warnConfirmedLineRef.current = null;
        setSafetyBanner(null);
        segment += ch;
      }

      await flush();
    },
    [gateLine],
  );

  /** Confirm a REQUIRE_APPROVAL/REQUIRE_OVERRIDE command from the modal --
   *  sends only the withheld newline; the command text is already on-screen
   *  since every typed character up to Enter was forwarded as it was typed. */
  const handleSafetyModalConfirm = useCallback(() => {
    const pending = safetyModal;
    setSafetyModal(null);
    if (!pending) return;
    ptyWrite(pending.sid, pending.newline)
      .then(() => {
        lineBufferRef.current = "";
        warnConfirmedLineRef.current = null;
      })
      .catch((err) => {
        console.error("PTY write failed:", err);
        setStatus("error");
      });
  }, [safetyModal]);

  const handleSafetyModalClose = useCallback(() => {
    // Cancel -- leave the line on the prompt so the user can edit/clear it.
    setSafetyModal(null);
  }, []);

  /** Detach PTY event listeners */
  const detachPty = useCallback(() => {
    if (unlistenOutputRef.current) {
      unlistenOutputRef.current();
      unlistenOutputRef.current = null;
    }
    if (unlistenExitRef.current) {
      unlistenExitRef.current();
      unlistenExitRef.current = null;
    }
    if (termDataListenerRef.current) {
      termDataListenerRef.current.dispose();
      termDataListenerRef.current = null;
    }
    if (termResizeListenerRef.current) {
      termResizeListenerRef.current.dispose();
      termResizeListenerRef.current = null;
    }
  }, []);

  /** Full cleanup — terminal + observers. Does NOT kill the PTY session;
   *  PTY lifecycle is managed by the parent (TerminalView). */
  const cleanup = useCallback(() => {
    detachPty();
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitAddonRef.current = null;
    sessionIdRef.current = null;
    if (safetyBannerTimerRef.current) {
      clearTimeout(safetyBannerTimerRef.current);
      safetyBannerTimerRef.current = null;
    }
    lineBufferRef.current = "";
    warnConfirmedLineRef.current = null;
  }, [detachPty]);

  /** Connect to a PTY session and wire up events.
   *  If existingSessionId is provided and the session is still alive,
   *  reconnects to it instead of spawning a new one. */
  const connectPty = useCallback(
    async (term: Terminal, existingSessionId?: string | null) => {
      detachPty();
      setStatus("connecting");

      try {
        let sid: string;
        let isReconnect = false;

        // Try to reconnect to an existing session
        if (existingSessionId) {
          const alive = await ptySessionExists(existingSessionId);
          if (alive) {
            sid = existingSessionId;
            isReconnect = true;
          } else {
            // Session died while we were away, spawn fresh
            sid = await ptySpawn(shell, cwd, env, shellArgs);
          }
        } else {
          sid = await ptySpawn(shell, cwd, env, shellArgs);
        }

        sessionIdRef.current = sid;
        if (onSessionIdRef.current) onSessionIdRef.current(sid);

        // On reconnect, restore recent output from the ring buffer
        if (isReconnect) {
          try {
            const recentOutput = await getTerminalOutput(sid, 8192);
            if (recentOutput) {
              term.write(recentOutput);
            }
          } catch (_) {
            // Non-fatal: ring buffer read failed, continue anyway
          }
        }

        // Listen for PTY output → write to xterm
        const unlistenOutput = await onPtyOutput(sid, (data) => {
          term.write(data);
          if (onDataRef.current) onDataRef.current(data);
        });
        unlistenOutputRef.current = unlistenOutput;

        // Listen for PTY exit
        const unlistenExit = await onPtyExit(sid, (code) => {
          term.write(
            `\r\n\x1b[33m[Session ended (exit code ${code})]\x1b[0m\r\n`,
          );
          setStatus("disconnected");
          trackSessionEnd(sid).catch(() => {});
          sessionIdRef.current = null;
          if (onDisconnectRef.current) onDisconnectRef.current(code);
        });
        unlistenExitRef.current = unlistenExit;

        // Wire terminal input → PTY stdin, gated by the safety validator.
        // Reset tracked line state for the (re)connected session.
        lineBufferRef.current = "";
        warnConfirmedLineRef.current = null;
        setSafetyBanner(null);
        setSafetyModal(null);
        inputQueueRef.current = Promise.resolve();
        termDataListenerRef.current = term.onData((data) => {
          // Chain onto the queue so overlapping keystrokes (which each
          // trigger an async validate_command round-trip on Enter) are
          // processed strictly in the order they were typed.
          inputQueueRef.current = inputQueueRef.current.then(() =>
            forwardGated(sid, data),
          );
        });

        // Wire terminal resize → PTY resize
        termResizeListenerRef.current = term.onResize(({ cols, rows }) => {
          ptyResize(sid, cols, rows).catch((err) => {
            console.error("PTY resize failed:", err);
          });
        });

        // Send initial resize
        const { cols, rows } = term;
        await ptyResize(sid, cols, rows);

        setStatus("connected");
        term.focus();
        if (onConnectRef.current) onConnectRef.current();

        // Track session in memory bridge
        trackSessionStart(null, sid, 'local').catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        term.write(`\r\n\x1b[31m[Failed to spawn shell: ${message}]\x1b[0m\r\n`);
        setStatus("error");
      }
    },
    [shell, shellArgs, cwd, env, detachPty, forwardGated],
  );

  // Create terminal + initial connection
  useEffect(() => {
    if (!containerRef.current) return;

    cleanup();

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: TERM_THEME,
      allowProposedApi: true,
      scrollback: TERMINAL_LIMITS.MAX_SCROLLBACK,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    // Attach custom key handler
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (customKeyHandlerRef.current) {
        return customKeyHandlerRef.current(event);
      }
      return true;
    });

    // Expose clear via ref
    if (clearRef) {
      clearRef.current = () => {
        try {
          term.clear();
        } catch (_) {}
      };
    }

    // Expose reconnect trigger via ref
    if (reconnectRef) {
      reconnectRef.current = () => {
        connectPty(term);
      };
    }

    // Expose scroll APIs for vim mode
    if (scrollRef) {
      scrollRef.current = {
        scrollLines: (n) => {
          try {
            term.scrollLines(n);
          } catch (_) {}
        },
        scrollPages: (n) => {
          try {
            term.scrollPages(n);
          } catch (_) {}
        },
        scrollToTop: () => {
          try {
            term.scrollToTop();
          } catch (_) {}
        },
        scrollToBottom: () => {
          try {
            term.scrollToBottom();
          } catch (_) {}
        },
      };
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit after layout settles
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    });

    // ResizeObserver for auto-fitting (debounced to avoid flooding PTY with resize calls)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          if (fitAddonRef.current && termRef.current) fitAddonRef.current.fit();
        } catch (_) {}
      }, 150);
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    // Connect to PTY — reconnect to existing session if sessionId is available
    const reconnectId = sessionIdProp;
    connectPty(term, reconnectId);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, cwd]);

  // Update font size on live terminal when it changes
  useEffect(() => {
    if (termRef.current && termRef.current.options.fontSize !== fontSize) {
      termRef.current.options.fontSize = fontSize;
      try {
        fitAddonRef.current?.fit();
      } catch (_) {}
    }
  }, [fontSize]);

  // Refit terminal when workspace becomes visible (tab switch)
  useEffect(() => {
    if (visible && fitAddonRef.current && termRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (_) {}
          try {
            termRef.current?.focus();
          } catch (_) {}
        });
      });
    }
  }, [visible]);

  // Manual reconnect handler
  const handleReconnect = useCallback(() => {
    if (termRef.current) {
      connectPty(termRef.current);
    }
  }, [connectPty]);

  return (
    <div className={`terminal-embed ${className}`}>
      <div className="terminal-embed__header">
        <div className="terminal-embed__status">
          <span
            className={`terminal-embed__dot terminal-embed__dot--${status}`}
          />
          <span className="terminal-embed__status-text">
            {status === "connected" && "Connected"}
            {status === "connecting" && "Connecting..."}
            {status === "disconnected" && "Disconnected"}
            {status === "error" && "Error"}
          </span>
        </div>
        <div className="terminal-embed__actions">
          {(status === "disconnected" || status === "error") && (
            <button
              className="terminal-embed__btn"
              onClick={handleReconnect}
              title="Reconnect"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Reconnect</span>
            </button>
          )}
        </div>
      </div>
      <div className="terminal-embed__terminal" ref={containerRef} />

      {/* Typed-command safety banner (BLOCK / WARN) */}
      {safetyBanner && (
        <div
          className={`terminal-embed__safety-banner terminal-embed__safety-banner--${safetyBanner.kind}`}
        >
          <svg
            className="terminal-embed__safety-banner-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          <span className="terminal-embed__safety-banner-text">
            {safetyBanner.kind === "blocked" ? "Blocked: " : "Warning: "}
            {safetyBanner.description}
          </span>
          {safetyBanner.kind === "warn" && (
            <span className="terminal-embed__safety-banner-hint">
              Press Enter again to run anyway
            </span>
          )}
        </div>
      )}

      {/* REQUIRE_APPROVAL / REQUIRE_OVERRIDE modal for typed commands --
          reuses the same confirm modal as the AI-proposed-command flow. */}
      {safetyModal && (
        <TerminalExecConfirmModal
          isOpen={true}
          onClose={handleSafetyModalClose}
          onConfirm={handleSafetyModalConfirm}
          command={safetyModal.command}
          validation={safetyModal.validation}
        />
      )}
    </div>
  );
}
