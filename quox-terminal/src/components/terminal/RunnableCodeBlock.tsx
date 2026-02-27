/**
 * RunnableCodeBlock
 *
 * Custom ReactMarkdown `pre` component that adds "Run" buttons to shell code blocks.
 * Validates commands client-side against the denylist and respects mode policies.
 *
 * Ported from quox-source/src/components/terminal/RunnableCodeBlock.jsx
 * - TypeScript interfaces
 * - Uses Tauri PTY exec via terminalExecService (no HTTP POST)
 * - Mode-aware exec policies from terminalModes (MODE_EXEC_POLICIES)
 * - recordCommandExecution from terminalMemoryBridge
 * - onExecRequest callback for REQUIRE_APPROVAL commands (modal flow)
 * - Copy-to-clipboard on all code blocks
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { validateForExec, execInTerminal, type ValidationResult } from '../../services/terminalExecService';
import { recordCommandExecution } from '../../services/terminalMemoryBridge';
import type { ModeId } from '../../config/terminalModes';
import './RunnableCodeBlock.css';

// ── Types ────────────────────────────────────────────────────────────

const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'console', 'zsh']);

// Common command prefixes for unlabeled code blocks
const COMMAND_PREFIX_RE = /^(sudo\s+)?(apt|yum|npm|npx|docker|git|curl|wget|ssh|scp|rsync|systemctl|journalctl|cat|ls|cd|mkdir|rm|cp|mv|chmod|chown|grep|find|tar|zip|unzip|df|du|top|htop|ps|kill|ping|dig|make|cargo|python|node|go|pip|brew|dnf|zypper|snap|flatpak|service|mount|umount|fdisk|lsblk|ip|ss|netstat|hostname|whoami|id|uname|date|uptime|free|vmstat|iostat|sar|strace|ltrace|tcpdump|nmap|openssl)\b/;

interface RunnableCodeBlockProps {
  children?: ReactNode;
  sessionId: string | null;
  mode: ModeId;
  onExecRequest?: (command: string, validation: ValidationResult) => void;
  [key: string]: unknown;
}

type ExecState = 'idle' | 'running' | 'done' | 'error' | 'warn-confirm';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract language and code text from ReactMarkdown's pre > code structure.
 */
function extractCodeInfo(children: ReactNode): { language: string; code: string } {
  if (!children) return { language: '', code: '' };

  const codeChild = Array.isArray(children) ? children[0] : children;
  if (!codeChild || typeof codeChild !== 'object' || !('props' in codeChild)) {
    return { language: '', code: '' };
  }

  const props = (codeChild as { props: { className?: string; children?: unknown } }).props;
  const className = props.className || '';
  const langMatch = className.match(/language-(\w+)/);
  const language = langMatch ? langMatch[1].toLowerCase() : '';

  const code = typeof props.children === 'string'
    ? props.children
    : String(props.children || '');

  return { language, code: code.trim() };
}

/**
 * Check if unlabeled code looks like a shell command.
 */
