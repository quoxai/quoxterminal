/** Unique identifier for a PTY session */
export type SessionId = string;

/** Information about an active PTY session */
export interface SessionInfo {
  id: SessionId;
  shell: string;
  cwd: string;
  pid: number;
  createdAt: number;
}

/** PTY spawn options */
export interface PtySpawnOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

/** PTY output event payload */
export interface PtyOutputPayload {
  data: string;
}

/** PTY exit event payload */
export interface PtyExitPayload {
  code: number;
}

/** Terminal dimensions */
export interface TerminalDimensions {
  cols: number;
  rows: number;
}

/** Terminal pane state */
export interface PaneState {
  id: string;
  sessionId: SessionId | null;
  title: string;
}

/** Layout preset names */
export type LayoutPreset =
  | "single"
  | "split-h"
  | "split-v"
  | "main-side"
  | "side-main"
  | "top-split"
  | "split-top"
  | "quad";

/** Workspace tab state */
export interface WorkspaceTab {
  id: string;
  name: string;
  layout: LayoutPreset;
  panes: PaneState[];
  activePaneId: string;
}

/** Terminal theme colors */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/** Application settings */
export interface AppSettings {
  fontFamily: string;
  fontSize: number;
  theme: string;
  defaultShell: string;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  scrollback: number;
  globalHotkey: string;
}
