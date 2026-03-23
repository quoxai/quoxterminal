/**
 * TerminalPane — Per-pane wrapper for multi-pane terminal workspace
 *
 * Renders a compact header with session type indicator and wraps TerminalEmbed.
 * Supports both local PTY sessions and SSH remote sessions.
 *
 * Claude Code mode is a toggle overlay — it writes the `claude` CLI command
 * into the existing terminal session (local or SSH) rather than spawning a
 * separate PTY. This means Claude mode works on any connection.
 *
 * When a collector/bastion is configured in Settings, the pane header shows a
 * "Connect" dropdown with the fleet host list (grouped by category). Selecting
 * a host auto-connects via SSH through the configured bastion. A "Manual SSH..."
 * fallback opens the full SSH connection dialog.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import TerminalEmbed from "./TerminalEmbed";
import SshTerminalEmbed from "./SshTerminalEmbed";
import ClaudeStatusBar from "../claude/ClaudeStatusBar";
import HostKnowledgeCard from "./HostKnowledgeCard";
import ErrorNotificationBar from "./ErrorNotificationBar";
import SshConnectDialog, {
  type SshConnectionConfig,
} from "./SshConnectDialog";
import HostPicker from "../hosts/HostPicker";
import type { FleetHost } from "../../services/bastionClient";
import useVimMode from "../../hooks/useVimMode";
import { useTerminalErrorDetection } from "../../hooks/useTerminalErrorDetection";
import { sshConnect, sshDisconnect, sshWrite } from "../../lib/tauri-ssh";
import { ptyWrite } from "../../lib/tauri-pty";
import { storeGet } from "../../lib/store";
import { getSessions, type SessionRecord } from "../../services/localMemoryStore";
import {
  TERMINAL_MODES,
  DEFAULT_MODE,
  DEFAULT_MODEL,
  getClaudeArgs,
  loadMode,
  saveMode,
  type ModeId,
  type ModelId,
} from "../../config/terminalModes";
import { detectClaudeProject } from "../../lib/tauri-claude";
import { homeDir } from "@tauri-apps/api/path";
import "./TerminalPane.css";

interface TerminalPaneProps {
  paneId: string;
  paneMode?: string;
  paneHostId?: string;
  env?: Record<string, string>;
  teamRole?: { name: string; color: string; isLead: boolean };
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
  onErrorState?: (paneId: string, hasError: boolean) => void;
  customKeyHandler?: (event: KeyboardEvent) => boolean;
  clearRef?: React.MutableRefObject<(() => void) | null>;
  reconnectRef?: React.MutableRefObject<(() => void) | null>;
  connectRef?: React.MutableRefObject<((host: FleetHost) => void) | null>;
  claudeToggleRef?: React.MutableRefObject<(() => void) | null>;
  fontSize?: number;
  visible?: boolean;
}

/** Write data to a session — local PTY or SSH. */
async function writeToSession(
  sessionId: string,
  data: string,
  mode: string,
): Promise<void> {
  if (mode === "ssh") {
    await sshWrite(sessionId, data);
  } else {
    await ptyWrite(sessionId, data);
  }
}

