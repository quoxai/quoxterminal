/**
 * SessionRestoreBanner — Offers to restore previous terminal sessions
 *
 * Shown on app launch when the previous session had active connections.
 * SSH sessions can be auto-reconnected; local sessions show as informational.
 */

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: "rgba(16, 185, 129, 0.1)",
        borderBottom: "1px solid rgba(16, 185, 129, 0.2)",
        fontSize: 13,
        color: "rgba(255, 255, 255, 0.8)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      <span style={{ flex: 1 }}>
        Restore previous session? {parts.join(" and ")}
      </span>
      {sshSessions.length > 0 && (
        <button
          onClick={onRestore}
          style={{
            padding: "4px 12px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 4,
            color: "#10b981",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Reconnect
        </button>
      )}
      <button
        onClick={onDismiss}
        style={{
          padding: "4px 8px",
          background: "transparent",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 4,
          color: "rgba(255, 255, 255, 0.5)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
