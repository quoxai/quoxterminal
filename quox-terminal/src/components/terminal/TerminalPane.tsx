/**
 * TerminalPane — Per-pane wrapper for multi-pane terminal workspace
 *
 * Renders a compact header with session type indicator and wraps TerminalEmbed.
 * Supports both local PTY sessions and SSH remote sessions.
 *
 * When a collector/bastion is configured in Settings, the pane header shows a
 * "Connect" dropdown with the fleet host list (grouped by category). Selecting
 * a host auto-connects via SSH through the configured bastion. A "Manual SSH..."
 * fallback opens the full SSH connection dialog.
 */

import { useCallback, useRef, useState, useEffect } from "react";
import TerminalEmbed from "./TerminalEmbed";
import SshTerminalEmbed from "./SshTerminalEmbed";
import HostKnowledgeCard from "./HostKnowledgeCard";
import ErrorNotificationBar from "./ErrorNotificationBar";
import SshConnectDialog, {
  type SshConnectionConfig,
} from "./SshConnectDialog";
import HostPicker from "../hosts/HostPicker";
import type { FleetHost } from "../../services/bastionClient";
import useVimMode from "../../hooks/useVimMode";
import { useTerminalErrorDetection } from "../../hooks/useTerminalErrorDetection";
import { sshConnect, sshDisconnect } from "../../lib/tauri-ssh";
import { storeGet } from "../../lib/store";
import { getSessions, type SessionRecord } from "../../services/localMemoryStore";
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
  connectRef?: React.MutableRefObject<((host: FleetHost) => void) | null>;
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
  connectRef,
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
    useTerminalErrorDetection(sessionId, "balanced", paneHostId || null);

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

  // SSH connection handler (manual dialog)
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

  // Fleet host selection — auto-connect using bastion defaults from settings
  const handleHostSelect = useCallback(
    async (host: FleetHost) => {
      setSshConnecting(true);
      setSshError(null);
      try {
        // Load bastion defaults from settings
        const cfg = await storeGet<{
          bastionHost?: string;
          bastionPort?: string;
          bastionUser?: string;
          defaultSshUser?: string;
        }>("quox-connection-config");

        const user = cfg?.defaultSshUser || "root";
        const sid = await sshConnect({
          host: host.hostname,
          port: 22,
          user,
          authMethod: "key",
          // Bastion from settings — transparent to user
          bastionHost: cfg?.bastionHost || undefined,
          bastionPort: cfg?.bastionPort
            ? parseInt(cfg.bastionPort)
            : undefined,
          bastionUser: cfg?.bastionUser || undefined,
        });

        if (onModeChange) {
          onModeChange(paneId, "ssh", `${user}@${host.hostname}`);
        }
        onSessionId(paneId, sid);
        onConnect(paneId);
        setSshConnecting(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSshError(msg);
        setSshConnecting(false);
        // If auto-connect fails, open the manual dialog pre-filled
        setShowSshDialog(true);
      }
    },
    [paneId, onModeChange, onSessionId, onConnect],
  );

  // Expose handleHostSelect via connectRef for external callers (e.g. FleetDashboard)
  if (connectRef) {
    connectRef.current = handleHostSelect;
  }

  // Host Knowledge Card state
  const [knowledgeCardDismissed, setKnowledgeCardDismissed] = useState(false);

  // Read local session history for the knowledge card (async from store)
  const [localSessions, setLocalSessions] = useState<SessionRecord[]>([]);
  useEffect(() => {
    getSessions().then((sessions) => setLocalSessions(sessions)).catch(() => {});
  }, [paneMode, paneHostId]);

  const showKnowledgeCard = paneMode === 'ssh' && paneHostId && !knowledgeCardDismissed && localSessions.length > 0;

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

        {/* Host picker / SSH connect — shown when in local mode */}
        {paneMode === "local" && (
          <HostPicker
            onSelectHost={handleHostSelect}
            onManualSsh={() => setShowSshDialog(true)}
            disabled={sshConnecting}
          />
        )}

        {/* Connecting indicator */}
        {sshConnecting && paneMode === "local" && (
          <span className="terminal-pane__connecting">
            <span className="terminal-pane__connecting-spinner" />
            Connecting...
          </span>
        )}

        {/* SSH error inline */}
        {sshError && paneMode === "local" && !showSshDialog && (
          <span
            className="terminal-pane__ssh-error"
            title={sshError}
            onClick={() => setSshError(null)}
          >
            Failed
          </span>
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
        {/* Host Knowledge Card — shown for known SSH hosts */}
        {showKnowledgeCard && (
          <HostKnowledgeCard
            hostId={paneHostId}
            sessions={localSessions}
            lastError={detectedError ? {
              errorType: detectedError.errorType || 'error',
              errorLine: detectedError.errorLine || '',
            } : null}
            onDismiss={() => setKnowledgeCardDismissed(true)}
          />
        )}

        {paneMode === "ssh" && sessionId ? (
          <SshTerminalEmbed
            key={`ssh-${paneId}`}
            sessionId={sessionId}
            hostId={paneHostId || undefined}
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
