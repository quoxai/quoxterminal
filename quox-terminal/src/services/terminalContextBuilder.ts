/**
 * Terminal Context Builder
 *
 * Builds AI context from terminal output + mode policy for the QuoxCode assistant.
 * Called by TerminalChat's contextBuilder on every chat message.
 *
 * Supports both local PTY sessions and remote SSH sessions — fetches output
 * from the appropriate ring buffer and includes session type metadata.
 *
 * Flow:
 *   1. Fetch terminal output from PTY or SSH ring buffer via Tauri command
 *   2. Strip ANSI escape codes so AI sees clean text
 *   3. Compose: MODE_POLICY_BLOCK + SESSION_INFO + TERMINAL_OUTPUT + ERROR_CONTEXT
 *   4. Return composed string
 */

import { getTerminalOutput } from '../lib/tauri-pty';
import { sshGetOutput, sshSessionExists } from '../lib/tauri-ssh';
import { MODE_POLICIES, DEFAULT_MODE, type ModeId } from '../config/terminalModes';

const MAX_OUTPUT_CHARS = 4000;

/** Session info passed from the workspace to enrich context. */
export interface SessionContext {
  sessionId: string | null;
  mode: ModeId;
  /** "local" | "ssh" */
  sessionType?: string;
  /** e.g. "root@docker01" */
  hostId?: string;
  /** Pre-filled error context (from ErrorNotificationBar "Explain"/"Fix") */
  errorContext?: {
    errorType: string;
    errorLine: string;
    suggestion: string;
    action: 'explain' | 'fix';
  } | null;
}

/**
 * Strip ANSI escape sequences and control characters from raw PTY output.
 *
 * Raw terminal output contains:
 *   - SGR (colors/styles):       \x1B[32m ... \x1B[0m
 *   - CSI sequences (cursor etc): \x1B[2A, \x1B[?2004h (bracketed paste)
 *   - OSC (window title):         \x1B]0;title\x07
 *   - Character set / keypad:     \x1B(B, \x1B>, \x1B=
 *   - Backspace echoes:           \x08 (BS) from readline editing
 *   - Other control chars:        \x00-\x1F except \n \r \t
 *
 * We also simulate backspace: "ab\x08c" -> "ac" (character deletion).
 */
export function stripAnsi(text: string): string {
  if (!text) return '';

  // 1. Strip all ESC sequences (CSI with optional ? > ! prefixes, OSC, charset, keypad)
  let clean = text.replace(
    // eslint-disable-next-line no-control-regex
    /\x1B(?:\[[?>=!]?[0-9;]*[A-Za-z]|\][^\x07]*\x07|\([A-Z]|[>=])/g,
    ''
  );

  // 2. Simulate backspace: each \x08 deletes the preceding character
  // eslint-disable-next-line no-control-regex
  while (/[^\x08]\x08/.test(clean)) {
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[^\x08\n]\x08/g, '');
  }
  // Remove any remaining orphan backspaces
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/\x08/g, '');

  // 3. Strip remaining control chars except \n \r \t
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return clean;
}

/**
 * Fetch terminal output from either local PTY or SSH ring buffer.
 */
async function fetchOutput(
  sessionId: string,
  sessionType: string,
  chars: number = MAX_OUTPUT_CHARS
): Promise<string | null> {
  if (!sessionId) return null;

  try {
    if (sessionType === 'ssh') {
      // Check if SSH session still exists
      const exists = await sshSessionExists(sessionId);
      if (!exists) return null;
      const output = await sshGetOutput(sessionId, chars);
      return output || null;
    } else {
      const output = await getTerminalOutput(sessionId, chars);
      return output || null;
    }
  } catch (err) {
    console.warn('[terminalContextBuilder] Failed to fetch output:', err);
    return null;
  }
}

/**
 * Build the full dynamic context string for the AI chat.
 *
 * Returns: MODE_POLICY_BLOCK + SESSION_INFO + TERMINAL_OUTPUT + ERROR_CONTEXT
 */
export async function buildTerminalContext(
  query: string,
  sessionId: string | null,
  mode: ModeId = DEFAULT_MODE,
  ctx?: Partial<SessionContext>
): Promise<string> {
  const sessionType = ctx?.sessionType || 'local';
  const hostId = ctx?.hostId || '';
  const errorContext = ctx?.errorContext || null;
  const sections: string[] = [];

  // 1. Mode policy block (always included — defines behavior posture)
  const modePolicy = MODE_POLICIES[mode] || MODE_POLICIES[DEFAULT_MODE];
  sections.push(modePolicy);

  // 2. Session info (tells AI where the terminal is connected)
  if (sessionType === 'ssh' && hostId) {
    sections.push(
      `## Session Info\n\n` +
      `- **Type**: SSH (remote)\n` +
      `- **Target**: ${hostId}\n` +
      `- **Connection**: Connected via bastion/SSH\n\n` +
      `Commands will execute on the remote host. ` +
      `Tailor suggestions to the remote environment.`
    );
  } else if (sessionId) {
    sections.push(
      `## Session Info\n\n` +
      `- **Type**: Local shell\n` +
      `- **Session ID**: ${sessionId.slice(0, 8)}...\n\n` +
      `Commands execute locally on the user's machine.`
    );
  }

  // 3. Terminal output section
  if (sessionId) {
    const rawOutput = await fetchOutput(sessionId, sessionType, MAX_OUTPUT_CHARS);
    if (rawOutput) {
      const cleanOutput = stripAnsi(rawOutput);
      const trimmedOutput = cleanOutput.length > MAX_OUTPUT_CHARS
        ? cleanOutput.slice(-MAX_OUTPUT_CHARS)
        : cleanOutput;

      const label = sessionType === 'ssh'
        ? `Terminal Output (SSH: ${hostId || 'remote'})`
        : 'Terminal Output (local shell)';

      sections.push(
        `## ${label}\n\n` +
        '```\n' +
        trimmedOutput +
        '\n```\n\n' +
        'Use this terminal output as context when answering the user\'s question. ' +
        'Reference specific lines or errors when relevant.'
      );
    } else {
      sections.push(
        '## Terminal Output\n\n' +
        'No terminal output available. The terminal session may not be connected or may have no output yet.'
      );
    }
  } else {
    sections.push(
      '## Terminal Output\n\n' +
      'No terminal session is currently focused. The user may not have an active terminal pane.'
    );
  }

  // 4. Error context (from ErrorNotificationBar "Explain" or "Fix" action)
  if (errorContext) {
    const actionLabel = errorContext.action === 'fix' ? 'Fix Request' : 'Error Explanation Request';
    sections.push(
      `## ${actionLabel}\n\n` +
      `The user clicked "${errorContext.action === 'fix' ? 'Fix' : 'Explain'}" on a detected terminal error.\n\n` +
      `- **Error type**: ${errorContext.errorType.replace(/_/g, ' ')}\n` +
      `- **Error line**: \`${errorContext.errorLine}\`\n` +
      `- **Initial suggestion**: ${errorContext.suggestion}\n\n` +
      (errorContext.action === 'fix'
        ? 'Provide a specific, actionable fix. Include the exact command(s) to run.'
        : 'Explain what this error means, why it happened, and how to fix it.')
    );
  }

  return sections.join('\n\n---\n\n');
}