function isLikelyShellCommand(code: string): boolean {
  if (!code) return false;
  const firstLine = code.split('\n')[0].trim();
  if (/^\s*[$#]\s/.test(firstLine)) return true;
  if (COMMAND_PREFIX_RE.test(firstLine)) return true;
  return false;
}

/**
 * Strip $ prompts from command text.
 * Only strips `$ ` user prompts -- `# ` lines are kept as valid shell comments.
 */
function stripPrompts(code: string): string {
  return code
    .split('\n')
    .map(line => line.replace(/^\s*\$\s*/, ''))
    .join('\n')
    .trim();
}

// ── Component ────────────────────────────────────────────────────────

export default function RunnableCodeBlock({
  children,
  sessionId,
  mode,
  onExecRequest,
}: RunnableCodeBlockProps) {
  const [execState, setExecState] = useState<ExecState>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const { language, code } = useMemo(() => extractCodeInfo(children), [children]);

  const isShell = useMemo(() => {
    if (SHELL_LANGUAGES.has(language)) return true;
    if (language === '') return isLikelyShellCommand(code);
    return false;
  }, [language, code]);

  const command = useMemo(() => isShell ? stripPrompts(code) : '', [isShell, code]);

  const validation: ValidationResult | null = useMemo(() => {
    if (!isShell || !command) return null;
    return validateForExec(command, mode);
  }, [isShell, command, mode]);

  const handleRun = useCallback(async () => {
    if (!validation || !command) return;

    // Commands requiring approval go through the modal via onExecRequest
    if (validation.action === 'REQUIRE_APPROVAL' || validation.action === 'REQUIRE_OVERRIDE') {
      onExecRequest?.(command, validation);
      return;
    }

    // WARN: first click shows warning state, second click executes
    if (validation.action === 'WARN' && execState !== 'warn-confirm') {
      setExecState('warn-confirm');
      return;
    }

    // Execute
    setExecState('running');
    setStatusMsg('');

    if (!sessionId) {
      setExecState('error');
      setStatusMsg('No active terminal session');
      setTimeout(() => { setExecState('idle'); setStatusMsg(''); }, 5000);
      return;
    }

    const result = await execInTerminal(sessionId, command);
    if (result.ok) {
      setExecState('done');
      setStatusMsg('Sent to terminal');
      recordCommandExecution(command, null);
      setTimeout(() => { setExecState('idle'); setStatusMsg(''); }, 3000);
    } else {
      setExecState('error');
      setStatusMsg(result.error || 'Failed');
      setTimeout(() => { setExecState('idle'); setStatusMsg(''); }, 5000);
    }
  }, [validation, command, sessionId, execState, onExecRequest]);

  const handleCancelWarn = useCallback(() => {
    setExecState('idle');
  }, []);

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [code]);

  // Not a shell block -- render plain pre with copy button
  if (!isShell) {
    return (
      <div className="runnable-code-block">
        <pre className="runnable-code-block__code">{children}</pre>
        <div className="runnable-code-block__toolbar">
          <button
            className="runnable-code-block__btn"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  }

  const isAuditMode = mode === 'audit';
  const noSession = !sessionId;
  // In audit mode, the BLOCK comes from mode policy, not denylist -- show audit badge instead
  const isBlocked = !isAuditMode && validation?.action === 'BLOCK';

  return (
    <div className="runnable-code-block">
      <pre className="runnable-code-block__code">{children}</pre>

      <div className="runnable-code-block__toolbar">
        {/* Status message (sent/error feedback) */}
        {statusMsg && (
          <span className={`runnable-code-block__status runnable-code-block__status--${execState === 'error' ? 'error' : 'done'}`}>
            {statusMsg}
          </span>
        )}

        {/* Audit mode badge (takes priority over blocked) */}
        {isAuditMode && (
          <span className="runnable-code-block__badge runnable-code-block__badge--audit">
            Audit mode
          </span>
        )}

        {/* Blocked badge (for actually dangerous commands, not audit-mode blocks) */}
        {isBlocked && (
          <span className="runnable-code-block__badge runnable-code-block__badge--blocked">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
            </svg>
            Blocked
          </span>
        )}

        {/* Warning confirmation bar */}
        {execState === 'warn-confirm' && (
          <div className="runnable-code-block__warn-bar">
            <span>{validation?.description || 'This command may be risky.'}</span>
            <button className="runnable-code-block__btn runnable-code-block__btn--warn-confirm" onClick={handleRun}>
              Confirm
            </button>
            <button className="runnable-code-block__btn runnable-code-block__btn--cancel" onClick={handleCancelWarn}>
              Cancel
            </button>
          </div>
        )}

        {/* Copy button (always visible for shell blocks too) */}
        <button
          className="runnable-code-block__btn"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {/* Run button */}
        {!isBlocked && !isAuditMode && execState !== 'warn-confirm' && (
          <button
            className={`runnable-code-block__btn runnable-code-block__btn--run ${
              validation?.action === 'WARN' ? 'runnable-code-block__btn--amber' :
              validation?.action === 'REQUIRE_APPROVAL' || validation?.action === 'REQUIRE_OVERRIDE'
                ? 'runnable-code-block__btn--approval' : ''
            }`}
            onClick={handleRun}
            disabled={noSession || execState === 'running'}
            title={noSession ? 'No active terminal session' : `Run in terminal${validation?.severity ? ` (${validation.severity})` : ''}`}
          >
            {execState === 'running' ? (
              <span className="runnable-code-block__spinner" />
            ) : execState === 'done' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : execState === 'error' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (validation?.action === 'REQUIRE_APPROVAL' || validation?.action === 'REQUIRE_OVERRIDE') ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
                Run
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"/>
                  <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                Run
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
