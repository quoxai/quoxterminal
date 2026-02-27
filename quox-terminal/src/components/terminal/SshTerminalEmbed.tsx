/**
 * SshTerminalEmbed — xterm.js terminal for SSH sessions
 *
 * Similar to TerminalEmbed but works with an existing SSH session ID.
 * SSH sessions emit the same pty-output/pty-exit events as local PTY sessions,
 * so the event wiring is identical. The key difference is:
 * - No spawning — the SSH session is already established
 * - Writes go through sshWrite instead of ptyWrite
 * - Resizes go through sshResize instead of ptyResize
 * - Reconnects restore from the SSH ring buffer via sshGetOutput
 */

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./TerminalEmbed.css";
import { TERM_THEME } from "./TerminalEmbed";
import { TERMINAL_LIMITS } from "../../config/terminalConfig";
import { sshWrite, sshResize, sshGetOutput } from "../../lib/tauri-ssh";
import { onPtyOutput, onPtyExit } from "../../lib/tauri-pty";
import { trackSessionStart, trackSessionEnd } from "../../services/terminalMemoryBridge";
import type { UnlistenFn } from "@tauri-apps/api/event";

interface ScrollRef {
  scrollLines: (n: number) => void;
  scrollPages: (n: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

interface SshTerminalEmbedProps {
  sessionId: string;
  onConnect?: () => void;
  onDisconnect?: (code?: number) => void;
  onData?: (data: string) => void;
  customKeyHandler?: (event: KeyboardEvent) => boolean;
  clearRef?: React.MutableRefObject<(() => void) | null>;
  scrollRef?: React.MutableRefObject<ScrollRef | null>;
  visible?: boolean;
}

export default function SshTerminalEmbed({
  sessionId,
  onConnect,
  onDisconnect,
  onData,
  customKeyHandler,
  clearRef,
  scrollRef,
  visible = true,
}: SshTerminalEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const termDataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const termResizeListenerRef = useRef<{ dispose: () => void } | null>(null);

  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onDataRef = useRef(onData);
  const customKeyHandlerRef = useRef(customKeyHandler);

  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onDataRef.current = onData;
  customKeyHandlerRef.current = customKeyHandler;

  const cleanup = useCallback(() => {
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
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitAddonRef.current = null;
  }, []);

  useEffect(() => {
    if (!containerRef.current || !sessionId) return;

    cleanup();

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
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

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (customKeyHandlerRef.current) {
        return customKeyHandlerRef.current(event);
      }
      return true;
    });

    if (clearRef) {
      clearRef.current = () => {
        try { term.clear(); } catch (_) {}
      };
    }

    if (scrollRef) {
      scrollRef.current = {
        scrollLines: (n) => { try { term.scrollLines(n); } catch (_) {} },
        scrollPages: (n) => { try { term.scrollPages(n); } catch (_) {} },
        scrollToTop: () => { try { term.scrollToTop(); } catch (_) {} },
        scrollToBottom: () => { try { term.scrollToBottom(); } catch (_) {} },
      };
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch (_) {}
    });

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try { fitAddonRef.current?.fit(); } catch (_) {}
      }, 16);
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    // Wire up SSH session
    const wireSession = async () => {
      // Restore recent output from ring buffer
      try {
        const recentOutput = await sshGetOutput(sessionId, 8192);
        if (recentOutput) term.write(recentOutput);
      } catch (_) {}

      // Listen for output
      const unlistenOutput = await onPtyOutput(sessionId, (data) => {
        term.write(data);
        if (onDataRef.current) onDataRef.current(data);
      });
      unlistenOutputRef.current = unlistenOutput;

      // Listen for exit
      const unlistenExit = await onPtyExit(sessionId, (code) => {
        term.write(
          `\r\n\x1b[33m[SSH session ended (exit code ${code})]\x1b[0m\r\n`,
        );
        trackSessionEnd(sessionId).catch(() => {});
        if (onDisconnectRef.current) onDisconnectRef.current(code);
      });
      unlistenExitRef.current = unlistenExit;

      // Input → SSH write
      termDataListenerRef.current = term.onData((data) => {
        sshWrite(sessionId, data).catch((err) => {
          console.error("SSH write failed:", err);
        });
      });

      // Resize → SSH resize
      termResizeListenerRef.current = term.onResize(({ cols, rows }) => {
        sshResize(sessionId, cols, rows).catch((err) => {
          console.error("SSH resize failed:", err);
        });
      });

      // Send initial resize
      const { cols, rows } = term;
      await sshResize(sessionId, cols, rows).catch(() => {});

      term.focus();
      if (onConnectRef.current) onConnectRef.current();

      // Track SSH session in memory bridge
      trackSessionStart(null, sessionId, 'ssh').catch(() => {});
    };

    wireSession();

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Refit when becoming visible
  useEffect(() => {
    if (visible && fitAddonRef.current && termRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { fitAddonRef.current?.fit(); } catch (_) {}
          try { termRef.current?.focus(); } catch (_) {}
        });
      });
    }
  }, [visible]);

  return (
    <div className="terminal-embed">
      <div className="terminal-embed__terminal" ref={containerRef} />
    </div>
  );
}
