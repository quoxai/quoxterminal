/**
 * tauri-claude.ts — Tauri command wrappers for Claude Mode
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * Spawn a new Claude CLI session.
 * Returns the session UUID. Events emitted as `claude-event-{id}`.
 */
export async function claudeSpawn(
  cwd: string,
  args?: string[],
): Promise<string> {
  return invoke<string>("claude_spawn", { cwd, args: args || null });
}

/**
 * Write data to a Claude CLI session's stdin.
 */
export async function claudeWrite(
  sessionId: string,
  data: string,
): Promise<void> {
  return invoke<void>("claude_write", { sessionId, data });
}

/**
 * Kill a Claude CLI session.
 */
export async function claudeKill(sessionId: string): Promise<void> {
  return invoke<void>("claude_kill", { sessionId });
}

/**
 * Detect whether a directory is a Claude Code project.
 */
export interface ClaudeProjectInfo {
  has_claude_md: boolean;
  has_claude_dir: boolean;
  has_settings: boolean;
  claude_md_path: string | null;
  is_claude_project: boolean;
}

export async function detectClaudeProject(
  cwd: string,
): Promise<ClaudeProjectInfo> {
  return invoke<ClaudeProjectInfo>("detect_claude_project", { cwd });
}
