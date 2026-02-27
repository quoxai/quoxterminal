/**
 * FileChangeGroup
 *
 * Context provider + toolbar for coordinating multiple FileChangeCards in a single
 * AI response message. When 2+ file blocks exist, renders a toolbar with:
 * - File count badge
 * - Expand All / Collapse All
 * - Apply All with sequential progress
 *
 * Also handles strict mode batch confirmation via FileApplyConfirmModal.
 *
 * Ported from quox-source/src/components/terminal/FileChangeGroup.jsx
 */

import {
  createContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { getFilePolicy, type FilePolicy, type PathSeverity } from '../../services/terminalFileService';
import FileApplyConfirmModal from './FileApplyConfirmModal';
import './FileChangeGroup.css';

// ---- Types -----------------------------------------------------------------

interface CardHandlers {
  filePath: string;
  action: string;
  applyState: string;
  targetPath?: string;
  severity: PathSeverity;
  doApply: () => Promise<void> | void;
  setExpanded: (v: boolean) => void;
}

export interface FileChangeGroupContextValue {
  register: (id: string, handlers: CardHandlers) => void;
  unregister: (id: string) => void;
  updateCard: (id: string, updates: Partial<CardHandlers>) => void;
  mode: string;
  policy: FilePolicy;
}

interface BatchProgress {
  current: number;
  total: number;
}

interface ConfirmModal {
  files: Array<{ filePath: string; action: string; severity: PathSeverity }>;
  onConfirm: () => void;
}

export const FileChangeGroupContext =
  createContext<FileChangeGroupContextValue | null>(null);

// ---- Toolbar ---------------------------------------------------------------

interface ToolbarProps {
  cardCount: number;
  batchState: string;
  batchProgress: BatchProgress;
  allApplied: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onApplyAll: () => void;
  showApply: boolean;
  noSession: boolean;
}

function FileChangeGroupToolbar({
  cardCount,
  batchState,
  batchProgress,
  allApplied,
  onExpandAll,
  onCollapseAll,
  onApplyAll,
  showApply,
  noSession,
}: ToolbarProps) {
  return (
    <div className="file-change-group__toolbar">
      <div className="file-change-group__toolbar-left">
        <span className="file-change-group__count">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {cardCount} file changes
        </span>
      </div>
      <div className="file-change-group__toolbar-right">
        <button
          className="file-change-group__btn"
          onClick={onExpandAll}
          title="Expand all cards"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Expand
        </button>
        <button
          className="file-change-group__btn"
          onClick={onCollapseAll}
          title="Collapse all cards"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          Collapse
        </button>
        {showApply && (
          <button
            className={`file-change-group__btn file-change-group__btn--apply ${allApplied ? 'file-change-group__btn--done' : ''}`}
            onClick={onApplyAll}
            disabled={noSession || batchState === 'applying' || allApplied}
            title={
              noSession
                ? 'No active terminal session'
                : 'Apply all file changes'
            }
          >
            {batchState === 'applying' ? (
              <>
                <span className="file-change-group__spinner" />
                {batchProgress.current}/{batchProgress.total}
              </>
            ) : allApplied ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                All Applied
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Apply All
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Provider --------------------------------------------------------------

interface FileChangeGroupProviderProps {
  children: ReactNode;
  mode: string;
  sessionId: string | null;
}

export function FileChangeGroupProvider({
  children,
  mode,
  sessionId,
}: FileChangeGroupProviderProps) {
  const cardsRef = useRef<Map<string, CardHandlers>>(new Map());
  const [cardCount, setCardCount] = useState(0);
  const [batchState, setBatchState] = useState('idle');
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    current: 0,
    total: 0,
  });
  const [allApplied, setAllApplied] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  const policy = getFilePolicy(mode);
  const isAudit = mode === 'audit';
  const noSession = !sessionId;

  const register = useCallback((id: string, handlers: CardHandlers) => {
    cardsRef.current.set(id, handlers);
    setCardCount(cardsRef.current.size);
  }, []);

  const unregister = useCallback((id: string) => {
    cardsRef.current.delete(id);
    setCardCount(cardsRef.current.size);
  }, []);

  const updateCard = useCallback(
    (id: string, updates: Partial<CardHandlers>) => {
      const existing = cardsRef.current.get(id);
      if (existing) {
        cardsRef.current.set(id, { ...existing, ...updates });
      }
    },
    [],
  );

  const expandAll = useCallback(() => {
    for (const card of cardsRef.current.values()) {
      if (card.setExpanded) card.setExpanded(true);
    }
  }, []);

  const collapseAll = useCallback(() => {
    for (const card of cardsRef.current.values()) {
      if (card.setExpanded) card.setExpanded(false);
    }
  }, []);

  const executeBatchApply = useCallback(async () => {
    const cards = Array.from(cardsRef.current.values());
    const applyable = cards.filter(
      (c) => c.applyState === 'idle' && c.doApply,
    );

    if (applyable.length === 0) return;

    setBatchState('applying');
    setBatchProgress({ current: 0, total: applyable.length });

    for (let i = 0; i < applyable.length; i++) {
      setBatchProgress({ current: i + 1, total: applyable.length });
      await applyable[i].doApply();
    }

    setBatchState('done');
    setAllApplied(true);
  }, []);

  const applyAll = useCallback(async () => {
    if (policy.requireConfirmModal) {
      const cards = Array.from(cardsRef.current.values());
      const files = cards
        .filter((c) => c.applyState === 'idle')
        .map((c) => ({
          filePath: c.filePath,
          action: c.action,
          severity: c.severity,
        }));

      if (files.length === 0) return;

      setConfirmModal({
        files,
        onConfirm: () => {
          setConfirmModal(null);
          executeBatchApply();
        },
      });
    } else {
      executeBatchApply();
    }
  }, [policy.requireConfirmModal, executeBatchApply]);

  const handleConfirmClose = useCallback(() => {
    setConfirmModal(null);
  }, []);

  const showToolbar = cardCount > 1;
  const showApply = policy.showApplyButtons && !isAudit;

  const contextValue = useMemo(
    () => ({
      register,
      unregister,
      updateCard,
      mode,
      policy,
    }),
    [register, unregister, updateCard, mode, policy],
  );

  return (
    <FileChangeGroupContext.Provider value={contextValue}>
      {showToolbar && (
        <FileChangeGroupToolbar
          cardCount={cardCount}
          batchState={batchState}
          batchProgress={batchProgress}
          allApplied={allApplied}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onApplyAll={applyAll}
          showApply={showApply}
          noSession={noSession}
        />
      )}
      {children}
      {confirmModal && (
        <FileApplyConfirmModal
          isOpen={true}
          onClose={handleConfirmClose}
          files={confirmModal.files}
          onConfirm={confirmModal.onConfirm}
          mode="batch"
        />
      )}
    </FileChangeGroupContext.Provider>
  );
}
