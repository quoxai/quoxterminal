/**
 * useTerminalWorkspace — Multi-workspace terminal state management
 *
 * Manages tabbed workspaces, each with its own layout + panes.
 * Layout presets, per-pane state, focus tracking, and Tauri store persistence.
 *
 * Ported from quox-source/src/hooks/useTerminalWorkspace.js
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { TERMINAL_LIMITS } from "../config/terminalConfig";
import { storeGet, storeSet } from "../lib/store";

const STORAGE_KEY = "quox-terminal-workspaces";
const MAX_PANES = TERMINAL_LIMITS.MAX_PANES;
const MAX_WORKSPACES = TERMINAL_LIMITS.MAX_WORKSPACES;

// ── Types ────────────────────────────────────────────────────────────────────

export type LayoutPreset =
  | "single"
  | "split-h"
  | "split-v"
  | "main-side"
  | "side-main"
  | "top-split"
  | "split-top"
  | "quad";

export type PaneMode = "local" | "ssh" | "claude";

export interface PaneState {
  id: string;
  mode: PaneMode | string;
  hostId: string;
  connected: boolean;
  sessionId: string | null;
  /** Claude session ID (separate from PTY/SSH sessionId) */
  claudeSessionId?: string | null;
}

export interface WorkspaceState {
  id: string;
  name: string;
  layout: LayoutPreset;
  panes: PaneState[];
  focusedPaneId: string;
}

interface MultiWorkspaceState {
  activeWorkspaceId: string;
  workspaces: WorkspaceState[];
}

// ── Layout presets ───────────────────────────────────────────────────────────

export const LAYOUTS: Record<LayoutPreset, number> = {
  single: 1,
  "split-h": 2,
  "split-v": 2,
  "main-side": 3,
  "side-main": 3,
  "top-split": 3,
  "split-top": 3,
  quad: 4,
};

export function getLayoutPaneCount(layout: LayoutPreset): number {
  return LAYOUTS[layout] || 1;
}

export function createDefaultPane(
  index: number,
  overrides: Partial<PaneState> = {},
): PaneState {
  return {
    id: `pane-${index}`,
    mode: "local",
    hostId: "",
    connected: false,
    sessionId: null,
    claudeSessionId: null,
    ...overrides,
  };
}

export function buildPanesForLayout(
  layout: LayoutPreset,
  existingPanes: PaneState[] = [],
  clearSessionIds = false,
): PaneState[] {
  const count = getLayoutPaneCount(layout);
  const panes: PaneState[] = [];
  for (let i = 0; i < count; i++) {
    if (existingPanes[i]) {
      const pane = { ...existingPanes[i] };
      if (clearSessionIds) {
        pane.sessionId = null;
        pane.connected = false;
      }
      // Preserve connected state when session is alive (reconnection support)
      // Only reset connected if there's no sessionId to reconnect to
      if (!pane.sessionId) {
        pane.connected = false;
      }
      panes.push(pane);
    } else {
      panes.push(createDefaultPane(i));
    }
  }
  return panes;
}

export function createDefaultWorkspace(
  index: number,
  overrides: Partial<WorkspaceState> = {},
): WorkspaceState {
  return {
    id: `ws-${index}`,
    name: `Workspace ${index + 1}`,
    layout: "single",
    panes: [createDefaultPane(0)],
    focusedPaneId: "pane-0",
    ...overrides,
  };
}

export function getSessionsToLose(
  currentPanes: PaneState[],
  newLayout: LayoutPreset,
): number {
  const newCount = getLayoutPaneCount(newLayout);
  if (newCount >= currentPanes.length) return 0;
  const removedPanes = currentPanes.slice(newCount);
  return removedPanes.filter((p) => p.connected).length;
}

// ── Internals ────────────────────────────────────────────────────────────────

let wsCounter = 0;
function nextWorkspaceId(): string {
  return `ws-${Date.now()}-${wsCounter++}`;
}

