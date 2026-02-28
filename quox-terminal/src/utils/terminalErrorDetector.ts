/**
 * Terminal Error Detector
 *
 * Lightweight utility that scans terminal output for common error patterns.
 * Used by RunnableCodeBlock for post-exec feedback.
 *
 * Ported from quox-source/src/utils/terminalErrorDetector.js
 */

export interface ErrorPattern {
  pattern: RegExp;
  type: string;
  suggestion: string;
}

export interface DetectedError {
  hasError: boolean;
  errorType: string;
  errorLine: string;
  suggestion: string;
  suggestedToolIds?: string[];
}

export interface DetectedErrorEntry {
  errorType: string;
  errorLine: string;
  suggestion: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /command not found/i,
    type: 'command_not_found',
    suggestion: 'Check if the command is installed or the PATH is correct.',
  },
  {
    pattern: /Permission denied/i,
    type: 'permission_denied',
    suggestion: 'You may need elevated privileges (sudo) or check file permissions.',
  },
  {
    pattern: /No such file or directory/i,
    type: 'file_not_found',
    suggestion: 'Verify the file path exists and is spelled correctly.',
  },
  {
    pattern: /Connection refused/i,
    type: 'connection_refused',
    suggestion: 'The target service may not be running or the port is wrong.',
  },
  {
    pattern: /Connection timed out/i,
    type: 'connection_timeout',
    suggestion: 'Check network connectivity and firewall rules.',
  },
  {
    pattern: /Segmentation fault/i,
    type: 'segfault',
    suggestion: 'The program crashed due to a memory error.',
  },
  {
    pattern: /Out of memory|OOM|oom-kill|Killed$/m,
    type: 'oom',
    suggestion: 'The system ran out of memory. Check available RAM.',
  },
  {
    pattern: /Traceback \(most recent call last\)/,
    type: 'python_traceback',
    suggestion: 'Python exception. Check the error message at the bottom of the traceback.',
  },
  {
    pattern: /Error: Cannot find module/,
    type: 'node_module_not_found',
    suggestion: 'Missing Node.js module. Run npm install.',
  },
  {
    pattern: /SyntaxError:|TypeError:|ReferenceError:|RangeError:/,
    type: 'js_error',
    suggestion: 'JavaScript runtime error. Check the error type and message.',
  },
  {
    pattern: /EACCES|EPERM/,
    type: 'node_permission',
    suggestion: 'Node.js permission error. Check file/port permissions.',
  },
  {
    pattern: /ECONNREFUSED/,
    type: 'node_connection_refused',
    suggestion: 'Connection refused. Verify the target service is running.',
  },
  {
    pattern: /ENOSPC/,
    type: 'disk_full',
    suggestion: 'No space left on device. Free up disk space.',
  },
  {
    pattern: /exit code [1-9]\d*|exited with code [1-9]\d*|returned [1-9]\d*/i,
    type: 'nonzero_exit',
    suggestion: 'Command exited with a non-zero status indicating failure.',
  },
  {
    pattern: /fatal:/i,
    type: 'fatal_error',
    suggestion: 'A fatal error occurred. Check the full error message.',
  },
  {
    pattern: /E: Unable to locate package/,
    type: 'package_not_found',
    suggestion: 'Package not found. Try running apt update first.',
  },
  {
    pattern: /docker: Error response from daemon/,
    type: 'docker_error',
    suggestion: 'Docker daemon error. Check the error message for details.',
  },
];

// ── Error type → suggested tool mappings ──────────────────────────────

const ERROR_TOOL_MAP: Record<string, string[]> = {
  connection_refused: ['fleet-status', 'mon-health'],
  connection_timeout: ['fleet-status', 'mon-health'],
  node_connection_refused: ['fleet-status', 'mon-health'],
  command_not_found: ['admin-config'],
  permission_denied: ['admin-whoami'],
  node_permission: ['admin-whoami'],
  disk_full: ['mem-stats', 'admin-file-stats'],
  oom: ['mon-admin-stats'],
  docker_error: ['fleet-status'],
  package_not_found: ['admin-config'],
};

/**
 * Detect the first error in terminal output.
 *
 * @param output - Terminal output text (already ANSI-stripped)
 * @returns Detected error or null
 */
export function detectTerminalError(output: string): DetectedError | null {
  if (!output) return null;

  const lines = output.split('\n');

  for (const { pattern, type, suggestion } of ERROR_PATTERNS) {
    for (const line of lines) {
      if (pattern.test(line)) {
        return {
          hasError: true,
          errorType: type,
          errorLine: line.trim(),
          suggestion,
          suggestedToolIds: ERROR_TOOL_MAP[type],
        };
      }
    }
  }

  return null;
}

/**
 * Get all errors found in terminal output (not just the first).
 *
 * @param output - Terminal output text
 * @returns Array of detected errors (one per type)
 */
export function detectAllErrors(output: string): DetectedErrorEntry[] {
  if (!output) return [];

  const lines = output.split('\n');
  const errors: DetectedErrorEntry[] = [];
  const seenTypes = new Set<string>();

  for (const { pattern, type, suggestion } of ERROR_PATTERNS) {
    if (seenTypes.has(type)) continue;
    for (const line of lines) {
      if (pattern.test(line)) {
        errors.push({ errorType: type, errorLine: line.trim(), suggestion });
        seenTypes.add(type);
        break;
      }
    }
  }

  return errors;
}

/**
 * Compose a chat query from a detected error.
 * Used by ErrorNotificationBar -> TerminalView -> ChatEngine flow.
 *
 * @param action - What the user wants
 * @param error - Detected error
 * @returns Composed chat query
 */
export function composeErrorQuery(
  action: 'explain' | 'fix',
  error: { errorLine: string; errorType: string; suggestion?: string },
): string {
  if (action === 'explain') {
    return `Explain this terminal error:\n\`\`\`\n${error.errorLine}\n\`\`\`\nError type: ${error.errorType}`;
  }
  if (action === 'fix') {
    return `How do I fix this terminal error?\n\`\`\`\n${error.errorLine}\n\`\`\`\nError type: ${error.errorType}${error.suggestion ? `\nSuggested: ${error.suggestion}` : ''}`;
  }
  return error.errorLine;
}
