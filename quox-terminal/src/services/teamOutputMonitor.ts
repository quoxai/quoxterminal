/**
 * teamOutputMonitor — Parses PTY output for task status patterns
 *
 * Watches agent terminal output for patterns like:
 *   "Task #3 completed" → notify relevant pane
 *   "Blocked on..." → alert team lead
 *   "[task:in_progress]" → update task board
 *
 * Used by TerminalView to flash notifications on pane headers.
 */

export interface TeamNotification {
  agentPaneId: string;
  type: 'task-completed' | 'task-started' | 'blocked' | 'error' | 'info';
  message: string;
  timestamp: number;
}

type NotificationCallback = (notification: TeamNotification) => void;

const TASK_PATTERNS = [
  { pattern: /task.*#?\d+.*completed/i, type: 'task-completed' as const },
  { pattern: /task.*#?\d+.*in.?progress/i, type: 'task-started' as const },
  { pattern: /blocked.*on|waiting.*for/i, type: 'blocked' as const },
  { pattern: /error:|failed:|exception:/i, type: 'error' as const },
];

/** Create a monitor that parses PTY output lines for task patterns. */
export function createOutputMonitor(callback: NotificationCallback) {
  let buffer = '';

  return {
    /** Feed terminal output data for a specific pane. */
    feed(paneId: string, data: string): void {
      buffer += data;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete last line in buffer

      for (const line of lines) {
        const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (!stripped) continue;

        for (const { pattern, type } of TASK_PATTERNS) {
          if (pattern.test(stripped)) {
            callback({
              agentPaneId: paneId,
              type,
              message: stripped.substring(0, 100),
              timestamp: Date.now(),
            });
            break; // One notification per line
          }
        }
      }
    },

    /** Reset the buffer. */
    reset(): void {
      buffer = '';
    },
  };
}
