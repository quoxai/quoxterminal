/**
 * ClaudeMdViewer — Modal overlay that displays the contents of a CLAUDE.md file.
 * Uses Tauri fs_read_file invoke to read the file from disk.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ClaudeMdViewer.css";

interface ClaudeMdViewerProps {
  filePath: string;
  onClose: () => void;
}

export default function ClaudeMdViewer({ filePath, onClose }: ClaudeMdViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("fs_read_file", { path: filePath })
      .then((text) => setContent(text))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [filePath]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="claude-md-viewer__backdrop" onClick={handleBackdropClick} role="presentation">
      <div className="claude-md-viewer" role="dialog" aria-modal="true" aria-label="CLAUDE.md viewer">
        <div className="claude-md-viewer__header">
          <span className="claude-md-viewer__title">CLAUDE.md</span>
          <span className="claude-md-viewer__path">{filePath}</span>
          <div className="claude-md-viewer__spacer" />
          <button className="claude-md-viewer__close" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="claude-md-viewer__body">
          {error && (
            <div className="claude-md-viewer__error">Failed to read file: {error}</div>
          )}
          {content === null && !error && (
            <div className="claude-md-viewer__loading">Loading...</div>
          )}
          {content !== null && (
            <pre className="claude-md-viewer__content">{content}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
