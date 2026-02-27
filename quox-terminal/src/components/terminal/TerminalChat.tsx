/**
 * TerminalChat - QuoxCode AI Chat Panel for Terminal Workspace
 *
 * Collapsible overlay chat panel that floats alongside terminal panes.
 * Standalone AI chat interface that sends messages via Tauri invoke('chat_send').
 *
 * Features:
 * - Mode-aware prompting (strict/balanced/builder/audit)
 * - Terminal output context injection
 * - Model selection
 * - Suggestion chips for follow-up actions
 * - RunnableCodeBlock for shell commands with Run buttons
 *
 * Props:
 *   workspaceId: string      — scopes chat session per workspace tab
 *   isOpen: boolean          — visibility
 *   onClose: () => void      — toggle callback
 *   sessionId: string|null   — focused pane's terminal session ID (for output context)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { invoke } from '@tauri-apps/api/core';
import { storeGet, storeSet } from '../../lib/store';
import { TERMINAL_MODES, DEFAULT_MODE, type ModeId } from '../../config/terminalModes';
import { buildTerminalContext } from '../../services/terminalContextBuilder';
import { composeSystemPrompt } from '../../config/terminalModes';
import RunnableCodeBlock from './RunnableCodeBlock';
import SuggestionChips, { type SuggestionChip } from './SuggestionChips';
import './TerminalChat.css';

// ── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
}

interface ErrorAction {
  action: 'explain' | 'fix';
  errorType: string;
  errorLine: string;
  suggestion: string;
}

interface TerminalChatProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  /** "local" | "ssh" — type of the focused terminal session */
  sessionType?: string;
  /** e.g. "root@docker01" — host info for SSH sessions */
  hostId?: string;
  /** Pre-filled error action from ErrorNotificationBar */
  errorAction?: ErrorAction | null;
  /** Callback to clear the error action after it's been consumed */
  onErrorActionConsumed?: () => void;
}

interface ModelOption {
  value: string;
  label: string;
}

// ── Available models (hardcoded for now — settings will expand this) ──

const AVAILABLE_MODELS: ModelOption[] = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
];

// ── Static markdown components (no terminal context needed) ───────────

