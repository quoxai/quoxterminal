/**
 * TeamControlBar — Thin status bar shown when an agent team is active
 *
 * Sits between the tab bar and the pane grid.
 * Shows team name, elapsed time, agent status summary, and control buttons.
 */

import { useState, useEffect } from 'react';
import type { TeamSession } from '../../config/teamConfig';
import './TeamControlBar.css';

interface TeamControlBarProps {
  session: TeamSession;
  onPauseAll: () => void;
  onStopTeam: () => void;
  onToggleTaskBoard: () => void;
  taskBoardOpen: boolean;
}

function formatElapsed(startedAt: number): string {
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TeamControlBar({
  session,
  onPauseAll,
  onStopTeam,
  onToggleTaskBoard,
  taskBoardOpen,
}: TeamControlBarProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(session.startedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(session.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  const running = session.agents.filter(
    (a) => a.status === 'running' || a.status === 'spawning',
  ).length;
  const idle = session.agents.filter((a) => a.status === 'idle').length;
  const total = session.agents.length;

  return (
    <div className="team-control-bar">
      <div className="team-control-bar__left">
        <span className="team-control-bar__dot" />
        <span className="team-control-bar__name">{session.templateName}</span>
        <span className="team-control-bar__elapsed">{elapsed}</span>
      </div>

      <div className="team-control-bar__center">
        <span className="team-control-bar__status">
          {running > 0 && (
            <span className="team-control-bar__status-item team-control-bar__status-item--running">
              {running} running
            </span>
          )}
          {idle > 0 && (
            <span className="team-control-bar__status-item team-control-bar__status-item--idle">
              {idle} idle
            </span>
          )}
          {running === 0 && idle === 0 && (
            <span className="team-control-bar__status-item">
              {total} agents
            </span>
          )}
        </span>
      </div>

      <div className="team-control-bar__right">
        <button
          className={`team-control-bar__btn ${taskBoardOpen ? 'team-control-bar__btn--active' : ''}`}
          onClick={onToggleTaskBoard}
          title="Toggle Task Board"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Tasks
        </button>
        <button
          className="team-control-bar__btn"
          onClick={onPauseAll}
          title="Send Ctrl+C to all agents"
        >
          Pause All
        </button>
        <button
          className="team-control-bar__btn team-control-bar__btn--stop"
          onClick={onStopTeam}
          title="Stop team and kill all agents"
        >
          Stop Team
        </button>
      </div>
    </div>
  );
}
