/**
 * HostKnowledgeCard — Context card shown when connecting to a known host.
 *
 * Appears between the pane header and terminal when SSH connects to a host
 * the system has seen before. Shows session count, last connected time,
 * and last error. Dismissible per session.
 */

import { useState, useMemo } from 'react';
import type { SessionInfo } from '../../services/terminalMemoryBridge';
import './HostKnowledgeCard.css';

interface HostKnowledgeCardProps {
  hostId: string;
  sessions: SessionInfo[];
  lastError?: { errorType: string; errorLine: string; timestamp?: string } | null;
  onDismiss: () => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HostKnowledgeCard({
  hostId,
  sessions,
  lastError,
  onDismiss,
}: HostKnowledgeCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const hostSessions = useMemo(() => {
    return sessions.filter(s => s.hostId === hostId || s.hostId.includes(hostId));
  }, [sessions, hostId]);

  const lastSession = useMemo(() => {
    const past = hostSessions.filter(s => s.status === 'disconnected' && s.disconnectedAt);
    if (past.length === 0) return null;
    return past.sort((a, b) =>
      new Date(b.disconnectedAt!).getTime() - new Date(a.disconnectedAt!).getTime()
    )[0];
  }, [hostSessions]);

  if (dismissed || hostSessions.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <div className="host-knowledge-card">
      <div className="host-knowledge-card__header">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span className="host-knowledge-card__title">Known host</span>
        <button className="host-knowledge-card__close" onClick={handleDismiss} title="Dismiss">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="host-knowledge-card__stats">
        <div className="host-knowledge-card__stat">
          <span className="host-knowledge-card__stat-value">{hostSessions.length}</span>
          <span className="host-knowledge-card__stat-label">
            session{hostSessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {lastSession && (
          <div className="host-knowledge-card__stat">
            <span className="host-knowledge-card__stat-value">
              {formatRelativeTime(lastSession.disconnectedAt!)}
            </span>
            <span className="host-knowledge-card__stat-label">last visit</span>
          </div>
        )}
      </div>

      {lastError && (
        <div className="host-knowledge-card__error">
          <span className="host-knowledge-card__error-type">{lastError.errorType}</span>
          <span className="host-knowledge-card__error-line">{lastError.errorLine}</span>
          {lastError.timestamp && (
            <span className="host-knowledge-card__error-time">
              {formatRelativeTime(lastError.timestamp)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
