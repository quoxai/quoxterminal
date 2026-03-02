/**
 * TerminalView — Main terminal workspace page
 *
 * Multi-workspace tabbed interface with layout picker, keyboard shortcuts,
 * and per-pane PTY session management.
 *
 * Ported from quox-source/src/pages/views/TerminalView.jsx
 * Removed: react-router, license check, bastionClient, observer mode, share features.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import useTerminalWorkspace, {
  LAYOUTS,
  type LayoutPreset,
  type WorkspaceState,
} from "../hooks/useTerminalWorkspace";
import { matchShortcut, TERMINAL_SHORTCUTS } from "../config/terminalConfig";
import TerminalPane from "../components/terminal/TerminalPane";
import TerminalChat from "../components/terminal/TerminalChat";
import QuoxSettings from "../components/settings/QuoxSettings";
import FleetDashboard from "../components/hosts/FleetDashboard";
import ToolPalette from "../components/tools/ToolPalette";
import SessionRestoreBanner from "../components/terminal/SessionRestoreBanner";
import type { FleetAgent } from "../services/fleetService";
import type { FleetHost } from "../services/bastionClient";
import { ptyKill } from "../lib/tauri-pty";
import { sshDisconnect } from "../lib/tauri-ssh";
import { storeGet, storeSet } from "../lib/store";
import { migrateFromLocalStorage } from "../services/localMemoryStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./terminal-view.css";

// ── Session restore types ─────────────────────────────────────────────────
const SESSION_STATE_KEY = "quox-terminal-previous-sessions";

interface PreviousSession {
  paneId: string;
  mode: string;
  hostId: string;
  workspaceName: string;
}

interface PreviousSessionState {
  sessions: PreviousSession[];
  savedAt: number;
}

// ── Layout labels (human-readable for accessibility) ──────────────────────

const LAYOUT_LABELS: Record<LayoutPreset, string> = {
  single: "Single pane",
  "split-h": "Horizontal split",
  "split-v": "Vertical split",
  "main-side": "Main + side",
  "side-main": "Side + main",
  "top-split": "Top + bottom split",
  "split-top": "Split top + bottom",
  quad: "Quad grid",
};

// ── Layout icons (SVGs for the layout picker) ──────────────────────────────

const LAYOUT_ICONS: Record<LayoutPreset, React.ReactNode> = {
  single: (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="12" height="12" rx="1" />
    </svg>
  ),
  "split-h": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="12" rx="1" />
      <rect x="7.5" y="1" width="5.5" height="12" rx="1" />
    </svg>
  ),
  "split-v": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="12" height="5.5" rx="1" />
      <rect x="1" y="7.5" width="12" height="5.5" rx="1" />
    </svg>
  ),
  "main-side": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="8" height="12" rx="1" />
      <rect x="10" y="1" width="3" height="5.5" rx="1" />
      <rect x="10" y="7.5" width="3" height="5.5" rx="1" />
    </svg>
  ),
  "side-main": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="3" height="5.5" rx="1" />
      <rect x="1" y="7.5" width="3" height="5.5" rx="1" />
      <rect x="5" y="1" width="8" height="12" rx="1" />
    </svg>
  ),
  "top-split": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="12" height="8" rx="1" />
      <rect x="1" y="10" width="5.5" height="3" rx="1" />
      <rect x="7.5" y="10" width="5.5" height="3" rx="1" />
    </svg>
  ),
  "split-top": (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="3" rx="1" />
      <rect x="7.5" y="1" width="5.5" height="3" rx="1" />
      <rect x="1" y="5" width="12" height="8" rx="1" />
    </svg>
  ),
  quad: (
    <svg viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="7.5" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="1" y="7.5" width="5.5" height="5.5" rx="1" />
      <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" />
    </svg>
  ),
};

export default function TerminalView() {
  const {
    layout,
    panes,
    focusedPaneId,
    sessionCount,
    workspaces,
    activeWorkspaceId,
    workspaceWarning,
    setLayout,
    updatePane,
    setPaneConnected,
    setPaneSessionId,
    setFocusedPane,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    setActiveWorkspace,
  } = useTerminalWorkspace();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [vimEnabled, setVimEnabled] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previousSessions, setPreviousSessions] = useState<PreviousSession[]>([]);
  const [paneErrors, setPaneErrors] = useState<Record<string, boolean>>({});
  const [pendingErrorAction, setPendingErrorAction] = useState<{
    action: 'explain' | 'fix';
    errorType: string;
    errorLine: string;
    suggestion: string;
  } | null>(null);

  // Per-pane refs for clear/reconnect/connect
  const clearRefs = useRef<Record<string, React.MutableRefObject<(() => void) | null>>>({});
  const reconnectRefs = useRef<Record<string, React.MutableRefObject<(() => void) | null>>>({});
  const connectRefs = useRef<Record<string, React.MutableRefObject<((host: FleetHost) => void) | null>>>({});

  // Ensure refs exist for all panes
  for (const pane of panes) {
    if (!clearRefs.current[pane.id]) {
      clearRefs.current[pane.id] = { current: null };
    }
    if (!reconnectRefs.current[pane.id]) {
      reconnectRefs.current[pane.id] = { current: null };
    }
    if (!connectRefs.current[pane.id]) {
      connectRefs.current[pane.id] = { current: null };
    }
  }

  // ── Workspace close with PTY cleanup ───────────────────────────────────

  const handleWorkspaceClose = useCallback(
    (wsId: string) => {
      if (workspaces.length <= 1) return;

      const ws = workspaces.find((w) => w.id === wsId);
      const activeSessions = ws?.panes.filter((p) => p.sessionId) || [];

      // Confirm before closing a tab with active sessions
      if (activeSessions.length > 0) {
        const count = activeSessions.length;
        const msg =
          count === 1
            ? "This tab has an active session. Close it?"
            : `This tab has ${count} active sessions. Close them all?`;
        if (!window.confirm(msg)) return;
      }

      // Kill all sessions in the workspace (local PTY + SSH)
      activeSessions.forEach((p) => {
        if (p.sessionId) {
          if (p.mode === "ssh") {
            sshDisconnect(p.sessionId).catch(() => {});
          } else {
            ptyKill(p.sessionId).catch(() => {});
          }
        }
      });

      removeWorkspace(wsId);
    },
    [workspaces, removeWorkspace],
  );

  // ── Pane mode change (local → SSH) ─────────────────────────────────────

  const handlePaneModeChange = useCallback(
    (paneId: string, mode: string, hostId: string) => {
      updatePane(paneId, { mode, hostId });
    },
    [updatePane],
  );

  // ── Error → Chat integration ──────────────────────────────────────────

  const handleErrorAction = useCallback(
    (action: string, error: unknown) => {
      const err = error as { errorType?: string; errorLine?: string; suggestion?: string };
      if (action === 'explain' || action === 'fix') {
        setPendingErrorAction({
          action: action as 'explain' | 'fix',
          errorType: err.errorType || 'unknown',
          errorLine: err.errorLine || '',
          suggestion: err.suggestion || '',
        });
        // Open chat if not already open
        setChatOpen(true);
      }
    },
    [],
  );

  const clearPendingErrorAction = useCallback(() => {
    setPendingErrorAction(null);
  }, []);

  const handlePaneErrorState = useCallback(
    (paneId: string, hasError: boolean) => {
      setPaneErrors((prev) => {
        if (prev[paneId] === hasError) return prev;
        return { ...prev, [paneId]: hasError };
      });
    },
    [],
  );

  // ── Keyboard shortcut handler ──────────────────────────────────────────

  const handleShortcut = useCallback(
    (event: KeyboardEvent) => {
      const action = matchShortcut(event);
      if (!action) return true; // pass to terminal

      event.preventDefault();
      event.stopPropagation();

      switch (action) {
        case "focusPane0":
          if (panes[0]) setFocusedPane(panes[0].id);
          break;
        case "focusPane1":
          if (panes[1]) setFocusedPane(panes[1].id);
          break;
        case "focusPane2":
          if (panes[2]) setFocusedPane(panes[2].id);
          break;
        case "focusPane3":
          if (panes[3]) setFocusedPane(panes[3].id);
          break;
        case "clearTerminal": {
          const ref = clearRefs.current[focusedPaneId];
          if (ref?.current) ref.current();
          break;
        }
        case "newWorkspace":
          addWorkspace();
          break;
        case "closeWorkspace":
          handleWorkspaceClose(activeWorkspaceId);
          break;
        case "showShortcuts":
          setShowShortcuts((p) => !p);
          break;
        case "toggleChat":
          setChatOpen((prev) => !prev);
          break;
        case "toggleVim":
          setVimEnabled((prev) => !prev);
          break;
        case "toggleClaudeMode": {
          // Toggle Claude mode on focused pane
          const fp = panes.find((p) => p.id === focusedPaneId);
          if (fp) {
            const newMode = fp.mode === "claude" ? "local" : "claude";
            updatePane(fp.id, { mode: newMode, hostId: "" });
          }
          break;
        }
        case "toggleTools":
          setToolsOpen((prev) => !prev);
          break;
      }

      return false; // consumed
    },
    [
      panes,
      focusedPaneId,
      setFocusedPane,
      addWorkspace,
      handleWorkspaceClose,
      activeWorkspaceId,
    ],
  );

  // ── Pane event handlers ────────────────────────────────────────────────

  const handlePaneConnect = useCallback(
    (paneId: string) => {
      setPaneConnected(paneId, true);
    },
    [setPaneConnected],
  );

  const handlePaneDisconnect = useCallback(
    (paneId: string) => {
      setPaneConnected(paneId, false);
    },
    [setPaneConnected],
  );

  const handlePaneSessionId = useCallback(
    (paneId: string, sessionId: string | null) => {
      setPaneSessionId(paneId, sessionId);
    },
    [setPaneSessionId],
  );

  const handlePaneFocus = useCallback(
    (paneId: string) => {
      setFocusedPane(paneId);
    },
    [setFocusedPane],
  );

  const handlePaneClose = useCallback(
    (paneId: string) => {
      // Kill sessions of panes that will be removed (index 1+)
      panes.slice(1).forEach((p) => {
        if (p.sessionId) {
          if (p.mode === "ssh") {
            sshDisconnect(p.sessionId).catch(() => {});
          } else {
            ptyKill(p.sessionId).catch(() => {});
          }
        }
      });

      setLayout("single");
    },
    [panes, setLayout],
  );

  // ── Tab rename ─────────────────────────────────────────────────────────

  const startRename = useCallback(
    (wsId: string, currentName: string) => {
      setRenamingTabId(wsId);
      setRenameValue(currentName);
    },
    [],
  );

  const finishRename = useCallback(() => {
    if (renamingTabId) {
      renameWorkspace(renamingTabId, renameValue);
      setRenamingTabId(null);
    }
  }, [renamingTabId, renameValue, renameWorkspace]);

  // ── Migrate legacy localStorage data on mount ─────────────────────────

  useEffect(() => {
    migrateFromLocalStorage().catch(() => {});
  }, []);

  // ── Load previous sessions on mount (for restore banner) ──────────────

  useEffect(() => {
    storeGet<PreviousSessionState>(SESSION_STATE_KEY).then((saved) => {
      if (saved && Array.isArray(saved.sessions) && saved.sessions.length > 0) {
        // Only show restore if saved within last 24 hours
        const age = Date.now() - (saved.savedAt || 0);
        if (age < 24 * 60 * 60 * 1000) {
          setPreviousSessions(saved.sessions);
        }
      }
    });
  }, []);

  const handleRestore = useCallback(() => {
    // Auto-connect SSH panes from previous sessions
    const sshSessions = previousSessions.filter((s) => s.mode === "ssh" && s.hostId);
    sshSessions.forEach((s) => {
      const ref = connectRefs.current[s.paneId];
      if (ref?.current) {
        const host: FleetHost = {
          hostname: s.hostId,
          ip: null,
          group: null,
          status: null,
          lastSeen: null,
          os: null,
          cpuCount: null,
          memoryTotal: null,
        };
        ref.current(host);
      }
    });
    setPreviousSessions([]);
    storeSet(SESSION_STATE_KEY, null).catch(() => {});
  }, [previousSessions]);

  const handleDismissRestore = useCallback(() => {
    setPreviousSessions([]);
    storeSet(SESSION_STATE_KEY, null).catch(() => {});
  }, []);

  // ── Save session state helper ────────────────────────────────────────

  const saveSessionState = useCallback((wsList: WorkspaceState[]) => {
    const sessions: PreviousSession[] = [];
    wsList.forEach((ws) => {
      ws.panes.forEach((p) => {
        if (p.connected && p.sessionId) {
          sessions.push({
            paneId: p.id,
            mode: p.mode,
            hostId: p.hostId,
            workspaceName: ws.name,
          });
        }
      });
    });
    if (sessions.length > 0) {
      storeSet(SESSION_STATE_KEY, { sessions, savedAt: Date.now() }).catch(() => {});
    }
  }, []);

  // ── Kill all sessions helper ─────────────────────────────────────────

  const killAllSessions = useCallback((wsList: WorkspaceState[]) => {
    wsList.forEach((ws) => {
      ws.panes.forEach((p) => {
        if (p.sessionId) {
          if (p.mode === "ssh") {
            sshDisconnect(p.sessionId).catch(() => {});
          } else {
            ptyKill(p.sessionId).catch(() => {});
          }
        }
      });
    });
  }, []);

  // ── Close prevention & PTY cleanup on app close ───────────────────────

  useEffect(() => {
    if (sessionCount === 0) return;
    const handler = () => {
      // Save state and clean up — don't block the close
      saveSessionState(workspaces);
      killAllSessions(workspaces);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sessionCount, workspaces, saveSessionState, killAllSessions]);

  // ── Tauri native window close guard ──────────────────────────────────

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    getCurrentWindow()
      .onCloseRequested(() => {
        if (sessionCount > 0) {
          // Save session state and clean up before closing
          saveSessionState(workspaces);
          killAllSessions(workspaces);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // Not in Tauri environment (e.g., dev browser)
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [sessionCount, workspaces, saveSessionState, killAllSessions]);

  // ── Layout change with confirmation ────────────────────────────────────

  const handleLayoutChange = useCallback(
    (newLayout: LayoutPreset) => {
      // Kill sessions of panes that will be removed by the layout change
      const newCount = LAYOUTS[newLayout] || 1;
      panes.slice(newCount).forEach((p) => {
        if (p.sessionId) {
          if (p.mode === "ssh") {
            sshDisconnect(p.sessionId).catch(() => {});
          } else {
            ptyKill(p.sessionId).catch(() => {});
          }
        }
      });
      setLayout(newLayout);
    },
    [panes, setLayout],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="terminal-view">
      {/* Header */}
      <div className="terminal-view__header">
        <div className="terminal-view__title">
          <img
            src="/quox-q-icon.png"
            alt="Q"
            className="terminal-view__logo"
          />
          QuoxTerminal
        </div>

        <div className="terminal-view__toolbar">
          {/* Layout picker */}
          <div className="terminal-view__layout-picker">
            {(Object.keys(LAYOUTS) as LayoutPreset[]).map((l) => (
              <button
                key={l}
                className={`terminal-view__layout-btn ${layout === l ? "terminal-view__layout-btn--active" : ""}`}
                onClick={() => handleLayoutChange(l)}
                title={LAYOUT_LABELS[l]}
                aria-label={LAYOUT_LABELS[l]}
              >
                {LAYOUT_ICONS[l]}
              </button>
            ))}
          </div>

          {/* Session counter */}
          <span
            className={`terminal-view__sessions ${sessionCount > 0 ? "terminal-view__sessions--active" : ""}`}
          >
            {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="terminal-view__header-right">
          <div className="terminal-view__status">
            <span
              className={`terminal-view__dot ${sessionCount > 0 ? "terminal-view__dot--connected" : ""}`}
            />
            {sessionCount > 0 ? "Active" : "Idle"}
          </div>

          {/* Fleet Dashboard toggle */}
          <button
            className={`terminal-view__fleet-btn ${fleetOpen ? "terminal-view__fleet-btn--active" : ""}`}
            onClick={() => setFleetOpen((prev) => !prev)}
            title="Fleet Dashboard"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="18" r="1" fill="currentColor" />
            </svg>
          </button>

          {/* AI Chat toggle */}
          <button
            className={`terminal-view__chat-btn ${chatOpen ? "terminal-view__chat-btn--active" : ""}`}
            onClick={() => setChatOpen((prev) => !prev)}
            title="AI Chat (Ctrl+Shift+C)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Tool Palette toggle */}
          <button
            className={`terminal-view__tools-btn ${toolsOpen ? "terminal-view__tools-btn--active" : ""}`}
            onClick={() => setToolsOpen((prev) => !prev)}
            title="Tool Palette (Ctrl+Shift+T)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </button>

          {/* Settings gear */}
          <button
            className="terminal-view__settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="terminal-view__tab-bar">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const wsSessionCount = ws.panes.filter((p) => p.connected).length;

          return (
            <button
              key={ws.id}
              className={`terminal-view__tab ${isActive ? "terminal-view__tab--active" : ""}`}
              onClick={() => setActiveWorkspace(ws.id)}
              onDoubleClick={() => startRename(ws.id, ws.name)}
            >
              {wsSessionCount > 0 && (
                <span className="terminal-view__tab-dot" />
              )}
              {renamingTabId === ws.id ? (
                <input
                  className="terminal-view__tab-rename"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename();
                    if (e.key === "Escape") setRenamingTabId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="terminal-view__tab-name">{ws.name}</span>
              )}
              {workspaces.length > 1 && (
                <button
                  className="terminal-view__tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWorkspaceClose(ws.id);
                  }}
                  title="Close workspace"
                >
                  <svg
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
            </button>
          );
        })}

        <button
          className="terminal-view__tab-add"
          onClick={addWorkspace}
          title="New workspace (Ctrl+Shift+N)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {workspaceWarning && (
          <span className="terminal-view__workspace-warning">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {workspaceWarning}
          </span>
        )}
      </div>

      {/* Session restore banner */}
      {previousSessions.length > 0 && (
        <SessionRestoreBanner
          sessions={previousSessions}
          onRestore={handleRestore}
          onDismiss={handleDismissRestore}
        />
      )}

      {/* Main content — terminal grid + optional chat sidebar */}
      <div className={`terminal-view__main ${chatOpen || fleetOpen || toolsOpen ? "terminal-view__main--chat-open" : ""}`}>
        <div className="terminal-view__body" data-layout={layout}>
          {panes.map((pane) => (
            <TerminalPane
              key={`${activeWorkspaceId}-${pane.id}`}
              paneId={pane.id}
              paneMode={pane.mode}
              paneHostId={pane.hostId}
              sessionId={pane.sessionId}
              isFocused={pane.id === focusedPaneId}
              showCloseBtn={panes.length > 1}
              vimEnabled={vimEnabled}
              onConnect={handlePaneConnect}
              onDisconnect={handlePaneDisconnect}
              onSessionId={handlePaneSessionId}
              onFocus={handlePaneFocus}
              onClose={handlePaneClose}
              onModeChange={handlePaneModeChange}
              onErrorAction={handleErrorAction}
              onErrorState={handlePaneErrorState}
              customKeyHandler={handleShortcut}
              clearRef={clearRefs.current[pane.id]}
              reconnectRef={reconnectRefs.current[pane.id]}
              connectRef={connectRefs.current[pane.id]}
              visible={true}
            />
          ))}
        </div>

        {/* Fleet Dashboard sidebar */}
        {fleetOpen && (
          <FleetDashboard
            onClose={() => setFleetOpen(false)}
            onConnectHost={(agent: FleetAgent) => {
              // Close fleet panel and trigger SSH on the focused pane
              setFleetOpen(false);
              // Convert FleetAgent → FleetHost for handleHostSelect
              const host: FleetHost = {
                hostname: agent.ip || agent.host_id,
                ip: agent.ip || null,
                group: agent.group || null,
                status: agent.status || null,
                lastSeen: agent.last_seen ? new Date(agent.last_seen).toISOString() : null,
                os: agent.os || null,
                cpuCount: null,
                memoryTotal: null,
              };
              const ref = connectRefs.current[focusedPaneId];
              if (ref?.current) {
                ref.current(host);
              }
            }}
          />
        )}

        {/* Tool Palette sidebar */}
        {toolsOpen && (
          <ToolPalette
            onClose={() => setToolsOpen(false)}
            paneContext={{
              mode: panes.find((p) => p.id === focusedPaneId)?.mode || "local",
              hostId: panes.find((p) => p.id === focusedPaneId)?.hostId || "",
              connected: panes.find((p) => p.id === focusedPaneId)?.connected || false,
              hasError: paneErrors[focusedPaneId] || false,
            }}
            onExecute={(command) => {
              const pane = panes.find((p) => p.id === focusedPaneId);
              if (!pane?.sessionId) {
                return;
              }
              const sessionType = pane.mode === 'ssh' ? 'ssh' : 'local';
              import("../services/terminalExecService").then(({ execInTerminal }) => {
                execInTerminal(pane.sessionId!, command, sessionType as 'local' | 'ssh');
              });
              import("../services/terminalMemoryBridge").then(({ recordCommandExecution }) => {
                recordCommandExecution(command, pane.hostId || null).catch(() => {});
              });
              // Brief feedback before closing
              setTimeout(() => setToolsOpen(false), 600);
            }}
          />
        )}

        {/* AI Chat sidebar */}
        {chatOpen && (
          <TerminalChat
            workspaceId={activeWorkspaceId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            sessionId={
              panes.find((p) => p.id === focusedPaneId)?.sessionId ?? null
            }
            sessionType={
              panes.find((p) => p.id === focusedPaneId)?.mode || 'local'
            }
            hostId={
              panes.find((p) => p.id === focusedPaneId)?.hostId || ''
            }
            errorAction={pendingErrorAction}
            onErrorActionConsumed={clearPendingErrorAction}
          />
        )}
      </div>

      {/* Vim mode indicator */}
      {vimEnabled && (
        <div className="terminal-view__vim-indicator">VIM</div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="terminal-leave-overlay"
          onClick={() => setShowShortcuts(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowShortcuts(false); }}
        >
          <div
            className="terminal-leave-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, borderColor: "rgba(56, 189, 248, 0.25)" }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                marginBottom: 16,
              }}
            >
              Keyboard Shortcuts
            </h3>
            {TERMINAL_SHORTCUTS.map((cat) => (
              <div key={cat.category} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(56,189,248,0.6)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}
                >
                  {cat.category}
                </div>
                {cat.items.map((item) => (
                  <div
                    key={item.action}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>
                      {item.description}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {item.keys.join("+")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{
                  padding: "6px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 5,
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      <QuoxSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
