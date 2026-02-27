/**
 * tauri-pty.ts — Thin wrapper around Tauri IPC for PTY operations.
 *
 * Replaces WebSocket communication from the web terminal with direct
 * Tauri invoke/listen calls to the Rust PTY backend.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SessionInfo {
  id: string;
  shell: string;
  cwd: string;
  pid: number;
  created_at: number;
}

export interface PtyOutputPayload {
  data: string;
}

export interface PtyExitPayload {
  code: number;
}

/** Spawn a new PTY session. Returns the session ID. */
export async function ptySpawn(
  shell?: string,
  cwd?: string,
  env?: Record<string, string>,
): Promise<string> {
  return invoke<string>("pty_spawn", { shell, cwd, env });
}

/** Write data to a PTY session's stdin. */
export async function ptyWrite(
  sessionId: string,
  data: string,
): Promise<void> {
  return invoke("pty_write", { sessionId, data });
}

/** Resize a PTY session. */
export async function ptyResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("pty_resize", { sessionId, cols, rows });
}

/** Kill a PTY session. */
export async function ptyKill(sessionId: string): Promise<void> {
  return invoke("pty_kill", { sessionId });
}

/** List all active PTY sessions. */
export async function ptyList(): Promise<SessionInfo[]> {
  return invoke<SessionInfo[]>("pty_list");
}

/** Get the detected default shell. */
export async function getDefaultShell(): Promise<string> {
  return invoke<string>("get_default_shell");
}

/** Read last N characters from a session's output ring buffer. */
export async function getTerminalOutput(
  sessionId: string,
  chars: number,
): Promise<string> {
  return invoke<string>("get_terminal_output", { sessionId, chars });
}

/** Check if a PTY session still exists on the backend. */
export async function ptySessionExists(sessionId: string): Promise<boolean> {
  return invoke<boolean>("pty_session_exists", { sessionId });
}

/** Listen for PTY output events for a specific session. */
export async function onPtyOutput(
  sessionId: string,
  callback: (data: string) => void,
): Promise<UnlistenFn> {
  return listen<PtyOutputPayload>(`pty-output-${sessionId}`, (event) => {
    callback(event.payload.data);
  });
}

/** Listen for PTY exit events for a specific session. */
export async function onPtyExit(
  sessionId: string,
  callback: (code: number) => void,
): Promise<UnlistenFn> {
  return listen<PtyExitPayload>(`pty-exit-${sessionId}`, (event) => {
    callback(event.payload.code);
  });
}
