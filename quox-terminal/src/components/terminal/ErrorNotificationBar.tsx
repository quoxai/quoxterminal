/**
 * ErrorNotificationBar -- slides up from terminal pane bottom when an error is detected.
 *
 * Ported from quox-source/src/components/terminal/ErrorNotificationBar.jsx
 */

import type { DetectedError } from '../../utils/terminalErrorDetector';
import { getToolById } from '../../services/toolRegistry';
import './ErrorNotificationBar.css';

interface ErrorNotificationBarProps {
  error: DetectedError | null;
  onAction: (action: 'explain' | 'fix', error: DetectedError) => void;
  onDismiss: () => void;
  onToolClick?: (toolId: string) => void;
  mode: string;
}

export default function ErrorNotificationBar({
  error,
  onAction,
  onDismiss,
  onToolClick,
  mode,
}: ErrorNotificationBarProps) {
  if (!error) return null;

  const isAudit = mode === 'audit';
  const truncatedLine =
    error.errorLine.length > 60
      ? error.errorLine.substring(0, 57) + '...'
      : error.errorLine;

  // Resolve suggested tool names
  const suggestedTools = (error.suggestedToolIds || [])
    .map((id) => {
      const tool = getToolById(id);
      return tool ? { id, name: tool.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];

  return (
    <div className="error-notification-bar" role="alert">
      <div className="error-notification-bar__actions">
        <button
          className="error-notification-bar__btn error-notification-bar__btn--explain"
          onClick={() => onAction('explain', error)}
        >
          ? Explain
        </button>
        {!isAudit && (
          <button
            className="error-notification-bar__btn error-notification-bar__btn--fix"
            onClick={() => onAction('fix', error)}
          >
            Fix
          </button>
        )}
        {suggestedTools.length > 0 && onToolClick && suggestedTools.map((t) => (
          <button
            key={t.id}
            className="error-notification-bar__btn error-notification-bar__btn--tool"
            onClick={() => onToolClick(t.id)}
            title={`Quick fix: ${t.name}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="error-notification-bar__content">
        <span className="error-notification-bar__type">
          {error.errorType.replace(/_/g, ' ')}
        </span>
        <span className="error-notification-bar__line" title={error.errorLine}>
          {truncatedLine}
        </span>
      </div>
      <button
        className="error-notification-bar__btn error-notification-bar__btn--dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        &#x2715;
      </button>
    </div>
  );
}
