/**
 * SettingsTerminal — Embedded xterm.js terminal for Claude CLI login
 *
 * Spawns a local PTY session, optionally runs an initial command (e.g. `claude login`),
 * and renders an xterm.js terminal inline within the Settings panel.
 *
 * Used for the "Claude Subscription" auth flow — user clicks "Open Terminal",
 * the terminal appears with the claude login process running.
 */

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptyKill,
  onPtyOutput,
  onPtyExit,
} from "../../lib/tauri-pty";
import type { UnlistenFn } from "@tauri-apps/api/event";

interface SettingsTerminalProps {
  /** Command to run immediately after shell spawns (e.g. "claude login") */
  initialCommand?: string;
  /** Called when the PTY session starts */
  onConnect?: () => void;
  /** Called when the PTY session ends (exit code passed) */
  onDisconnect?: (code: number) => void;
}

const THEME = {
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

export default function SettingsTerminal({
  initialCommand,
  onConnect,
  onDisconnect,
}: SettingsTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const unlistenOutput = useRef<UnlistenFn | null>(null);
  const unlistenExit = useRef<UnlistenFn | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(async () => {
    unlistenOutput.current?.();
    unlistenExit.current?.();
    unlistenOutput.current = null;
    unlistenExit.current = null;
    if (sessionRef.current) {
      try { await ptyKill(sessionRef.current); } catch { /* ignore */ }
      sessionRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 1000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;

    // Fit after a frame so the container has its final dimensions
    requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      try { fitAddon.fit(); } catch { /* container not ready */ }
    });

    // Spawn PTY and wire events
    (async () => {
      try {
        const sid = await ptySpawn(undefined, undefined, undefined);
        if (!mountedRef.current) {
          ptyKill(sid).catch(() => {});
          return;
        }
        sessionRef.current = sid;

        // Resize to match terminal dimensions
        try {
          await ptyResize(sid, term.cols, term.rows);
        } catch { /* ignore */ }

        // Listen for output
        unlistenOutput.current = await onPtyOutput(sid, (data) => {
          if (mountedRef.current && termRef.current) {
            termRef.current.write(data);
          }
        });

        // Listen for exit
        unlistenExit.current = await onPtyExit(sid, (code) => {
          if (mountedRef.current && termRef.current) {
            termRef.current.write(
              `\r\n\x1b[90m[Session ended with code ${code}]\x1b[0m\r\n`
            );
          }
          onDisconnect?.(code);
        });

        // Forward terminal input to PTY
        term.onData((data) => {
          if (sessionRef.current) {
            ptyWrite(sessionRef.current, data).catch(() => {});
          }
        });

        // Handle terminal resize
        term.onResize(({ cols, rows }) => {
          if (sessionRef.current) {
            ptyResize(sessionRef.current, cols, rows).catch(() => {});
          }
        });

        onConnect?.();

        // Send initial command after a short delay to let shell init
        if (initialCommand) {
          setTimeout(() => {
            if (sessionRef.current && mountedRef.current) {
              ptyWrite(sessionRef.current, initialCommand + "\n").catch(() => {});
            }
          }, 500);
        }
      } catch (err) {
        if (mountedRef.current && termRef.current) {
          termRef.current.write(
            `\r\n\x1b[31mFailed to spawn terminal: ${err}\x1b[0m\r\n`
          );
        }
      }
    })();

    // Resize observer for when the container changes size
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });
    ro.observe(containerRef.current);

    return () => {
      mountedRef.current = false;
      ro.disconnect();
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="settings-terminal"
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 6,
        overflow: "hidden",
        background: "#0a0e14",
      }}
    />
  );
}
