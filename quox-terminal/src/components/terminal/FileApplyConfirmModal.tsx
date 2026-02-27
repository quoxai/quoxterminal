/**
 * FileApplyConfirmModal
 *
 * Confirmation modal for file operations in strict mode.
 * Two modes:
 *   - single: Confirms a single file apply (path, action, severity, preview)
 *   - batch:  Confirms Apply All with a file list summary
 *
 * Ported from quox-source/src/components/terminal/FileApplyConfirmModal.jsx
 * Uses the local Modal component.
 */

import Modal from '../ui/Modal';
import { validateFilePath, type PathSeverity } from '../../services/terminalFileService';
import './FileApplyConfirmModal.css';

// ---- Types -----------------------------------------------------------------

interface BatchFile {
  filePath: string;
  action: string;
  severity?: PathSeverity;
}

interface FileApplyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'single' | 'batch';
  filePath?: string;
  action?: string;
  content?: string;
  severity?: PathSeverity;
  files?: BatchFile[];
}

// ---- Constants -------------------------------------------------------------

const SEVERITY_MODAL_MAP: Record<string, 'info' | 'warning' | 'danger'> = {
  GREEN: 'info',
  AMBER: 'warning',
  RED: 'danger',
  BLOCKED: 'danger',
};

const SEVERITY_COLORS: Record<string, string> = {
  GREEN: '#22c55e',
  AMBER: '#ffb030',
  RED: '#ff4444',
  BLOCKED: '#ff4444',
};

// ---- Sub-components --------------------------------------------------------

function SingleFileContent({
  filePath,
  action,
  content,
  severity,
}: {
  filePath: string;
  action: string;
  content: string;
  severity?: PathSeverity;
}) {
  const previewLines = (content || '').split('\n').slice(0, 10);
  const truncated = (content || '').split('\n').length > 10;
  const validation = validateFilePath(filePath);

  return (
    <div className="file-apply-confirm__content">
      {/* File path */}
      <div className="file-apply-confirm__field">
        <div className="file-apply-confirm__label">File</div>
        <code className="file-apply-confirm__path">{filePath}</code>
      </div>

      {/* Action + severity */}
      <div className="file-apply-confirm__row">
        <div className="file-apply-confirm__field">
          <div className="file-apply-confirm__label">Action</div>
          <span
            className="file-apply-confirm__action-badge"
            style={{
              color: action === 'edit' ? '#f59e0b' : '#22c55e',
            }}
          >
            {action.toUpperCase()}
          </span>
        </div>
        <div className="file-apply-confirm__field">
          <div className="file-apply-confirm__label">Path Risk</div>
          <span
            className="file-apply-confirm__severity-badge"
            style={{
              color:
                SEVERITY_COLORS[severity || validation.severity] || '#22c55e',
            }}
          >
            {severity || validation.severity}
          </span>
        </div>
      </div>

      {/* Warning for non-green paths */}
      {validation.severity !== 'GREEN' && validation.reason && (
        <div className="file-apply-confirm__warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          {validation.reason}
        </div>
      )}

      {/* Content preview */}
      <div className="file-apply-confirm__field">
        <div className="file-apply-confirm__label">Preview</div>
        <pre className="file-apply-confirm__preview">
          <code>{previewLines.join('\n')}</code>
          {truncated && (
            <span className="file-apply-confirm__truncated">
              ... truncated
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}

function BatchFileContent({ files }: { files: BatchFile[] }) {
  return (
    <div className="file-apply-confirm__content">
      <div className="file-apply-confirm__batch-list">
        {files.map((f, i) => {
          const validation = validateFilePath(f.filePath);
          const sevColor =
            SEVERITY_COLORS[f.severity || validation.severity] || '#22c55e';
          return (
            <div key={i} className="file-apply-confirm__batch-item">
              <span
                className="file-apply-confirm__batch-icon"
                style={{
                  color: f.action === 'edit' ? '#f59e0b' : '#22c55e',
                }}
              >
                {f.action === 'edit' ? '\u270E' : '\u271A'}
              </span>
              <code className="file-apply-confirm__batch-path">
                {f.filePath}
              </code>
              <span
                className="file-apply-confirm__batch-action"
                style={{
                  color: f.action === 'edit' ? '#f59e0b' : '#22c55e',
                }}
              >
                {f.action.toUpperCase()}
              </span>
              {(f.severity || validation.severity) !== 'GREEN' && (
                <span
                  className="file-apply-confirm__batch-severity"
                  style={{ color: sevColor }}
                >
                  {f.severity || validation.severity}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main Component --------------------------------------------------------

export default function FileApplyConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  mode,
  filePath,
  action,
  content,
  severity,
  files,
}: FileApplyConfirmModalProps) {
  const isBatch = mode === 'batch';
  const fileCount = isBatch ? (files || []).length : 1;

  // Determine modal severity from worst file
  let modalSeverity: 'info' | 'warning' | 'danger' = 'info';
  if (isBatch) {
    for (const f of files || []) {
      const v = validateFilePath(f.filePath);
      const sev = f.severity || v.severity;
      if (sev === 'RED' || sev === 'BLOCKED') {
        modalSeverity = 'danger';
        break;
      }
      if (sev === 'AMBER') modalSeverity = 'warning';
    }
  } else if (filePath) {
    const v = validateFilePath(filePath);
    modalSeverity =
      SEVERITY_MODAL_MAP[severity || v.severity] || 'info';
  }

  const actionLabel =
    action === 'edit'
      ? 'Edit'
      : action === 'delete'
        ? 'Delete'
        : action === 'rename'
          ? 'Rename'
          : 'Create';

  const title = isBatch ? `Apply ${fileCount} Files` : `${actionLabel} File`;

  const icon = isBatch ? (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ) : action === 'edit' ? (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} severity={modalSeverity}>
      {/* Header with icon and badge */}
      <div className="file-apply-confirm__header">
        <div className="file-apply-confirm__header-icon">{icon}</div>
        <div className="file-apply-confirm__header-text">
          <h4>{title}</h4>
          <p>Strict mode requires confirmation before file changes</p>
        </div>
        <span className="file-apply-confirm__header-badge">CONFIRM</span>
      </div>

      {/* Body content */}
      {isBatch ? (
        <BatchFileContent files={files || []} />
      ) : (
        <SingleFileContent
          filePath={filePath || ''}
          action={action || 'create'}
          content={content || ''}
          severity={severity}
        />
      )}

      {/* Footer buttons */}
      <div className="file-apply-confirm__footer">
        <button
          className="file-apply-confirm__btn file-apply-confirm__btn--cancel"
          onClick={onClose}
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
          className={`file-apply-confirm__btn ${
            modalSeverity === 'danger'
              ? 'file-apply-confirm__btn--danger'
              : 'file-apply-confirm__btn--confirm'
          }`}
          onClick={onConfirm}
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {isBatch ? `Apply ${fileCount} Files` : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
