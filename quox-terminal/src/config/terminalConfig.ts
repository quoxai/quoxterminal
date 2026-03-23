/**
 * terminalConfig.ts — Centralized terminal constants
 *
 * Single source of truth for keyboard shortcuts and architecture limits.
 * Ported from quox-source with platform-aware shortcuts (Cmd on macOS, Ctrl elsewhere).
 */

const isMac =
  typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
const modKey = isMac ? "Cmd" : "Ctrl";

// ── Architecture Limits ──────────────────────────────────────────────────────
export const TERMINAL_LIMITS = {
  MAX_PANES: 4,
  MAX_WORKSPACES: 8,
  MAX_SCROLLBACK: 5000,
  WORKSPACE_WARN_THRESHOLD: 7,
};

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────
export interface ShortcutItem {
  keys: string[];
  ctrl: boolean;
  shift: boolean;
  key: string;
  action: string;
  description: string;
}

export interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

export const TERMINAL_SHORTCUTS: ShortcutCategory[] = [
  {
    category: "Pane Focus",
    items: [
      {
        keys: [modKey, "1"],
        ctrl: true,
        shift: false,
        key: "1",
        action: "focusPane0",
        description: "Focus pane 1",
      },
      {
        keys: [modKey, "2"],
        ctrl: true,
        shift: false,
        key: "2",
        action: "focusPane1",
        description: "Focus pane 2",
      },
      {
        keys: [modKey, "3"],
        ctrl: true,
        shift: false,
        key: "3",
        action: "focusPane2",
        description: "Focus pane 3",
      },
      {
        keys: [modKey, "4"],
        ctrl: true,
        shift: false,
        key: "4",
        action: "focusPane3",
        description: "Focus pane 4",
      },
    ],
  },
  {
    category: "Terminal",
    items: [
      {
        keys: [modKey, "\\"],
        ctrl: true,
        shift: false,
        key: "\\",
        action: "toggleChat",
        description: "Toggle AI chat",
      },
      {
        keys: [modKey, "Shift", "L"],
        ctrl: true,
        shift: true,
        key: "L",
        action: "clearTerminal",
        description: "Clear focused terminal",
      },
      {
        keys: [modKey, "Shift", "T"],
        ctrl: true,
        shift: true,
        key: "T",
        action: "toggleTools",
        description: "Toggle tool palette",
      },
    ],
  },
  {
    category: "Workspaces",
    items: [
      {
        keys: [modKey, "Shift", "N"],
        ctrl: true,
        shift: true,
        key: "N",
        action: "newWorkspace",
        description: "New workspace tab",
      },
      {
        keys: [modKey, "Shift", "W"],
        ctrl: true,
        shift: true,
        key: "W",
        action: "closeWorkspace",
        description: "Close current workspace",
      },
    ],
  },
  {
    category: "Agent Teams",
    items: [
      {
        keys: [modKey, "Shift", "A"],
        ctrl: true,
        shift: true,
        key: "A",
        action: "toggleTeams",
        description: "Toggle Agent Teams modal",
      },
    ],
  },
  {
    category: "Claude Mode",
    items: [
      {
        keys: [modKey, "Shift", "K"],
        ctrl: true,
        shift: true,
        key: "K",
        action: "toggleClaudeMode",
        description: "Toggle Claude mode on focused pane",
      },
    ],
  },
  {
    category: "Vim",
    items: [
      {
        keys: [modKey, "Shift", "V"],
        ctrl: true,
        shift: true,
        key: "V",
        action: "toggleVim",
        description: "Toggle vim keybindings",
      },
    ],
  },
  {
    category: "Help",
    items: [
      {
        keys: [modKey, "?"],
        ctrl: true,
        shift: false,
        key: "?",
        action: "showShortcuts",
        description: "Show keyboard shortcuts",
      },
    ],
  },
];

/**
 * Match a KeyboardEvent against the shortcut definitions.
 * Returns the action string if matched, null otherwise.
 */
export function matchShortcut(event: KeyboardEvent): string | null {
  // Don't intercept shortcuts when typing in form fields
  const target = event.target as HTMLElement;
  if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) {
    return null;
  }

  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;

  for (const category of TERMINAL_SHORTCUTS) {
    for (const shortcut of category.items) {
      if (
        ctrl === shortcut.ctrl &&
        shift === shortcut.shift &&
        key === shortcut.key
      ) {
        return shortcut.action;
      }
    }
  }
  return null;
}

// ── Vim Keybindings ──────────────────────────────────────────────────────────
export const VIM_BINDINGS = {
  INSERT_KEYS: ["i", "a"] as const,
  SCROLL_LINE_DOWN: "j",
  SCROLL_LINE_UP: "k",
  SCROLL_HALF_PAGE_DOWN: "d",
  SCROLL_HALF_PAGE_UP: "u",
  SCROLL_TO_BOTTOM: "G",
  SCROLL_TO_TOP_TRIGGER: "g",
  GG_TIMEOUT_MS: 1000,
};