export default function TerminalPane({
  paneId,
  paneMode = "local",
  paneHostId = "",
  env: paneEnv,
  teamRole,
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
  onErrorState,
  customKeyHandler,
  clearRef,
  reconnectRef,
  connectRef,
  claudeToggleRef,
  fontSize,
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

  // Claude mode — overlay toggle on the existing session (not a separate PTY)
  const [claudeActive, setClaudeActive] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModeId>(DEFAULT_MODE);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [claudeProjectDetected, setClaudeProjectDetected] = useState(false);
  const [claudeMdPath, setClaudeMdPath] = useState<string | null>(null);
  const [claudeSessionStart, setClaudeSessionStart] = useState(() => Date.now());

  // Load persisted mode on mount
  useEffect(() => {
    loadMode(paneId).then((saved) => setSelectedMode(saved));
  }, [paneId]);

  // Detect Claude project when claude becomes active
  useEffect(() => {
    if (claudeActive) {
      setClaudeSessionStart(Date.now());
      homeDir().then((home) => {
        return detectClaudeProject(home);
      }).then((info) => {
        setClaudeProjectDetected(info.is_claude_project);
        setClaudeMdPath(info.claude_md_path ?? null);
      }).catch((err) => {
        console.warn("detectClaudeProject failed:", err);
      });
    }
  }, [claudeActive]);

  // Handle paneMode === "claude" (from teams or workspace restore):
  // Set claudeActive and auto-write the claude command once session is ready
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (paneMode === "claude" && !claudeActive) {
      setClaudeActive(true);
      autoLaunchedRef.current = false; // reset so we auto-launch when session appears
    }
  }, [paneMode, claudeActive]);

  /** Build the `claude` command string with current mode/model args. */
  const buildClaudeCommand = useCallback(
    (resumeMode?: "continue" | "resume") => {
      const args = getClaudeArgs(selectedMode, selectedModel);
      if (resumeMode === "continue") args.push("--continue");
      if (resumeMode === "resume") args.push("--resume");

      // Build env prefix for team env vars
      const envParts: string[] = [];
      if (paneEnv) {
        for (const [key, val] of Object.entries(paneEnv)) {
          envParts.push(`${key}=${val}`);
        }
      }

      const prefix = envParts.length > 0 ? envParts.join(" ") + " " : "";
      return `${prefix}claude${args.length > 0 ? " " + args.join(" ") : ""}`;
    },
    [selectedMode, selectedModel, paneEnv],
  );

  // Auto-write claude command when session becomes available for auto-launched panes
  useEffect(() => {
    if (paneMode === "claude" && claudeActive && sessionId && !autoLaunchedRef.current) {
      autoLaunchedRef.current = true;
      // Small delay to let the terminal initialize
      const timer = setTimeout(() => {
        const cmd = buildClaudeCommand();
        writeToSession(sessionId, cmd + "\n", "local").catch((err) => {
          console.error("Failed to auto-launch claude:", err);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [paneMode, claudeActive, sessionId, buildClaudeCommand]);

  /** Toggle Claude mode ON — write the claude command to the session. */
  const activateClaude = useCallback(
    async (resumeMode?: "continue" | "resume") => {
      if (!sessionId) return;
      setClaudeActive(true);
      setClaudeSessionStart(Date.now());
      const cmd = buildClaudeCommand(resumeMode);
      try {
        await writeToSession(sessionId, cmd + "\n", paneMode);
      } catch (err) {
        console.error("Failed to write claude command:", err);
      }
    },
    [sessionId, paneMode, buildClaudeCommand],
  );

  /** Toggle Claude mode OFF — send exit to leave Claude CLI. */
  const deactivateClaude = useCallback(async () => {
    setClaudeActive(false);
    if (!sessionId) return;
    try {
      // Send /exit then Enter to cleanly exit Claude CLI
      await writeToSession(sessionId, "/exit\n", paneMode);
    } catch (err) {
      console.error("Failed to exit claude:", err);
    }
  }, [sessionId, paneMode]);

  // Expose toggle function via ref for external callers (TerminalView shortcuts)
  useEffect(() => {
    if (claudeToggleRef) {
      claudeToggleRef.current = () => {
        if (claudeActive) {
          deactivateClaude();
        } else {
          activateClaude();
        }
      };
    }
    return () => {
      if (claudeToggleRef) {
        claudeToggleRef.current = null;
      }
    };
  }, [claudeToggleRef, claudeActive, activateClaude, deactivateClaude]);

  const handleClaudeModeChange = useCallback(
    async (mode: ModeId) => {
      setSelectedMode(mode);
      saveMode(paneId, mode);
      // Restart claude with new mode — exit then re-enter
      if (claudeActive && sessionId) {
        setClaudeActive(false);
        try {
          await writeToSession(sessionId, "/exit\n", paneMode);
          // Give claude a moment to exit before respawning
          setTimeout(async () => {
            setClaudeActive(true);
            setClaudeSessionStart(Date.now());
            const args = getClaudeArgs(mode, selectedModel);
            const envParts: string[] = [];
            if (paneEnv) {
              for (const [key, val] of Object.entries(paneEnv)) {
                envParts.push(`${key}=${val}`);
              }
            }
            const prefix = envParts.length > 0 ? envParts.join(" ") + " " : "";
            const cmd = `${prefix}claude${args.length > 0 ? " " + args.join(" ") : ""}`;
            await writeToSession(sessionId, cmd + "\n", paneMode);
          }, 500);
        } catch (err) {
          console.error("Failed to restart claude:", err);
        }
      }
    },
    [paneId, claudeActive, sessionId, paneMode, selectedModel, paneEnv],
  );

  const handleModelChange = useCallback(
    async (model: ModelId) => {
      setSelectedModel(model);
      // Restart claude with new model
      if (claudeActive && sessionId) {
        setClaudeActive(false);
        try {
          await writeToSession(sessionId, "/exit\n", paneMode);
          setTimeout(async () => {
            setClaudeActive(true);
            setClaudeSessionStart(Date.now());
            const args = getClaudeArgs(selectedMode, model);
            const envParts: string[] = [];
            if (paneEnv) {
              for (const [key, val] of Object.entries(paneEnv)) {
                envParts.push(`${key}=${val}`);
              }
            }
            const prefix = envParts.length > 0 ? envParts.join(" ") + " " : "";
            const cmd = `${prefix}claude${args.length > 0 ? " " + args.join(" ") : ""}`;
            await writeToSession(sessionId, cmd + "\n", paneMode);
          }, 500);
        } catch (err) {
          console.error("Failed to restart claude:", err);
        }
      }
    },
    [claudeActive, sessionId, paneMode, selectedMode, paneEnv],
  );

  const handleResume = useCallback(
    (mode: "continue" | "resume") => {
      activateClaude(mode);
    },
    [activateClaude],
  );

  // Vim mode hook
  const { vimMode, vimKeyHandler } = useVimMode({
    enabled: vimEnabled,
    scrollRef,
  });

  // Error detection hook
  const { detectedError, dismissError, signalActivity } =
    useTerminalErrorDetection(sessionId, paneMode, paneHostId || null);

  // Report error state changes to parent
  useEffect(() => {
    onErrorState?.(paneId, !!detectedError);
  }, [paneId, !!detectedError, onErrorState]);

  const handleConnect = useCallback(() => {
    onConnect(paneId);
  }, [paneId, onConnect]);

  const handleDisconnect = useCallback(() => {
    setClaudeActive(false);
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

  // Session type label — team role overrides, then claude overlay, then mode
  const sessionLabel =
    teamRole ? teamRole.name :
    claudeActive ? "Claude" :
    paneMode === "ssh" ? paneHostId || "SSH" : "Local";
  const sessionLabelClass =
    teamRole
      ? "terminal-pane__label terminal-pane__team-label"
      : claudeActive
        ? "terminal-pane__label terminal-pane__label--claude"
        : paneMode === "ssh"
          ? "terminal-pane__label terminal-pane__label--ssh"
          : "terminal-pane__label";

  // Can we show the Claude toggle? Yes, whenever we have a live session (local or SSH)
  const canToggleClaude = !claudeActive && !!sessionId && (paneMode === "local" || paneMode === "ssh");

  return (
    <div
      className={`terminal-pane ${isFocused ? "terminal-pane--focused" : ""}`}
      onClick={handleFocus}
    >
      <div className="terminal-pane__header">
        <span className={sessionLabelClass} style={teamRole ? { color: teamRole.color } : undefined}>
          {teamRole ? (
            <>
              <span
                className="terminal-pane__team-dot terminal-pane__team-dot--running"
                style={{ background: teamRole.color }}
              />
              {sessionLabel}
              {teamRole.isLead && <span className="terminal-pane__team-lead-badge">LEAD</span>}
            </>
          ) : claudeActive ? (
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
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          ) : paneMode === "ssh" ? (
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
          ) : null}
          {!teamRole && sessionLabel}
        </span>

        {/* Claude toggle — available on both local and SSH when session is alive */}
        {canToggleClaude && (
          <button
            className="terminal-pane__claude-btn"
            onClick={() => activateClaude()}
            title="Start Claude Code (Ctrl+Shift+K)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            Claude
          </button>
        )}

        {/* Claude mode controls — shown when claude is active */}
        {claudeActive && (
          <>
            <button
              className="terminal-pane__claude-btn terminal-pane__claude-btn--exit"
              onClick={deactivateClaude}
              title="Exit Claude Code"
            >
              Terminal
            </button>
            <div className="terminal-pane__mode-pills">
              {Object.values(TERMINAL_MODES).map((mode) => (
                <button
                  key={mode.id}
                  className={`terminal-pane__mode-pill${selectedMode === mode.id ? " terminal-pane__mode-pill--active" : ""}`}
                  onClick={() => handleClaudeModeChange(mode.id)}
                  title={mode.description}
                  style={selectedMode === mode.id ? { borderColor: mode.color, color: mode.color } : undefined}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Host picker / SSH connect — shown when not in SSH mode and claude not active */}
        {paneMode === "local" && !claudeActive && (
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

        {/* Single terminal — always the same component, Claude is just a command inside it */}
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
            fontSize={fontSize}
            visible={visible}
          />
        ) : (
          <TerminalEmbed
            key={paneId}
            sessionId={sessionId}
            env={paneEnv}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSessionId={handleSessionId}
            onData={handleData}
            customKeyHandler={composedKeyHandler}
            clearRef={clearRef}
            reconnectRef={reconnectRef}
            scrollRef={scrollRef}
            fontSize={fontSize}
            visible={visible}
          />
        )}

        {/* Error detection bar */}
        {!claudeActive && detectedError && (
          <ErrorNotificationBar
            error={detectedError}
            onAction={(action, error) => onErrorAction?.(action, error)}
            onDismiss={dismissError}
            mode={paneMode}
          />
        )}

        {/* Claude status bar overlay */}
        {claudeActive && (
          <ClaudeStatusBar
            mode={selectedMode}
            model={selectedModel}
            projectDetected={claudeProjectDetected}
            claudeMdPath={claudeMdPath}
            sessionStartTime={claudeSessionStart}
            sessionId={sessionId}
            onModelChange={handleModelChange}
            onResume={handleResume}
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
