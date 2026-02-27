/**
 * SessionRestoreBanner — Offers to restore previous terminal sessions
 *
 * Shown on app launch when the previous session had active connections.
 * SSH sessions can be auto-reconnected; local sessions show as informational.
 */

import './SessionRestoreBanner.css';

interface PreviousSession {
  paneId: string;
  mode: string;
  hostId: string;
  workspaceName: string;
}

interface SessionRestoreBannerProps {
  sessions: PreviousSession[];
  onRestore: () => void;
  onDismiss: () => void;
}

export default function SessionRestoreBanner({
  sessions,
  onRestore,
  onDismiss,
}: SessionRestoreBannerProps) {
  const sshSessions = sessions.filter((s) => s.mode === "ssh" && s.hostId);
  const localSessions = sessions.filter((s) => s.mode === "local");

  // Build a summary description
  const parts: string[] = [];
  if (sshSessions.length > 0) {
    const hosts = [...new Set(sshSessions.map((s) => s.hostId))];
    parts.push(
      `${sshSessions.length} SSH session${sshSessions.length > 1 ? "s" : ""} (${hosts.join(", ")})`,
    );
  }
  if (localSessions.length > 0) {
    parts.push(
      `${localSessions.length} local session${localSessions.length > 1 ? "s" : ""}`,
    );
  }

  return (
    <div className="session-restore-banner">
      <svg
        className="session-restore-banner__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      <span className="session-restore-banner__text">
        Restore previous session? {parts.join(" and ")}
      </span>
      {sshSessions.length > 0 && (
        <button className="session-restore-banner__btn--restore" onClick={onRestore}>
          Reconnect
        </button>
      )}
      <button className="session-restore-banner__btn--dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