function saveToStorage(state: MultiWorkspaceState): void {
  const data = {
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: state.workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      layout: ws.layout,
      panes: ws.panes.map((p) => ({
        id: p.id,
        mode: p.mode,
        hostId: p.hostId,
        sessionId: p.sessionId || null,
      })),
      focusedPaneId: ws.focusedPaneId,
    })),
  };
  storeSet(STORAGE_KEY, data).catch(() => {});
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export default function useTerminalWorkspace() {
  const [state, setState] = useState<MultiWorkspaceState>({
    activeWorkspaceId: "ws-0",
    workspaces: [createDefaultWorkspace(0)],
  });

  const initializedRef = useRef(false);

  // Load persisted state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    storeGet<MultiWorkspaceState>(STORAGE_KEY).then((stored) => {
      if (
        stored &&
        Array.isArray(stored.workspaces) &&
        stored.workspaces.length > 0
      ) {
        const workspaces = stored.workspaces.map((ws) => ({
          ...ws,
          panes: buildPanesForLayout(
            ws.layout as LayoutPreset,
            ws.panes as PaneState[],
            false,
          ),
        }));
        setState({
          activeWorkspaceId:
            stored.activeWorkspaceId || workspaces[0].id,
          workspaces,
        });
      }
    });
  }, []);

  // Debounced persistence
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveToStorage(state), 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getActiveWs = useCallback(
    (s: MultiWorkspaceState): WorkspaceState => {
      return (
        s.workspaces.find((ws) => ws.id === s.activeWorkspaceId) ||
        s.workspaces[0]
      );
    },
    [],
  );

  const updateActiveWs = useCallback(
    (updater: (ws: WorkspaceState) => WorkspaceState) => {
      setState((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((ws) =>
          ws.id === prev.activeWorkspaceId ? updater(ws) : ws,
        ),
      }));
    },
    [],
  );

  const updateWorkspace = useCallback(
    (wsId: string, updater: (ws: WorkspaceState) => WorkspaceState) => {
      setState((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((ws) =>
          ws.id === wsId ? updater(ws) : ws,
        ),
      }));
    },
    [],
  );

  // ── Workspace-level actions ──────────────────────────────────────────────

  const setLayout = useCallback(
    (newLayout: LayoutPreset) => {
      if (!LAYOUTS[newLayout]) return;
      updateActiveWs((ws) => {
        const panes = buildPanesForLayout(newLayout, ws.panes);
        const focusedPaneId = panes.find((p) => p.id === ws.focusedPaneId)
          ? ws.focusedPaneId
          : "pane-0";
        return { ...ws, layout: newLayout, panes, focusedPaneId };
      });
    },
    [updateActiveWs],
  );

  const updatePane = useCallback(
    (
      paneId: string,
      updates: Partial<PaneState>,
      workspaceId: string | null = null,
    ) => {
      const updater = (ws: WorkspaceState): WorkspaceState => ({
        ...ws,
        panes: ws.panes.map((p) => {
          if (p.id !== paneId) return p;
          const updated = { ...p, ...updates };
          if (updates.mode === "local") updated.hostId = "";
          if (updates.mode !== undefined || updates.hostId !== undefined) {
            updated.sessionId = null;
          }
          // Clear claude session on mode change away from claude
          if (updates.mode !== undefined && updates.mode !== "claude") {
            updated.claudeSessionId = null;
          }
          return updated;
        }),
      });
      if (workspaceId) {
        updateWorkspace(workspaceId, updater);
      } else {
        updateActiveWs(updater);
      }
    },
    [updateActiveWs, updateWorkspace],
  );

  const setPaneConnected = useCallback(
    (
      paneId: string,
      connected: boolean,
      workspaceId: string | null = null,
    ) => {
      const updater = (ws: WorkspaceState): WorkspaceState => ({
        ...ws,
        panes: ws.panes.map((p) =>
          p.id === paneId ? { ...p, connected } : p,
        ),
      });
      if (workspaceId) {
        updateWorkspace(workspaceId, updater);
      } else {
        updateActiveWs(updater);
      }
    },
    [updateActiveWs, updateWorkspace],
  );

  const setPaneSessionId = useCallback(
    (
      paneId: string,
      sessionId: string | null,
      workspaceId: string | null = null,
    ) => {
      const updater = (ws: WorkspaceState): WorkspaceState => ({
        ...ws,
        panes: ws.panes.map((p) =>
          p.id === paneId ? { ...p, sessionId } : p,
        ),
      });
      if (workspaceId) {
        updateWorkspace(workspaceId, updater);
      } else {
        updateActiveWs(updater);
      }
    },
    [updateActiveWs, updateWorkspace],
  );

  const setFocusedPane = useCallback(
    (paneId: string) => {
      updateActiveWs((ws) => ({ ...ws, focusedPaneId: paneId }));
    },
    [updateActiveWs],
  );

  const resetWorkspace = useCallback(() => {
    updateActiveWs((ws) => ({
      ...ws,
      name: "Workspace 1",
      layout: "single" as LayoutPreset,
      panes: [createDefaultPane(0)],
      focusedPaneId: "pane-0",
    }));
  }, [updateActiveWs]);

  // ── Tab-level actions ────────────────────────────────────────────────────

  const addWorkspace = useCallback(() => {
    setState((prev) => {
      if (prev.workspaces.length >= MAX_WORKSPACES) return prev;
      const newWs = createDefaultWorkspace(0, { id: nextWorkspaceId() });
      newWs.name = `Workspace ${prev.workspaces.length + 1}`;
      return {
        activeWorkspaceId: newWs.id,
        workspaces: [...prev.workspaces, newWs],
      };
    });
  }, []);

  const removeWorkspace = useCallback((wsId: string) => {
    setState((prev) => {
      if (prev.workspaces.length <= 1) return prev;
      const filtered = prev.workspaces.filter((ws) => ws.id !== wsId);
      let activeId = prev.activeWorkspaceId;
      if (activeId === wsId) {
        const removedIdx = prev.workspaces.findIndex(
          (ws) => ws.id === wsId,
        );
        activeId =
          filtered[Math.min(removedIdx, filtered.length - 1)].id;
      }
      return { activeWorkspaceId: activeId, workspaces: filtered };
    });
  }, []);

  const renameWorkspace = useCallback((wsId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((ws) =>
        ws.id === wsId ? { ...ws, name: name.trim() || ws.name } : ws,
      ),
    }));
  }, []);

  const setActiveWorkspace = useCallback((wsId: string) => {
    setState((prev) => {
      if (!prev.workspaces.find((ws) => ws.id === wsId)) return prev;
      return { ...prev, activeWorkspaceId: wsId };
    });
  }, []);

  const duplicateWorkspace = useCallback((wsId: string) => {
    setState((prev) => {
      if (prev.workspaces.length >= MAX_WORKSPACES) return prev;
      const source = prev.workspaces.find((ws) => ws.id === wsId);
      if (!source) return prev;
      const newWs: WorkspaceState = {
        ...source,
        id: nextWorkspaceId(),
        name: `${source.name} (copy)`,
        panes: source.panes.map((p) => ({
          ...p,
          connected: false,
          sessionId: null,
        })),
      };
      return {
        activeWorkspaceId: newWs.id,
        workspaces: [...prev.workspaces, newWs],
      };
    });
  }, []);

  // ── Derived state ────────────────────────────────────────────────────────

  const activeWs = getActiveWs(state);
  const layout = activeWs.layout;
  const panes = activeWs.panes;
  const focusedPaneId = activeWs.focusedPaneId;
  const activePaneCount = panes.length;
  const sessionCount = panes.filter((p) => p.connected).length;
  const canAddPane = activePaneCount < MAX_PANES;
  const workspaceCount = state.workspaces.length;
  const workspaceWarning =
    workspaceCount >= TERMINAL_LIMITS.WORKSPACE_WARN_THRESHOLD
      ? `${workspaceCount}/${MAX_WORKSPACES} workspaces used`
      : null;

  return {
    layout,
    panes,
    focusedPaneId,
    activePaneCount,
    sessionCount,
    canAddPane,

    setLayout,
    updatePane,
    setPaneConnected,
    setPaneSessionId,
    setFocusedPane,
    resetWorkspace,

    workspaces: state.workspaces,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaceCount,
    workspaceWarning,

    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    setActiveWorkspace,
    duplicateWorkspace,
  };
}

export { MAX_PANES, MAX_WORKSPACES };
