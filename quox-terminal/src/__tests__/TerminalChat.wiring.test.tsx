import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TerminalChat from '../components/terminal/TerminalChat';

// Mock the memory bridge — capture the event handler
let memoryEventHandler: ((event: any) => void) | null = null;
vi.mock('../services/terminalMemoryBridge', () => ({
  onMemoryEvent: vi.fn((handler: any) => {
    memoryEventHandler = handler;
    return () => { memoryEventHandler = null; };
  }),
  recordCommandExecution: vi.fn(),
  extractEntitiesFromOutput: vi.fn().mockResolvedValue([]),
  recordDetectedError: vi.fn(),
  isCollectorAvailable: vi.fn().mockResolvedValue(false),
  isPremiumTerminalMemory: vi.fn().mockResolvedValue(false),
  EVENT_TYPES: {
    SESSION_START: 'memory:session_start',
    SESSION_END: 'memory:session_end',
    ENTITY_STORED: 'memory:entity_stored',
    ERROR_TRACKED: 'memory:error_tracked',
    RESOLUTION_STORED: 'memory:resolution_stored',
    COMMAND_RECORDED: 'memory:command_recorded',
    FOCUS_UPDATED: 'memory:focus_updated',
    UPGRADE_BLOCKED: 'memory:upgrade_blocked',
  },
}));

vi.mock('../services/terminalExecService', () => ({
  validateForExec: vi.fn().mockReturnValue({
    action: 'ALLOW',
    allowed: true,
    showButton: true,
  }),
  execInTerminal: vi.fn().mockResolvedValue({ ok: true }),
  extractCommands: vi.fn().mockReturnValue([]),
  looksLikeShellCommand: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/terminalContextBuilder', () => ({
  buildTerminalContext: vi.fn().mockResolvedValue(''),
}));

vi.mock('../config/terminalModes', () => ({
  TERMINAL_MODES: {
    balanced: { id: 'balanced', label: 'Balanced', description: 'Balanced mode', color: '#10b981' },
  },
  DEFAULT_MODE: 'balanced',
  composeSystemPrompt: vi.fn().mockReturnValue('system prompt'),
}));

vi.mock('../services/terminalFileService', () => ({
  getFilePolicy: vi.fn().mockReturnValue({
    showApplyButtons: true,
    requireConfirmModal: false,
    allowedActions: ['create', 'edit', 'delete', 'rename'],
  }),
  writeFile: vi.fn().mockResolvedValue({ ok: true }),
  readFile: vi.fn().mockResolvedValue({ ok: true, content: '' }),
  computeDiff: vi.fn().mockReturnValue({ lines: [], stats: { added: 0, removed: 0, context: 0 } }),
  validateFilePath: vi.fn().mockReturnValue({ severity: 'GREEN', allowed: true }),
}));

describe('TerminalChat wiring', () => {
  beforeEach(() => {
    memoryEventHandler = null;
  });

  it('renders without crashing when open', () => {
    render(
      <TerminalChat
        workspaceId="test"
        isOpen={true}
        onClose={() => {}}
        sessionId="session-1"
      />
    );
    expect(screen.getByText('QuoxCode')).toBeInTheDocument();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <TerminalChat
        workspaceId="test"
        isOpen={false}
        onClose={() => {}}
        sessionId="session-1"
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('subscribes to memory events on mount', () => {
    render(
      <TerminalChat
        workspaceId="test"
        isOpen={true}
        onClose={() => {}}
        sessionId="session-1"
      />
    );
    // onMemoryEvent should have been called with a handler
    expect(memoryEventHandler).not.toBeNull();
  });

  it('accumulates memory events (up to 100)', () => {
    render(
      <TerminalChat
        workspaceId="test"
        isOpen={true}
        onClose={() => {}}
        sessionId="session-1"
      />
    );

    // Fire a memory event
    act(() => {
      memoryEventHandler?.({
        type: 'memory:entity_stored',
        detail: { entity: 'docker01' },
        timestamp: new Date().toISOString(),
        isPremium: false,
      });
    });

    // The MemoryActivityFeed should show the event count badge
    // (The feed is collapsed by default, showing the count)
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('renders the empty state when no messages', () => {
    render(
      <TerminalChat
        workspaceId="test"
        isOpen={true}
        onClose={() => {}}
        sessionId="session-1"
      />
    );
    expect(screen.getByText(/Ask QuoxCode about errors/)).toBeInTheDocument();
  });
});
