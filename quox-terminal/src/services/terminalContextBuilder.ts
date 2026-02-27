/**
 * Terminal Context Builder
 *
 * Builds AI context from terminal output + mode policy for the QuoxCode assistant.
 * Called by TerminalChat's contextBuilder on every chat message.
 *
 * Flow:
 *   1. Fetch terminal output from PTY ring buffer via Tauri command
 *   2. Strip ANSI escape codes so AI sees clean text
 *   3. Compose: MODE_POLICY_BLOCK + TERMINAL_OUTPUT section
 *   4. Return composed string
 */

import { getTerminalOutput } from '../lib/tauri-pty';
import { MODE_POLICIES, DEFAULT_MODE, type ModeId } from '../config/terminalModes';

const MAX_OUTPUT_CHARS = 4000;

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
 * Fetch terminal output from the PTY ring buffer via Tauri command.
 */
export async function fetchTerminalOutput(
  sessionId: string,
  chars: number = MAX_OUTPUT_CHARS
): Promise<string | null> {
  if (!sessionId) {
    console.log('[terminalContextBuilder] fetchTerminalOutput: no sessionId');
    return null;
  }

  try {
    console.log(`[terminalContextBuilder] Fetching output for session ${sessionId}, chars=${chars}`);
    const output = await getTerminalOutput(sessionId, chars);
    console.log(`[terminalContextBuilder] Got output: ${output?.length || 0} chars`);
    return output || null;
  } catch (err) {
    console.warn('[terminalContextBuilder] Failed to fetch output:', err);
    return null;
  }
}

/**
 * Build the full dynamic context string for the AI chat.
 *
 * Returns: MODE_POLICY_BLOCK + TERMINAL_OUTPUT_SECTION
 */
export async function buildTerminalContext(
  query: string,
  sessionId: string | null,
  mode: ModeId = DEFAULT_MODE
): Promise<string> {
  console.log(`[terminalContextBuilder] buildTerminalContext: sessionId=${sessionId}, mode=${mode}`);
  const sections: string[] = [];

  // 1. Mode policy block (always included — defines behavior posture)
  const modePolicy = MODE_POLICIES[mode] || MODE_POLICIES[DEFAULT_MODE];
  sections.push(modePolicy);

  // 2. Terminal output section
  if (sessionId) {
    const rawOutput = await fetchTerminalOutput(sessionId, MAX_OUTPUT_CHARS);
    if (rawOutput) {
      const cleanOutput = stripAnsi(rawOutput);
      // Trim to budget after ANSI stripping (stripping may reduce length)
      const trimmedOutput = cleanOutput.length > MAX_OUTPUT_CHARS
        ? cleanOutput.slice(-MAX_OUTPUT_CHARS)
        : cleanOutput;

      sections.push(
        `## Terminal Output (local shell)\n\n` +
        '```\n' +
        trimmedOutput +
        '\n```\n\n' +
        'This output is from a local shell session. ' +
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

  return sections.join('\n\n---\n\n');
}
