/**
 * TerminalPane — Per-pane wrapper for multi-pane terminal workspace
 *
 * Renders a compact header with session type indicator and wraps TerminalEmbed.
 * Supports both local PTY sessions and SSH remote sessions.
 */

import { useCallback, useRef, useState } from "react";
import TerminalEmbed from "./TerminalEmbed";
import SshTerminalEmbed from "./SshTerminalEmbed";
import ErrorNotificationBar from "./ErrorNotificationBar";
import SshConnectDialog, {
  type SshConnectionConfig,
} from "./SshConnectDialog";
import useVimMode from "../../hooks/useVimMode";
import { useTerminalErrorDetection } from "../../hooks/useTerminalErrorDetection";
import { sshConnect, sshDisconnect } from "../../lib/tauri-ssh";
import "./TerminalPane.css";

interface TerminalPaneProps {
  paneId: string;
  paneMode?: string;
  paneHostId?: string;
  sessionId: string | null;
  isFocused: boolean;
  showCloseBtn: boolean;
  vimEnabled?: boolean;
  onConnect: (paneId: string) => void;
  onDisconnect: (paneId: string) => void;
  onSessionId: (paneId: string, sessionId: string | null) => void;
  onFocus: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onModeChange?: (paneId: string, mode: string, hostId: string) => void;
  onErrorAction?: (action: string, error: unknown) => void;
  customKeyHandler?: (event: KeyboardEvent) => boolean;
  clearRef?: React.MutableRefObject<(() => void) | null>;
  reconnectRef?: React.MutableRefObject<(() => void) | null>;
  visible?: boolean;
}

export default function TerminalPane({
  paneId,
  paneMode = "local",
  paneHostId = "",
  sessionId,
  isFocused,
  showCloseBtn,
  vimEnabled = false,
  onConnect,
  onDisconnect,
  onSessionId,
  onFocus,
  onClose,
  onModeChange,
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

  const [showSshDialog, setShowSshDialog] = useState(false);
  const [sshConnecting, setSshConnecting] = useState(false);
  const [sshError, setSshError] = useState<string | null>(null);

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
    // If SSH session, disconnect it
    if (paneMode === "ssh" && sessionId) {
      sshDisconnect(sessionId).catch(() => {});
    }
    onClose(paneId);
  }, [paneId, paneMode, sessionId, onClose]);

  // Compose key handlers: vim → workspace shortcuts
  const composedKeyHandler = useCallback(
    (event: KeyboardEvent) => {
      // Vim mode intercepts first
      if (vimEnabled) {
        const passThrough = vimKeyHandler(event);
        if (!passThrough) return false;
      }
      // Then workspace shortcuts
      if (customKeyHandler) {
        return customKeyHandler(event);
      }
      return true;
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

  // SSH connection handler
  const handleSshConnect = useCallback(
    async (config: SshConnectionConfig) => {
      setSshConnecting(true);
      setSshError(null);
      try {
        const sid = await sshConnect({
          host: config.host,
          port: config.port,
          user: config.user,
          authMethod: config.authMethod,
          keyPath: config.keyPath,
          keyPassphrase: config.keyPassphrase,
          password: config.password,
          bastionHost: config.bastionHost,
          bastionPort: config.bastionPort,
          bastionUser: config.bastionUser,
          bastionKeyPath: config.bastionKeyPath,
        });

        // Update pane mode to SSH
        if (onModeChange) {
          onModeChange(
            paneId,
            "ssh",
            `${config.user}@${config.host}:${config.port}`,
          );
        }
        onSessionId(paneId, sid);
        onConnect(paneId);
        setShowSshDialog(false);
        setSshConnecting(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSshError(msg);
        setSshConnecting(false);
      }
    },
    [paneId, onModeChange, onSessionId, onConnect],
  );

  // Session type label
  const sessionLabel =
    paneMode === "ssh" ? paneHostId || "SSH" : "Local";
  const sessionLabelClass =
    paneMode === "ssh"
      ? "terminal-pane__label terminal-pane__label--ssh"
      : "terminal-pane__label";

  return (
    <div
      className={`terminal-pane ${isFocused ? "terminal-pane--focused" : ""}`}
      onClick={handleFocus}
    >
      <div className="terminal-pane__header">
        <span className={sessionLabelClass}>
          {paneMode === "ssh" && (
            <svg
              className="terminal-pane__label-icon"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          )}
          {sessionLabel}
        </span>

        {/* SSH connect button — shown when in local mode */}
        {paneMode === "local" && (
          <button
            className="terminal-pane__ssh-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowSshDialog(true);
            }}
            title="SSH Connect"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
            SSH
          </button>
        )}

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
        {paneMode === "ssh" && sessionId ? (
          <SshTerminalEmbed
            key={`ssh-${paneId}`}
            sessionId={sessionId}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onData={handleData}
            customKeyHandler={composedKeyHandler}
            clearRef={clearRef}
            scrollRef={scrollRef}
            visible={visible}
          />
        ) : (
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
        )}

        {/* Error detection bar */}
        {detectedError && (
          <ErrorNotificationBar
            error={detectedError}
            onAction={(action, error) => onErrorAction?.(action, error)}
            onDismiss={dismissError}
            mode="balanced"
          />
        )}
      </div>

      {/* SSH Connection Dialog */}
      <SshConnectDialog
        isOpen={showSshDialog}
        onClose={() => {
          setShowSshDialog(false);
          setSshError(null);
        }}
        onConnect={handleSshConnect}
        connecting={sshConnecting}
        error={sshError}
      />
    </div>
  );
}
