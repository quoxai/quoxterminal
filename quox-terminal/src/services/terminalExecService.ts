/**
 * Terminal Exec Service
 *
 * Client-side service for executing commands in the user's active terminal session.
 * Handles pre-validation against the denylist, mode-aware policies, and PTY write.
 */

import { ptyWrite } from '../lib/tauri-pty';
import { MODE_EXEC_POLICIES, type ModeId } from '../config/terminalModes';

// ── Types ────────────────────────────────────────────────────────────

export interface DenylistRule {
  pattern: RegExp;
  severity: 'RED' | 'ORANGE' | 'AMBER' | 'YELLOW' | 'GREEN' | 'BLUE';
  description: string;
  blocked: boolean;
  requiresAuth?: boolean;
}

export interface ValidationResult {
  action: 'ALLOW' | 'WARN' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'REQUIRE_OVERRIDE';
  allowed: boolean;
  severity?: string;
  description?: string;
  showButton: boolean;
  blocked?: boolean;
  requiresAuth?: boolean;
  pattern?: string;
}

export interface ExecResult {
  ok: boolean;
  action?: string;
  error?: string;
}

// ── Denylist (inline — no external dependency needed) ────────────────

const DENIED_PATTERNS: DenylistRule[] = [
  // CRITICAL - Always blocked (RED)
  { pattern: /rm\s+-rf\s+[/~]/i,          severity: 'RED', description: 'Recursive delete from root or home', blocked: true },
  { pattern: /rm\s+-rf\s+\/\*/i,          severity: 'RED', description: 'Delete all files from root', blocked: true },
  { pattern: /dd\s+if=.*of=\/dev\/[sh]d/i, severity: 'RED', description: 'Direct disk write operation', blocked: true },
  { pattern: /mkfs\./i,                    severity: 'RED', description: 'Filesystem format operation', blocked: true },
  { pattern: />\s*\/dev\/[sh]d/i,          severity: 'RED', description: 'Overwrite disk device', blocked: true },
  { pattern: /:\(\)\{.*:\|:.*\}/,          severity: 'RED', description: 'Fork bomb detected', blocked: true },

  // VM/Container Destruction (RED - requires auth)
  { pattern: /qm\s+destroy\s+\d+/i,       severity: 'RED', description: 'VM destruction command', blocked: false, requiresAuth: true },
  { pattern: /pct\s+destroy\s+\d+/i,      severity: 'RED', description: 'Container destruction command', blocked: false, requiresAuth: true },
  { pattern: /pvesh\s+delete/i,           severity: 'RED', description: 'Proxmox resource deletion via API', blocked: false, requiresAuth: true },

  // Firewall/Network (RED - requires auth)
  { pattern: /iptables\s+-F/i,            severity: 'RED', description: 'Firewall flush - will drop all rules', blocked: false, requiresAuth: true },
  { pattern: /iptables\s+--flush/i,       severity: 'RED', description: 'Firewall flush - will drop all rules', blocked: false, requiresAuth: true },
  { pattern: /ufw\s+disable/i,            severity: 'RED', description: 'Disable firewall completely', blocked: false, requiresAuth: true },

  // System Power (ORANGE - requires confirmation)
  { pattern: /shutdown\s/i,               severity: 'ORANGE', description: 'System shutdown command', blocked: false },
  { pattern: /reboot/i,                   severity: 'ORANGE', description: 'System reboot command', blocked: false },
  { pattern: /poweroff/i,                 severity: 'ORANGE', description: 'System power off command', blocked: false },
  { pattern: /init\s+0/i,                 severity: 'ORANGE', description: 'System halt via init', blocked: false },
  { pattern: /init\s+6/i,                 severity: 'ORANGE', description: 'System reboot via init', blocked: false },

  // Dangerous Permissions (ORANGE)
  { pattern: /chmod\s+-R\s+777/i,         severity: 'ORANGE', description: 'Recursive world-writable permissions', blocked: false },
  { pattern: /chown\s+-R\s+.*:/i,         severity: 'ORANGE', description: 'Recursive ownership change', blocked: false },

  // Service Destruction (AMBER)
  { pattern: /systemctl\s+stop\s+/i,      severity: 'AMBER', description: 'Service stop command', blocked: false },
  { pattern: /systemctl\s+disable\s+/i,   severity: 'AMBER', description: 'Service disable command', blocked: false },
  { pattern: /docker\s+rm\s+-f/i,         severity: 'AMBER', description: 'Force remove Docker container', blocked: false },
  { pattern: /docker\s+stop/i,            severity: 'AMBER', description: 'Docker container stop', blocked: false },

  // Package Management (AMBER)
  { pattern: /apt\s+(remove|purge)\s+/i,  severity: 'AMBER', description: 'Package removal', blocked: false },
  { pattern: /yum\s+(remove|erase)\s+/i,  severity: 'AMBER', description: 'Package removal', blocked: false },
];

// ── Severity to action mapping ──────────────────────────────────────

const SEVERITY_ACTIONS: Record<string, string> = {
  RED: 'BLOCK',
  ORANGE: 'REQUIRE_APPROVAL',
  AMBER: 'WARN',
  YELLOW: 'WARN',
  GREEN: 'ALLOW',
  BLUE: 'ALLOW',
};

// ── Command Validation ──────────────────────────────────────────────

/**
 * Validate a command against the denylist.
 */
