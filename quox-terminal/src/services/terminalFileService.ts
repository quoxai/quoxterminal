/**
 * Terminal File Service
 *
 * Client-side service for AI-proposed file creation and editing.
 * Handles parsing structured file blocks from AI markdown responses, path validation,
 * diff computation, and Tauri invoke calls for file operations.
 *
 * Ported from quox-source/src/services/terminalFileService.js
 * - Replaced HTTP calls to collector with Tauri invoke calls
 * - Implemented inline line diff (replaces 'diff' npm package)
 */

import { invoke } from '@tauri-apps/api/core';

// ---- Types -----------------------------------------------------------------

export type FileAction = 'create' | 'edit' | 'delete' | 'rename';
export type PathSeverity = 'GREEN' | 'AMBER' | 'RED' | 'BLOCKED';

export interface FileBlock {
  action: FileAction;
  filePath: string;
  targetPath?: string;
  content: string;
  meta: Record<string, unknown> | null;
}

export interface PathValidation {
  valid: boolean;
  severity: PathSeverity;
  reason?: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: { added: number; removed: number; context: number };
}

export interface FilePolicy {
  showApplyButtons: boolean;
  requireConfirmModal: boolean;
}

export interface WriteFileResult {
  ok: boolean;
  error?: string;
  backupPath?: string;
}

export interface ReadFileResult {
  ok: boolean;
  content?: string;
  error?: string;
}

// ---- Mode File Policies (inlined, avoids circular config deps) -------------

const MODE_FILE_POLICIES: Record<string, FilePolicy> = {
  strict:   { showApplyButtons: true,  requireConfirmModal: true  },
  balanced: { showApplyButtons: true,  requireConfirmModal: false },
  builder:  { showApplyButtons: true,  requireConfirmModal: false },
  audit:    { showApplyButtons: false, requireConfirmModal: false },
};

// ---- File block parsing ----------------------------------------------------

const FILE_BLOCK_PATTERN = /^file:(create|edit|delete|rename):(\/.+)$/;

const PATH_RULES = {
  blocked: [
    /\.\./,             // directory traversal
    /\x00/,             // null bytes
  ],
  red: [
    /^\/dev\//,
    /^\/proc\//,
    /^\/sys\//,
    /^\/boot\//,
  ],
  amber: [
    /^\/etc\//,
    /^\/opt\//,
    /^\/var\//,
  ],
};

/**
 * Parse a file block from ReactMarkdown's language string and code content.
 */
export function parseFileBlock(language: string, codeText: string): FileBlock | null {
  if (!language || !codeText) return null;

  const match = language.match(FILE_BLOCK_PATTERN);
  if (!match) return null;

  const action = match[1] as FileAction;
  const pathPart = match[2];

  // Extract optional #quox-meta JSON from first line
  let content = codeText;
  let meta: Record<string, unknown> | null = null;

  const lines = codeText.split('\n');
  if (lines[0] && lines[0].startsWith('#quox-meta:')) {
    try {
      meta = JSON.parse(lines[0].slice('#quox-meta:'.length).trim());
    } catch {
      // invalid meta -- treat as content
    }
    if (meta) {
      content = lines.slice(1).join('\n');
    }
  }

  // Trim trailing newline (markdown parsers often add one)
  if (content.endsWith('\n')) {
    content = content.slice(0, -1);
  }

  // Rename: split dual paths -- file:rename:/old/path:/new/path
  if (action === 'rename') {
    const colonIdx = pathPart.indexOf(':', 1); // skip first char (root /)
    if (colonIdx === -1 || !pathPart.slice(colonIdx + 1).startsWith('/')) return null;
    const oldPath = pathPart.slice(0, colonIdx);
    const newPath = pathPart.slice(colonIdx + 1);
    return { action, filePath: oldPath, targetPath: newPath, content, meta };
  }

  // Delete: content body is optional (reason text)
  if (action === 'delete') {
    return { action, filePath: pathPart, content, meta };
  }

  return { action, filePath: pathPart, content, meta };
}