const staticMdComponents = {
  strong: ({ children }: { children?: ReactNode }) => <strong>{children}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
  code: ({ children, className }: { children?: ReactNode; className?: string }) => <code className={className}>{children}</code>,
  h1: ({ children }: { children?: ReactNode }) => <strong style={{ fontSize: '1.1em' }}>{children}</strong>,
  h2: ({ children }: { children?: ReactNode }) => <strong style={{ fontSize: '1.05em' }}>{children}</strong>,
  h3: ({ children }: { children?: ReactNode }) => <strong>{children}</strong>,
  ul: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol>{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  table: ({ children }: { children?: ReactNode }) => <table className="terminal-chat__table">{children}</table>,
  th: ({ children }: { children?: ReactNode }) => <th>{children}</th>,
  td: ({ children }: { children?: ReactNode }) => <td>{children}</td>,
};

// ── Model storage helpers ─────────────────────────────────────────────

const MODEL_STORAGE_KEY = 'quox-terminal-chat-model';
const MODE_STORAGE_KEY = 'quox-terminal-chat-mode';

async function loadModelSelection(workspaceId: string): Promise<string | null> {
  try {
    return await storeGet<string>(`${MODEL_STORAGE_KEY}-${workspaceId}`);
  } catch {
    return null;
  }
}

async function saveModelSelection(workspaceId: string, model: string): Promise<void> {
  try {
    await storeSet(`${MODEL_STORAGE_KEY}-${workspaceId}`, model);
  } catch {
    // silent
  }
}

async function loadModeSelection(workspaceId: string): Promise<ModeId> {
  try {
    const saved = await storeGet<ModeId>(`${MODE_STORAGE_KEY}-${workspaceId}`);
    return saved || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

async function saveModeSelection(workspaceId: string, mode: ModeId): Promise<void> {
  try {
    await storeSet(`${MODE_STORAGE_KEY}-${workspaceId}`, mode);
  } catch {
    // silent
  }
}

// ── Simple suggestion chip generation ─────────────────────────────────

function generateSuggestionChips(assistantText: string, mode: ModeId): SuggestionChip[] {
  const chips: SuggestionChip[] = [];

  // Detect error patterns
  if (/error|fail|exception|traceback|ENOENT|EACCES|denied/i.test(assistantText)) {
    chips.push({ label: 'Explain fix', query: 'Can you explain the fix in more detail?', icon: 'help-circle' });
    chips.push({ label: 'Show full error', query: 'Show me the full error and context', icon: 'terminal' });
  }

  // Detect command suggestions
  if (/```(bash|sh|shell|console|zsh)?/i.test(assistantText)) {
    if (mode !== 'audit') {
      chips.push({ label: 'Run all', query: 'Run all the commands you suggested', icon: 'play' });
    }
    chips.push({ label: 'Explain commands', query: 'Explain each command step by step', icon: 'help-circle' });
  }

  // Detect file changes
  if (/```file:(create|edit|delete)/i.test(assistantText)) {
    chips.push({ label: 'Review changes', query: 'Show me a diff of what changed', icon: 'file-text' });
  }

  // General follow-ups
  if (chips.length === 0) {
    chips.push({ label: 'Continue', query: 'Continue', icon: 'play' });
    chips.push({ label: 'Explain more', query: 'Can you explain that in more detail?', icon: 'help-circle' });
  }

  return chips.slice(0, 4);
}

// ── Component ────────────────────────────────────────────────────────

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export default function TerminalChat({
  workspaceId,
  isOpen,
  onClose,
  sessionId,
  sessionType = 'local',
  hostId = '',
  errorAction = null,
  onErrorActionConsumed,
}: TerminalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].value);
  const [selectedMode, setSelectedMode] = useState<ModeId>(DEFAULT_MODE);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved model and mode selections
  useEffect(() => {
    loadModelSelection(workspaceId).then(saved => {
      if (saved) setSelectedModel(saved);
    });
    loadModeSelection(workspaceId).then(saved => {
      setSelectedMode(saved);
    });
  }, [workspaceId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleModelChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    saveModelSelection(workspaceId, model);
  }, [workspaceId]);

  const handleModeChange = useCallback((mode: ModeId) => {
    setSelectedMode(mode);
    saveModeSelection(workspaceId, mode);
  }, [workspaceId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text?: string, errorCtx?: ErrorAction | null) => {
    const messageText = text || inputValue.trim();
    if (!messageText || isProcessing) return;

    setInputValue('');
    setError(null);

    // Add user message
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: messageText };
    setMessages(prev => [...prev, userMsg]);

    // Build context from terminal output, including session type and error info
    setIsProcessing(true);
    try {
      const context = await buildTerminalContext(messageText, sessionId, selectedMode, {
        sessionType,
        hostId,
        errorContext: errorCtx ? {
          errorType: errorCtx.errorType,
          errorLine: errorCtx.errorLine,
          suggestion: errorCtx.suggestion,
          action: errorCtx.action,
        } : null,
      });
      const systemPrompt = composeSystemPrompt(selectedMode);

      // Build messages array for the API
      const apiMessages = messages
        .concat(userMsg)
        .map(m => ({ role: m.role, content: m.text }));

      // Call Rust backend via Tauri
      const response = await invoke<string>('chat_send', {
        messages: apiMessages,
        model: selectedModel,
        systemPrompt: systemPrompt + '\n\n' + context,
      });

      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: response,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      // Add error as assistant message for visibility
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        text: `Error: ${errMsg}`,
        pending: false,
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, messages, sessionId, sessionType, hostId, selectedMode, selectedModel]);

  // Handle incoming error action from ErrorNotificationBar
  useEffect(() => {
    if (!errorAction || !isOpen || isProcessing) return;

    const query = errorAction.action === 'fix'
      ? `Fix this error: ${errorAction.errorLine}`
      : `Explain this error: ${errorAction.errorLine}`;

    sendMessage(query, errorAction);
    onErrorActionConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorAction]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Suggestion chips from last assistant message
  const lastAssistantText = useMemo(() => {
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return last.role === 'assistant' ? last.text : null;
  }, [messages]);

  const suggestionChips = useMemo(() => {
    if (!lastAssistantText || selectedMode === 'audit') return [];
    return generateSuggestionChips(lastAssistantText, selectedMode);
  }, [lastAssistantText, selectedMode]);

  const prevChipsRef = useRef<SuggestionChip[]>([]);
  const displayChips = useMemo(() => {
    if (suggestionChips.length > 0) {
      prevChipsRef.current = suggestionChips;
      return suggestionChips;
    }
    if (isProcessing) return prevChipsRef.current;
    prevChipsRef.current = [];
    return [];
  }, [suggestionChips, isProcessing]);

  // Build markdown components with terminal-aware pre
  const mdComponents = useMemo(() => ({
    ...staticMdComponents,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pre: (props: any) => {
      return (
        <RunnableCodeBlock
          {...props}
          sessionId={sessionId}
          mode={selectedMode}
        />
      );
    },
  }), [sessionId, selectedMode]);

  const ChatMd = useCallback(({ children }: { children: string }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {children || ''}
    </ReactMarkdown>
  ), [mdComponents]);

  if (!isOpen) return null;

  return (
    <div className="terminal-chat">
      {/* Header */}
      <div className="terminal-chat__header">
        <div className="terminal-chat__header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="terminal-chat__header-title">QuoxCode</span>
          {isProcessing && (
            <span className="terminal-chat__status-dot terminal-chat__status-dot--thinking" />
          )}
        </div>
        <div className="terminal-chat__header-right">
          <button className="terminal-chat__header-btn" onClick={clearConversation} title="Clear chat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button className="terminal-chat__header-btn" onClick={onClose} title="Close chat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mode selector + Model selector */}
      <div className="terminal-chat__model-bar">
        <div className="terminal-chat__mode-row">
          {Object.values(TERMINAL_MODES).map(mode => (
            <button
              key={mode.id}
              className={`terminal-chat__mode-btn ${selectedMode === mode.id ? 'terminal-chat__mode-btn--active' : ''}`}
              onClick={() => handleModeChange(mode.id)}
              title={mode.description}
              data-mode={mode.id}
              style={selectedMode === mode.id ? { borderColor: mode.color, color: mode.color } : undefined}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <select
          className="terminal-chat__model-select"
          value={selectedModel}
          onChange={handleModelChange}
        >
          {AVAILABLE_MODELS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="terminal-chat__messages">
        {messages.length === 0 && (
          <div className="terminal-chat__empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <p>Ask QuoxCode about errors, get command suggestions, or debug your terminal output.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`terminal-chat__message terminal-chat__message--${msg.role}`}>
            <div className={`terminal-chat__bubble ${msg.pending ? 'terminal-chat__bubble--pending' : ''}`}>
              {msg.role === 'assistant' ? (
                <ChatMd>{msg.text}</ChatMd>
              ) : (
                <span>{msg.text}</span>
              )}
            </div>
          </div>
        ))}

        {displayChips.length > 0 && (
          <SuggestionChips
            chips={displayChips}
            onChipClick={(query: string) => sendMessage(query)}
            hidden={isProcessing}
          />
        )}

        {isProcessing && (
          <div className="terminal-chat__processing">Thinking...</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="terminal-chat__input-area">
        <div className="terminal-chat__input-row">
          <textarea
            ref={textareaRef}
            className="terminal-chat__textarea"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask QuoxCode..."
            rows={1}
            disabled={isProcessing}
          />
          <button
            className="terminal-chat__send-btn"
            onClick={() => sendMessage()}
            disabled={isProcessing || !inputValue.trim()}
            title="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="terminal-chat__error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
