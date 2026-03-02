/**
 * TaskBoard — Sidebar panel showing the shared task list for agent teams
 *
 * Reads task files from ~/.claude/tasks/{taskListId}/ via Tauri IPC.
 * Kanban columns: Pending → In Progress → Done.
 * Auto-refreshes every 5 seconds.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TeamAgentInstance } from '../../config/teamConfig';
import './TaskBoard.css';

interface TaskItem {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  blockedBy?: string[];
}

interface TaskBoardProps {
  taskListId: string;
  agents: TeamAgentInstance[];
  onClose: () => void;
}

async function readTaskFiles(taskListId: string): Promise<TaskItem[]> {
  try {
    const homeDir = await invoke<string>('get_home_dir').catch(() => '~');
    const taskDir = `${homeDir}/.claude/tasks/${taskListId}`;

    // Try to read the task list directory
    const content = await invoke<string>('fs_read_file', {
      path: `${taskDir}/tasks.json`,
    }).catch(() => null);

    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
    }
    return [];
  } catch {
    return [];
  }
}

export default function TaskBoard({
  taskListId,
  agents,
  onClose,
}: TaskBoardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  // Load tasks on mount and auto-refresh
  const loadTasks = useCallback(() => {
    readTaskFiles(taskListId).then(setTasks).catch(() => {});
  }, [taskListId]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const pending = tasks.filter((t) => t.status === 'pending');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const completed = tasks.filter((t) => t.status === 'completed');

  const getAgentColor = (assignee?: string): string | undefined => {
    if (!assignee) return undefined;
    const agent = agents.find(
      (a) => a.role.name.toLowerCase() === assignee.toLowerCase() ||
             a.role.id === assignee,
    );
    return agent?.role.color;
  };

  const handleAddTask = useCallback(() => {
    if (!newTaskText.trim()) return;
    // Add a local task — agents will pick this up from the shared task list
    setTasks((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        subject: newTaskText.trim(),
        status: 'pending',
      },
    ]);
    setNewTaskText('');
  }, [newTaskText]);

  return (
    <div className="task-board">
      <div className="task-board__header">
        <span className="task-board__title">Task Board</span>
        <span className="task-board__count">{tasks.length} tasks</span>
        <button className="task-board__close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="task-board__body">
        {/* Add task input */}
        <div className="task-board__add">
          <input
            className="task-board__add-input"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
            placeholder="Add a task..."
          />
        </div>

        {/* Kanban columns */}
        <div className="task-board__columns">
          {/* Pending */}
          <div className="task-board__column">
            <div className="task-board__column-header task-board__column-header--pending">
              Pending ({pending.length})
            </div>
            {pending.map((task) => (
              <div key={task.id} className="task-board__card">
                <span className="task-board__card-subject">{task.subject}</span>
                {task.assignee && (
                  <span
                    className="task-board__card-assignee"
                    style={{ borderColor: getAgentColor(task.assignee) }}
                  >
                    {task.assignee}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* In Progress */}
          <div className="task-board__column">
            <div className="task-board__column-header task-board__column-header--progress">
              In Progress ({inProgress.length})
            </div>
            {inProgress.map((task) => (
              <div key={task.id} className="task-board__card task-board__card--active">
                <span className="task-board__card-subject">{task.subject}</span>
                {task.assignee && (
                  <span
                    className="task-board__card-assignee"
                    style={{
                      borderColor: getAgentColor(task.assignee),
                      color: getAgentColor(task.assignee),
                    }}
                  >
                    {task.assignee}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Done */}
          <div className="task-board__column">
            <div className="task-board__column-header task-board__column-header--done">
              Done ({completed.length})
            </div>
            {completed.map((task) => (
              <div key={task.id} className="task-board__card task-board__card--done">
                <span className="task-board__card-subject">{task.subject}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="task-board__empty">
            No tasks yet. The team lead will create tasks, or add one above.
          </div>
        )}
      </div>
    </div>
  );
}
