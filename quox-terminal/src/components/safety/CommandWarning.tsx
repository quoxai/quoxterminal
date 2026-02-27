import "./CommandWarning.css";

interface CommandWarningProps {
  type: "blocked" | "approval" | "warning";
  command: string;
  severity: string;
  description: string;
  onDismiss: () => void;
  onApprove?: () => void;
}

export default function CommandWarning({
  type,
  command,
  severity,
  description,
  onDismiss,
  onApprove,
}: CommandWarningProps) {
  const severityColors: Record<string, string> = {
    RED: "#ea6c73",
    ORANGE: "#f9af4f",
    AMBER: "#ffb454",
    GREEN: "#91b362",
  };

  const severityIcons: Record<string, string> = {
    RED: "\u26d4",
    ORANGE: "\u26a0\ufe0f",
    AMBER: "\u26a1",
  };

  const color = severityColors[severity] || severityColors.GREEN;
  const icon = severityIcons[severity] || "";

  if (type === "blocked") {
    return (
      <div className="command-warning command-warning--blocked" style={{ borderColor: color }}>
        <div className="command-warning__header">
          <span className="command-warning__icon">{icon}</span>
          <span className="command-warning__title" style={{ color }}>
            Command Blocked
          </span>
        </div>
        <div className="command-warning__description">{description}</div>
        <div className="command-warning__command">
          <code>{command}</code>
        </div>
        <div className="command-warning__actions">
          <button className="command-warning__btn" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (type === "approval") {
    return (
      <div className="command-warning command-warning--approval" style={{ borderColor: color }}>
        <div className="command-warning__header">
          <span className="command-warning__icon">{icon}</span>
          <span className="command-warning__title" style={{ color }}>
            Approval Required
          </span>
        </div>
        <div className="command-warning__description">{description}</div>
        <div className="command-warning__command">
          <code>{command}</code>
        </div>
        <div className="command-warning__actions">
          <button className="command-warning__btn command-warning__btn--cancel" onClick={onDismiss}>
            Cancel
          </button>
          <button
            className="command-warning__btn command-warning__btn--approve"
            onClick={onApprove}
          >
            Execute Anyway
          </button>
        </div>
      </div>
    );
  }

  // Warning toast
  return (
    <div className="command-warning command-warning--warning" style={{ borderColor: color }}>
      <div className="command-warning__header">
        <span className="command-warning__icon">{icon}</span>
        <span className="command-warning__title" style={{ color }}>
          {description}
        </span>
        <button className="command-warning__close" onClick={onDismiss}>
          &times;
        </button>
      </div>
    </div>
  );
}
