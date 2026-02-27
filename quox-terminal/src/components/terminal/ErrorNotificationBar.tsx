/**
 * ErrorNotificationBar -- slides up from terminal pane bottom when an error is detected.
 *
 * Ported from quox-source/src/components/terminal/ErrorNotificationBar.jsx
 */

import type { DetectedError } from '../../utils/terminalErrorDetector';
import './ErrorNotificationBar.css';

interface ErrorNotificationBarProps {
  error: DetectedError | null;
  onAction: (action: 'explain' | 'fix', error: DetectedError) => void;
  onDismiss: () => void;
  mode: string;
}

export default function ErrorNotificationBar({
  error,
  onAction,
  onDismiss,
  mode,
}: ErrorNotificationBarProps) {
  if (!error) return null;

  const isAudit = mode === 'audit';
  const truncatedLine =
    error.errorLine.length > 60
      ? error.errorLine.substring(0, 57) + '...'
      : error.errorLine;

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