function validateCommand(command: string): {
  allowed: boolean;
  blocked?: boolean;
  severity?: string;
  description?: string;
  requiresAuth?: boolean;
  pattern?: string;
} {
  if (!command) return { allowed: true };

  for (const rule of DENIED_PATTERNS) {
    if (rule.pattern.test(command)) {
      return {
        allowed: !rule.blocked,
        blocked: rule.blocked,
        severity: rule.severity,
        description: rule.description,
        requiresAuth: rule.requiresAuth || false,
        pattern: rule.pattern.toString(),
      };
    }
  }

  return { allowed: true };
}

/**
 * Get the action to take for a command based on validation results.
 */
function getCommandAction(command: string): {
  action: string;
  allowed: boolean;
  blocked?: boolean;
  severity?: string;
  description?: string;
  requiresAuth?: boolean;
  pattern?: string;
} {
  const validation = validateCommand(command);

  // If no pattern matched, allow the command
  if (validation.allowed && !validation.severity) {
    return { action: 'ALLOW', ...validation };
  }

  // Determine action based on severity and flags
  let action: string;

  if (validation.severity === 'RED') {
    if (validation.blocked) {
      action = 'BLOCK';
    } else if (validation.requiresAuth) {
      action = 'REQUIRE_OVERRIDE';
    } else {
      action = 'BLOCK';
    }
  } else if (validation.severity === 'ORANGE') {
    action = 'REQUIRE_APPROVAL';
  } else if (validation.severity === 'AMBER' || validation.severity === 'YELLOW') {
    action = 'WARN';
  } else if (validation.severity === 'GREEN' || validation.severity === 'BLUE') {
    action = 'ALLOW';
  } else {
    action = (validation.severity && SEVERITY_ACTIONS[validation.severity]) || 'ALLOW';
  }

  return { action, ...validation };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Execute a command in the user's terminal via Tauri PTY or SSH.
 *
 * @param sessionId - The PTY or SSH session ID
 * @param command - The command string to execute
 * @param sessionType - 'local' for PTY, 'ssh' for SSH session
 */
export async function execInTerminal(
  sessionId: string,
  command: string,
  sessionType: 'local' | 'ssh' = 'local'
): Promise<ExecResult> {
  if (!sessionId) {
    return { ok: false, error: 'No active terminal session' };
  }
  if (!command || !command.trim()) {
    return { ok: false, error: 'Empty command' };
  }

  try {
    if (sessionType === 'ssh') {
      const { sshWrite } = await import('../lib/tauri-ssh');
      await sshWrite(sessionId, command.trim() + '\n');
    } else {
      await ptyWrite(sessionId, command.trim() + '\n');
    }
    return { ok: true, action: 'ALLOW' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'PTY write error' };
  }
}

/**
 * Client-side pre-validation of a command for the given mode.
 * Uses the denylist + mode exec policies.
 */
export function validateForExec(command: string, mode: ModeId = 'balanced'): ValidationResult {
  const policy = MODE_EXEC_POLICIES[mode] || MODE_EXEC_POLICIES.balanced;

  // Audit mode: no execution allowed
  if (!policy.showRunButtons) {
    return { action: 'BLOCK', allowed: false, showButton: false, description: 'Audit mode - read only' };
  }

  const result = getCommandAction(command);

  // In strict mode, WARN becomes REQUIRE_APPROVAL
  if (policy.warnAsBlock && result.action === 'WARN') {
    return {
      ...result,
      action: 'REQUIRE_APPROVAL',
      showButton: true,
    };
  }

  return {
    ...result,
    action: result.action as ValidationResult['action'],
    showButton: result.action !== 'BLOCK',
  };
}

/**
 * Extract shell commands from markdown code blocks.
 * Looks for fenced code blocks with shell-related language tags.
 */
export function extractCommands(markdown: string): Array<{ command: string; language: string }> {
  if (!markdown) return [];

  const results: Array<{ command: string; language: string }> = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  const shellLangs = new Set(['bash', 'sh', 'shell', 'console', 'zsh', '']);

  let match;
  while ((match = fenceRegex.exec(markdown)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();

    if (!shellLangs.has(lang)) continue;

    // For unlabeled blocks, heuristic: starts with $ or # prompt, or looks like a command
    if (lang === '' && !looksLikeShellCommand(code)) continue;

    // Strip leading $ prompts only — # lines are valid shell comments, not prompts
    const command = code
      .split('\n')
      .map((line: string) => line.replace(/^\s*\$\s*/, ''))
      .join('\n')
      .trim();

    if (command) {
      results.push({ command, language: lang || 'shell' });
    }
  }

  return results;
}

/**
 * Heuristic: does this code block text look like a shell command?
 */
export function looksLikeShellCommand(text: string): boolean {
  if (!text) return false;
  const firstLine = text.split('\n')[0].trim();
  // Starts with $ or # prompt
  if (/^\s*[$#]\s/.test(firstLine)) return true;
  // Common command prefixes
  if (/^(sudo|apt|yum|npm|docker|git|curl|wget|ssh|scp|rsync|systemctl|journalctl|cat|ls|cd|mkdir|rm|cp|mv|chmod|chown|grep|find|tar|zip|unzip|df|du|top|htop|ps|kill|ping|dig|nslookup|traceroute|nc|openssl|python|node|go|make|cargo)\b/.test(firstLine)) return true;
  return false;
}
