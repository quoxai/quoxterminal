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
  getSessionsToLose,
  type LayoutPreset,
} from "../hooks/useTerminalWorkspace";
import { matchShortcut, TERMINAL_SHORTCUTS } from "../config/terminalConfig";
import TerminalPane from "../components/terminal/TerminalPane";
import TerminalChat from "../components/terminal/TerminalChat";
import { ptyKill } from "../lib/tauri-pty";
import "./terminal-view.css";

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
    setPaneConnected,
    setPaneSessionId,
    setFocusedPane,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    setActiveWorkspace,
  } = useTerminalWorkspace();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [vimEnabled, setVimEnabled] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Per-pane refs for clear/reconnect
  const clearRefs = useRef<Record<string, React.MutableRefObject<(() => void) | null>>>({});
  const reconnectRefs = useRef<Record<string, React.MutableRefObject<(() => void) | null>>>({});

  // Ensure refs exist for all panes
  for (const pane of panes) {
    if (!clearRefs.current[pane.id]) {
      clearRefs.current[pane.id] = { current: null };
    }
    if (!reconnectRefs.current[pane.id]) {
      reconnectRefs.current[pane.id] = { current: null };
    }
  }

  // ── Workspace close with PTY cleanup ───────────────────────────────────

  const handleWorkspaceClose = useCallback(
    (wsId: string) => {
      if (workspaces.length <= 1) return;

      const ws = workspaces.find((w) => w.id === wsId);
      const activeSessions = ws?.panes.filter((p) => p.sessionId) || [];

      if (activeSessions.length > 0) {
        const confirmed = window.confirm(
          `Close workspace with ${activeSessions.length} active session${activeSessions.length > 1 ? "s" : ""}?`,
        );
        if (!confirmed) return;
      }

      // Kill all PTY sessions in the workspace
      activeSessions.forEach((p) => {
        if (p.sessionId) ptyKill(p.sessionId).catch(() => {});
      });

      removeWorkspace(wsId);
    },
    [workspaces, removeWorkspace],
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
      // Find the pane being closed and kill its PTY
      const pane = panes.find((p) => p.id === paneId);
      if (pane?.sessionId) {
        ptyKill(pane.sessionId).catch(() => {});
      }

      // Check how many other connected sessions would be lost by downgrading
      const sessionsToLose = getSessionsToLose(panes, "single");
      if (sessionsToLose > 0) {
        const confirmed = window.confirm(
          `This will close ${sessionsToLose} active session${sessionsToLose > 1 ? "s" : ""}. Continue?`,
        );
        if (!confirmed) return;

        // Kill PTYs of panes that will be removed (all except first)
        panes.slice(1).forEach((p) => {
          if (p.sessionId && p.id !== paneId) {
            ptyKill(p.sessionId).catch(() => {});
          }
        });
      }

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

  // ── Close prevention & PTY cleanup on app close ───────────────────────

  useEffect(() => {
    if (sessionCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Kill all PTY sessions across all workspaces
      workspaces.forEach((ws) => {
        ws.panes.forEach((p) => {
          if (p.sessionId) ptyKill(p.sessionId).catch(() => {});
        });
      });
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sessionCount, workspaces]);

  // ── Layout change with confirmation ────────────────────────────────────

  const handleLayoutChange = useCallback(
    (newLayout: LayoutPreset) => {
      const sessionsToLose = getSessionsToLose(panes, newLayout);
      if (sessionsToLose > 0) {
        const confirmed = window.confirm(
          `Switching layout will close ${sessionsToLose} active session${sessionsToLose > 1 ? "s" : ""}. Continue?`,
        );
        if (!confirmed) return;

        // Kill PTYs of panes that will be removed
        const newCount =
          LAYOUTS[newLayout] || 1;
        panes.slice(newCount).forEach((p) => {
          if (p.sessionId) ptyKill(p.sessionId).catch(() => {});
        });
      }
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
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
                title={l}
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

        <div className="terminal-view__status">
          <span
            className={`terminal-view__dot ${sessionCount > 0 ? "terminal-view__dot--connected" : ""}`}
          />
          {sessionCount > 0 ? "Active" : "Idle"}
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

      {/* Main content — terminal grid + optional chat sidebar */}
      <div className={`terminal-view__main ${chatOpen ? "terminal-view__main--chat-open" : ""}`}>
        <div className="terminal-view__body" data-layout={layout}>
          {panes.map((pane) => (
            <TerminalPane
              key={`${activeWorkspaceId}-${pane.id}`}
              paneId={pane.id}
              sessionId={pane.sessionId}
              isFocused={pane.id === focusedPaneId}
              showCloseBtn={panes.length > 1}
              vimEnabled={vimEnabled}
              onConnect={handlePaneConnect}
              onDisconnect={handlePaneDisconnect}
              onSessionId={handlePaneSessionId}
              onFocus={handlePaneFocus}
              onClose={handlePaneClose}
              customKeyHandler={handleShortcut}
              clearRef={clearRefs.current[pane.id]}
              reconnectRef={reconnectRefs.current[pane.id]}
              visible={true}
            />
          ))}
        </div>

        {/* AI Chat sidebar */}
        {chatOpen && (
          <TerminalChat
            workspaceId={activeWorkspaceId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            sessionId={
              panes.find((p) => p.id === focusedPaneId)?.sessionId ?? null
            }
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
        >
          <div
            className="terminal-leave-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, borderColor: "rgba(34, 197, 94, 0.25)" }}
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
                    color: "rgba(34,197,94,0.6)",
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
    </div>
  );
}
