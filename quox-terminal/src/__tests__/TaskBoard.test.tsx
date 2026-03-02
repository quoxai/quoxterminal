import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskBoard from '../components/teams/TaskBoard';
import type { TeamAgentInstance } from '../config/teamConfig';

// Mock Tauri invoke for file reads
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

const mockAgents: TeamAgentInstance[] = [
  { paneId: 'pane-0', role: { id: 'architect', name: 'Architect', description: '', color: '#a855f7', modeId: 'balanced', modelId: 'opus', isLead: true }, sessionId: 's1', status: 'running' },
  { paneId: 'pane-1', role: { id: 'builder', name: 'Builder', description: '', color: '#38bdf8', modeId: 'builder', modelId: 'sonnet', isLead: false }, sessionId: 's2', status: 'running' },
];

describe('TaskBoard', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task board header', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Task Board')).toBeInTheDocument();
  });

  it('shows kanban column headers', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByText(/No tasks yet/),
    ).toBeInTheDocument();
  });

  it('has an add task input', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    const input = screen.getByPlaceholderText('Add a task...');
    expect(input).toBeInTheDocument();
  });

  it('adds a task locally when pressing Enter', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    const input = screen.getByPlaceholderText('Add a task...');
    fireEvent.change(input, { target: { value: 'Fix login bug' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // The task should appear in the Pending column
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    // Empty state should be gone
    expect(screen.queryByText(/No tasks yet/)).not.toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    const closeBtn = document.querySelector('.task-board__close');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows task count', () => {
    render(
      <TaskBoard
        taskListId="test-tasks"
        agents={mockAgents}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });
});
