/**
 * FileEditorTabs — Tab bar for open files + breadcrumb path display.
 *
 * Active tab gets cyan top border. Modified files show a cyan dot.
 * Close button on each tab. Breadcrumb shows path segments of active file.
 */

import { useCallback, type MouseEvent } from "react";
import { getFileIcon } from "./fileIcons";

export interface OpenFile {
  path: string;
  name: string;
  dirty: boolean;
}

interface FileEditorTabsProps {
  files: OpenFile[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
}

export default function FileEditorTabs({
  files,
  activeFilePath,
  onSelectFile,
  onCloseFile,
}: FileEditorTabsProps) {
  const handleClose = useCallback(
    (e: MouseEvent, path: string) => {
      e.stopPropagation();
      onCloseFile(path);
    },
    [onCloseFile],
  );

  // Breadcrumb from active file path
  const activeFile = files.find((f) => f.path === activeFilePath);
  const breadcrumbSegments = activeFilePath
    ? activeFilePath.split("/").filter(Boolean)
    : [];

  return (
    <div className="fe-editor-tabs-wrapper">
      {/* Tab bar */}
      <div className="fe-editor-tabs">
        {files.map((file) => {
          const isActive = file.path === activeFilePath;
          const icon = getFileIcon(file.name, false);

          return (
            <button
              key={file.path}
              className={`fe-editor-tab ${isActive ? "fe-editor-tab--active" : ""}`}
              onClick={() => onSelectFile(file.path)}
              title={file.path}
            >
              <span
                className="fe-editor-tab__icon"
                style={{ color: icon.color }}
              >
                {icon.icon}
              </span>
              <span className="fe-editor-tab__name">{file.name}</span>
              {file.dirty && !isActive ? (
                <span className="fe-editor-tab__dirty" title="Unsaved changes">
                  ●
                </span>
              ) : (
                <span
                  className="fe-editor-tab__close"
                  onClick={(e) => handleClose(e, file.path)}
                  title="Close"
                >
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Breadcrumb */}
      {activeFile && (
        <div className="fe-editor-breadcrumb">
          {breadcrumbSegments.map((seg, i) => (
            <span key={i}>
              {i > 0 && (
                <span className="fe-editor-breadcrumb__sep">›</span>
              )}
              <span
                className={
                  i === breadcrumbSegments.length - 1
                    ? "fe-editor-breadcrumb__current"
                    : "fe-editor-breadcrumb__segment"
                }
              >
                {seg}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
