import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeamControlBar from '../components/teams/TeamControlBar';
import type { TeamSession } from '../config/teamConfig';

const makeSession = (overrides?: Partial<TeamSession>): TeamSession => ({
  id: 'ts-test',
  templateId: 'feature-build',
  templateName: 'Feature Build',
  taskListId: 'task-list-123',
  workspaceId: 'ws-0',
  agents: [
    { paneId: 'pane-0', role: { id: 'architect', name: 'Architect', description: '', color: '#a855f7', modeId: 'balanced', modelId: 'opus', isLead: true }, sessionId: 's1', status: 'running' },
    { paneId: 'pane-1', role: { id: 'builder-a', name: 'Builder A', description: '', color: '#38bdf8', modeId: 'builder', modelId: 'sonnet', isLead: false }, sessionId: 's2', status: 'running' },
    { paneId: 'pane-2', role: { id: 'builder-b', name: 'Builder B', description: '', color: '#22c55e', modeId: 'builder', modelId: 'sonnet', isLead: false }, sessionId: null, status: 'idle' },
    { paneId: 'pane-3', role: { id: 'tester', name: 'Tester', description: '', color: '#f59e0b', modeId: 'balanced', modelId: 'sonnet', isLead: false }, sessionId: null, status: 'idle' },
  ],
  status: 'running',
  startedAt: Date.now() - 120000, // 2 minutes ago
  projectDir: '~',
  workingOn: 'Test task',
  ...overrides,
});

describe('TeamControlBar', () => {
  const onPauseAll = vi.fn();
  const onStopTeam = vi.fn();
  const onToggleTaskBoard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders team name', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    expect(screen.getByText('Feature Build')).toBeInTheDocument();
  });

  it('shows running and idle counts', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    expect(screen.getByText('2 running')).toBeInTheDocument();
    expect(screen.getByText('2 idle')).toBeInTheDocument();
  });

  it('shows elapsed time', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    // Should show something like "2:00"
    const elapsed = document.querySelector('.team-control-bar__elapsed');
    expect(elapsed).toBeTruthy();
    expect(elapsed!.textContent).toMatch(/\d+:\d{2}/);
  });

  it('Pause All button calls onPauseAll', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    fireEvent.click(screen.getByText('Pause All'));
    expect(onPauseAll).toHaveBeenCalledTimes(1);
  });

  it('Stop Team button calls onStopTeam', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    fireEvent.click(screen.getByText('Stop Team'));
    expect(onStopTeam).toHaveBeenCalledTimes(1);
  });

  it('Tasks button calls onToggleTaskBoard', () => {
    render(
      <TeamControlBar
        session={makeSession()}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    fireEvent.click(screen.getByText('Tasks'));
    expect(onToggleTaskBoard).toHaveBeenCalledTimes(1);
  });

  it('shows all agents when none running or idle', () => {
    const session = makeSession({
      agents: [
        { paneId: 'pane-0', role: { id: 'a', name: 'A', description: '', color: '#fff', modeId: 'balanced', modelId: 'sonnet', isLead: true }, sessionId: null, status: 'pending' },
        { paneId: 'pane-1', role: { id: 'b', name: 'B', description: '', color: '#fff', modeId: 'balanced', modelId: 'sonnet', isLead: false }, sessionId: null, status: 'pending' },
      ],
    });
    render(
      <TeamControlBar
        session={session}
        onPauseAll={onPauseAll}
        onStopTeam={onStopTeam}
        onToggleTaskBoard={onToggleTaskBoard}
        taskBoardOpen={false}
      />,
    );
    expect(screen.getByText('2 agents')).toBeInTheDocument();
  });
});