/**
 * Validate a file path and return a severity classification.
 */
export function validateFilePath(filePath: string): PathValidation {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, severity: 'BLOCKED', reason: 'Empty path' };
  }

  if (!filePath.startsWith('/')) {
    return { valid: false, severity: 'BLOCKED', reason: 'Path must be absolute' };
  }

  // Check blocked patterns
  for (const pattern of PATH_RULES.blocked) {
    if (pattern.test(filePath)) {
      return { valid: false, severity: 'BLOCKED', reason: 'Path contains blocked pattern' };
    }
  }

  // Check red (dangerous system paths)
  for (const pattern of PATH_RULES.red) {
    if (pattern.test(filePath)) {
      return { valid: true, severity: 'RED', reason: 'System path -- high risk' };
    }
  }

  // Check amber (sensitive paths)
  for (const pattern of PATH_RULES.amber) {
    if (pattern.test(filePath)) {
      return { valid: true, severity: 'AMBER', reason: 'Sensitive path -- review carefully' };
    }
  }

  return { valid: true, severity: 'GREEN' };
}

/**
 * Write a file via Tauri invoke.
 * For edit actions, the Rust backend creates a backup before writing.
 * For restore actions, the backup file is copied back.
 */
export async function writeFile(
  _sessionId: string,
  filePath: string,
  content: string,
  action: string,
  _authFetch?: unknown,
  extra?: { targetPath?: string; backupPath?: string },
): Promise<WriteFileResult> {
  if (!filePath || !filePath.startsWith('/')) {
    return { ok: false, error: 'Invalid file path' };
  }

  try {
    if (action === 'restore' && extra?.backupPath) {
      // Restore from backup: read backup, write to original path
      const backupContent = await invoke<string>('fs_read_file', { path: extra.backupPath });
      await invoke('fs_write_file', { path: filePath, content: backupContent, backup: false });
      return { ok: true };
    }

    if (action === 'delete') {
      await invoke('fs_delete_file', { path: filePath, backup: true });
      return { ok: true, backupPath: `${filePath}.quox-backup` };
    }

    if (action === 'rename' && extra?.targetPath) {
      await invoke('fs_rename_file', { oldPath: filePath, newPath: extra.targetPath });
      return { ok: true, backupPath: filePath };
    }

    // create or edit
    const needsBackup = action === 'edit';
    await invoke('fs_write_file', { path: filePath, content, backup: needsBackup });
    return {
      ok: true,
      backupPath: needsBackup ? `${filePath}.quox-backup` : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Read the current content of a file via Tauri invoke.
 * Used to compute diffs for file:edit blocks.
 */
export async function readFile(
  _sessionId: string,
  filePath: string,
  _authFetch?: unknown,
): Promise<ReadFileResult> {
  if (!filePath || !filePath.startsWith('/')) {
    return { ok: false, error: 'Invalid file path' };
  }

  try {
    const content = await invoke<string>('fs_read_file', { path: filePath });
    return { ok: true, content };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Compute a line-level diff between original and modified file content.
 * Simple inline implementation (no external 'diff' package).
 * Uses a basic LCS-based approach for line diffing.
 */
export function computeDiff(original: string, modified: string): DiffResult {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;

  // Optimize: use 1D rolling array for LCS lengths
  const prev = new Array<number>(n + 1).fill(0);
  const curr = new Array<number>(n + 1).fill(0);

  // We need the full table for backtracking, so build it
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array<number>(n + 1).fill(0);
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const lines: DiffLine[] = [];
  let i = m;
  let j = n;

  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'context', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }

  // Reverse since we built it backwards
  result.reverse();

  const stats = { added: 0, removed: 0, context: 0 };
  for (const line of result) {
    stats[line.type]++;
  }

  return { lines: result, stats };
}

/**
 * Get file policy for the current mode.
 */
export function getFilePolicy(mode: string): FilePolicy {
  return MODE_FILE_POLICIES[mode] || MODE_FILE_POLICIES.balanced;
}
