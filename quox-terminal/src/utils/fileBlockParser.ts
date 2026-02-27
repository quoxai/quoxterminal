/**
 * fileBlockParser — Splits assistant messages into markdown + file-operation segments.
 *
 * Detects ```file:(create|edit|delete|rename):path fences in assistant text
 * and separates them from regular markdown so TerminalChat can render
 * FileChangeCard components for file blocks and ChatMd for the rest.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface MarkdownSegment {
  type: 'markdown';
  text: string;
}

export interface FileSegment {
  type: 'file';
  action: string;       // 'create' | 'edit' | 'delete' | 'rename'
  filePath: string;
  targetPath?: string;   // For rename: the destination path
  content: string;       // File content (create/edit) or reason (delete/rename)
  meta: Record<string, unknown> | null;
}

export type MessageSegment = MarkdownSegment | FileSegment;

// ── Regex ────────────────────────────────────────────────────────────

// Matches: ```file:action:path  or  ```file:action:path meta-json
// Actions: create, edit, delete, rename
const FILE_FENCE_OPEN = /^```file:(create|edit|delete|rename):(.+?)(?:\s+({.+}))?\s*$/;
const CODE_FENCE_CLOSE = /^```\s*$/;

// ── Parser ───────────────────────────────────────────────────────────

/**
 * Parse an assistant message into segments of markdown text and file operations.
 *
 * Regular code blocks (```bash, ```json, etc.) are left as-is in markdown segments.
 * Only ```file:(create|edit|delete|rename):path fences produce FileSegments.
 */
export function parseFileBlocks(text: string): MessageSegment[] {
  if (!text) return [{ type: 'markdown', text: '' }];

  // Quick check: if no file fences, return as single markdown segment
  if (!text.includes('```file:')) {
    return [{ type: 'markdown', text }];
  }

  const lines = text.split('\n');
  const segments: MessageSegment[] = [];
  let markdownLines: string[] = [];
  let inFileBlock = false;
  let currentAction = '';
  let currentFilePath = '';
  let currentTargetPath: string | undefined;
  let currentMeta: Record<string, unknown> | null = null;
  let fileContentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFileBlock) {
      const match = line.match(FILE_FENCE_OPEN);
      if (match) {
        // Flush accumulated markdown
        if (markdownLines.length > 0) {
          const mdText = markdownLines.join('\n').trim();
          if (mdText) {
            segments.push({ type: 'markdown', text: mdText });
          }
          markdownLines = [];
        }

        inFileBlock = true;
        currentAction = match[1];
        currentFilePath = match[2].trim();
        currentTargetPath = undefined;
        currentMeta = null;
        fileContentLines = [];

        // Parse meta JSON if present
        if (match[3]) {
          try {
            currentMeta = JSON.parse(match[3]);
          } catch {
            currentMeta = null;
          }
        }

        // For rename, path format is "old/path -> new/path"
        if (currentAction === 'rename' && currentFilePath.includes(' -> ')) {
          const parts = currentFilePath.split(' -> ');
          currentFilePath = parts[0].trim();
          currentTargetPath = parts[1].trim();
        }
      } else {
        markdownLines.push(line);
      }
    } else {
      // Inside a file block — looking for closing ```
      if (CODE_FENCE_CLOSE.test(line)) {
        inFileBlock = false;
        segments.push({
          type: 'file',
          action: currentAction,
          filePath: currentFilePath,
          targetPath: currentTargetPath,
          content: fileContentLines.join('\n'),
          meta: currentMeta,
        });
      } else {
        fileContentLines.push(line);
      }
    }
  }

  // Flush remaining markdown
  if (markdownLines.length > 0) {
    const mdText = markdownLines.join('\n').trim();
    if (mdText) {
      segments.push({ type: 'markdown', text: mdText });
    }
  }

  // If we were still in a file block at EOF (unclosed fence), add it as-is
  if (inFileBlock) {
    segments.push({
      type: 'file',
      action: currentAction,
      filePath: currentFilePath,
      targetPath: currentTargetPath,
      content: fileContentLines.join('\n'),
      meta: currentMeta,
    });
  }

  return segments.length > 0 ? segments : [{ type: 'markdown', text }];
}

/**
 * Quick check: does this message contain any file operation fences?
 */
export function hasFileBlocks(text: string): boolean {
  return /```file:(create|edit|delete|rename):/.test(text);
}
