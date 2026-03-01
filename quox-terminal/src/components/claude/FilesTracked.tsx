/**
 * FilesTracked — File heat map list for Claude context panel.
 *
 * Shows files touched by Claude with action indicators (read, edited, created).
 */

import type { TrackedFile } from "../../services/claudeSessionTracker";
import "./FilesTracked.css";

interface FilesTrackedProps {
  files: TrackedFile[];
  onFileClick?: (path: string, toolCallId: string) => void;
}

function getActionDot(actions: string[]): { color: string; label: string } {
  if (actions.includes("created")) return { color: "#facc15", label: "Created" };
  if (actions.includes("edited")) return { color: "#4ade80", label: "Edited" };
  return { color: "#38bdf8", label: "Read" };
}

function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function getDirectory(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export default function FilesTracked({
  files,
  onFileClick,
}: FilesTrackedProps) {
  if (files.length === 0) {
    return (
      <div className="files-tracked files-tracked--empty">
        <span className="files-tracked__empty-text">No files touched yet</span>
      </div>
    );
  }

  return (
    <div className="files-tracked">
      <div className="files-tracked__header">
        Files Touched ({files.length})
      </div>
      <div className="files-tracked__list">
        {files.map((f) => {
          const dot = getActionDot(f.actions);
          const fileName = getFileName(f.path);
          const dir = getDirectory(f.path);
          return (
            <div
              key={f.path}
              className="files-tracked__item"
              onClick={() => onFileClick?.(f.path, f.lastToolCallId)}
              title={`${f.path} — ${f.actions.join(", ")} (${f.touchCount}x)`}
            >
              <span
                className="files-tracked__dot"
                style={{ background: dot.color }}
                title={dot.label}
              />
              <span className="files-tracked__name">{fileName}</span>
              {dir && (
                <span className="files-tracked__dir">{dir}</span>
              )}
              {f.touchCount > 1 && (
                <span className="files-tracked__count">
                  {f.touchCount}x
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
