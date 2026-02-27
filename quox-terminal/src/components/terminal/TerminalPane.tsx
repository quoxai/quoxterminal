/**
 * TerminalPane — Per-pane wrapper for multi-pane terminal workspace
 *
 * Renders a compact header and wraps TerminalEmbed.
 * Each pane manages its own PTY session independently.
 *
 * Ported from quox-source — simplified for local-only mode (Phase 2).
 * SSH selectors and host knowledge will be re-enabled in Phase 5.
 */

import { useCallback, useRef } from "react";
import TerminalEmbed from "./TerminalEmbed";
import ErrorNotificationBar from "./ErrorNotificationBar";
import useVimMode from "../../hooks/useVimMode";
import { useTerminalErrorDetection } from "../../hooks/useTerminalErrorDetection";
import "./TerminalPane.css";

interface TerminalPaneProps {
  paneId: string;
  sessionId: string | null;
  isFocused: boolean;
  showCloseBtn: boolean;
  vimEnabled?: boolean;
  onConnect: (paneId: string) => void;
  onDisconnect: (paneId: string) => void;
  onSessionId: (paneId: string, sessionId: string | null) => void;
  onFocus: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onErrorAction?: (action: string, error: unknown) => void;
  customKeyHandler?: (event: KeyboardEvent) => boolean;
  clearRef?: React.MutableRefObject<(() => void) | null>;
  reconnectRef?: React.MutableRefObject<(() => void) | null>;
  visible?: boolean;
}

export default function TerminalPane({
  paneId,
  sessionId,
  isFocused,
  showCloseBtn,
  vimEnabled = false,
  onConnect,
  onDisconnect,
  onSessionId,
  onFocus,
  onClose,
  onErrorAction,
  customKeyHandler,
  clearRef,
  reconnectRef,
  visible = true,
}: TerminalPaneProps) {
  const scrollRef = useRef<{
    scrollLines: (n: number) => void;
    scrollPages: (n: number) => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
  } | null>(null);

  // Vim mode hook
  const { vimMode, vimKeyHandler } = useVimMode({
    enabled: vimEnabled,
    scrollRef,
  });

  // Error detection hook
  const { detectedError, dismissError, signalActivity } =
    useTerminalErrorDetection(sessionId, "balanced");

  const handleConnect = useCallback(() => {
    onConnect(paneId);
  }, [paneId, onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect(paneId);
  }, [paneId, onDisconnect]);

  const handleSessionId = useCallback(
    (newSessionId: string | null) => {
      if (onSessionId) onSessionId(paneId, newSessionId);
    },
    [paneId, onSessionId],
  );

  const handleFocus = useCallback(() => {
    onFocus(paneId);
  }, [paneId, onFocus]);

  const handleClose = useCallback(() => {
    onClose(paneId);
  }, [paneId, onClose]);

  // Compose key handlers: vim → workspace shortcuts
  const composedKeyHandler = useCallback(
    (event: KeyboardEvent) => {
      // Vim mode intercepts first
      if (vimEnabled) {
        const passThrough = vimKeyHandler(event);
        if (!passThrough) return false; // vim consumed the key
      }
      // Then workspace shortcuts
      if (customKeyHandler) {
        return customKeyHandler(event);
      }
      return true; // pass to terminal
    },
    [vimEnabled, vimKeyHandler, customKeyHandler],
  );

  // Terminal data callback — signal activity for error detection
  const handleData = useCallback(
    (_data: string) => {
      signalActivity();
    },
    [signalActivity],
  );

  return (
    <div
      className={`terminal-pane ${isFocused ? "terminal-pane--focused" : ""}`}
      onClick={handleFocus}
    >
      <div className="terminal-pane__header">
        <span className="terminal-pane__label">Local</span>
        {vimEnabled && (
          <span
            className={`terminal-pane__vim-badge terminal-pane__vim-badge--${vimMode}`}
          >
            {vimMode === "normal" ? "NORMAL" : "INSERT"}
          </span>
        )}
        <div className="terminal-pane__spacer" />
        {showCloseBtn && (
          <button
            className="terminal-pane__close"
            onClick={handleClose}
            title="Close pane"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="terminal-pane__body">
        <TerminalEmbed
          key={paneId}
          sessionId={sessionId}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onSessionId={handleSessionId}
          onData={handleData}
          customKeyHandler={composedKeyHandler}
          clearRef={clearRef}
          reconnectRef={reconnectRef}
          scrollRef={scrollRef}
          visible={visible}
        />

        {/* Error detection bar */}
        {detectedError && (
          <ErrorNotificationBar
            error={detectedError}
            onAction={(action, error) =>
              onErrorAction?.(action, error)
            }
            onDismiss={dismissError}
            mode="balanced"
          />
        )}
      </div>
    </div>
  );
}
