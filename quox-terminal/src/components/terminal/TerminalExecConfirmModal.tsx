/**
 * TerminalExecConfirmModal
 *
 * Confirmation modal for commands that require approval before terminal execution.
 * Ported from quox-source/src/components/terminal/TerminalExecConfirmModal.jsx
 *
 * Uses the local Modal component instead of quox-source's Modal + Button.
 * Inline styles preserved from original for severity-aware rendering.
 */

import type { ReactElement } from 'react';
import Modal from '../ui/Modal';

// ---- Types -----------------------------------------------------------------

interface Validation {
  action?: string;
  severity?: string;
  description?: string;
}

interface TerminalExecConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  command: string;
  validation: Validation | null;
  onConfirm: () => void;
}

// ---- Severity colors -------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  GREEN: '#30ff90',
  BLUE: '#3090ff',
  AMBER: '#ffb030',
  ORANGE: '#ff6b30',
  RED: '#ff3030',
  CRITICAL: '#ff0000',
};

function getSeverityColor(severity?: string): string {
  return SEVERITY_COLORS[severity || ''] || '#ffb030';
}

// ---- Action configs --------------------------------------------------------

interface ActionConfig {
  title: string;
  modalSeverity: 'info' | 'warning' | 'danger';
  badge: string;
  confirmLabel: string;
  icon: ReactElement;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  WARN: {
    title: 'Warning',
    modalSeverity: 'warning',
    badge: 'WARNING',
    confirmLabel: 'Run Anyway',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    ),
  },
  REQUIRE_APPROVAL: {
    title: 'Approval Required',
    modalSeverity: 'warning',
    badge: 'APPROVAL',
    confirmLabel: 'Approve & Run',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    ),
  },
  REQUIRE_OVERRIDE: {
    title: 'Override Required',
    modalSeverity: 'danger',
    badge: 'OVERRIDE',
    confirmLabel: 'Override & Run',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
      </svg>
    ),
  },
};

// ---- Component -------------------------------------------------------------

export default function TerminalExecConfirmModal({
  isOpen,
  onClose,
  command,
  validation,
  onConfirm,
}: TerminalExecConfirmModalProps) {
  if (!validation) return null;

  const action = validation.action || 'WARN';
  const config = ACTION_CONFIG[action];
  if (!config) return null;

  const severityColor = getSeverityColor(validation.severity);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      severity={config.modalSeverity}
    >
      {/* Header with icon and badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ flexShrink: 0, color: severityColor }}>
          {config.icon}
        </div>
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            {config.title}
          </h4>
          <p
            style={{
              margin: '0.125rem 0 0',
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.45)',
            }}
          >
            Command requires confirmation before execution
          </p>
        </div>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.6rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: '1px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: severityColor,
            border: `1px solid ${severityColor}40`,
          }}
        >
          {config.badge}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Command Display */}
        <div
          style={{
            padding: '0.875rem 1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#666',
              marginBottom: '0.375rem',
            }}
          >
            Command
          </div>
          <code
            style={{
              display: 'block',
              fontSize: '0.85rem',
              color: severityColor,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            {command}
          </code>
        </div>

        {/* Target */}
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="#666"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#666',
                marginBottom: '0.125rem',
              }}
            >
              Target
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'white',
                fontWeight: 500,
              }}
            >
              Active terminal session
            </div>
          </div>
        </div>

        {/* Reason */}
        <div
          style={{
            padding: '0.75rem 1rem',
            background:
              config.modalSeverity === 'danger'
                ? 'rgba(255, 48, 48, 0.1)'
                : 'rgba(255, 176, 48, 0.1)',
            borderRadius: '8px',
            borderLeft: `3px solid ${severityColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#666',
            }}
          >
            Reason
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'white',
              lineHeight: 1.5,
            }}
          >
            {validation.description ||
              'This command has been flagged for review.'}
          </div>
        </div>

        {/* Severity Badge */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Severity:
          </span>
          <span
            style={{
              padding: '4px 10px',
              background: severityColor,
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '1px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
            }}
          >
            {validation.severity || 'UNKNOWN'}
          </span>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            paddingTop: '0.75rem',
            marginTop: '0.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.8rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="currentColor"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor:
                config.modalSeverity === 'danger'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(34, 197, 94, 0.3)',
              background:
                config.modalSeverity === 'danger'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
              color:
                config.modalSeverity === 'danger' ? '#ef4444' : '#22c55e',
              fontSize: '0.8rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
