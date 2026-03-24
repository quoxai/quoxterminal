/**
 * FileTreeItem — Single row in the file tree.
 *
 * Renders: indent guides + chevron (dirs) + icon + label + size badge.
 * 28px row height, full-width hover, selected state with left border.
 */

import { useCallback, type MouseEvent } from "react";
import { getFileIcon } from "./fileIcons";

export interface FileTreeItemProps {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  isHidden: boolean;
  isSymlink: boolean;
  extension: string;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onClick: (path: string, isDir: boolean) => void;
  onContextMenu?: (e: MouseEvent, path: string, isDir: boolean) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileTreeItem({
  name,
  path,
  isDir,
  size,
  isHidden,
  isSymlink,
  depth,
  isExpanded,
  isSelected,
  onClick,
  onContextMenu,
}: FileTreeItemProps) {
  const icon = getFileIcon(name, isDir, isExpanded);

  const handleClick = useCallback(() => {
    onClick(path, isDir);
  }, [onClick, path, isDir]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(e, path, isDir);
    },
    [onContextMenu, path, isDir],
  );

  const indent = depth * 16; // --fe-tree-indent

  return (
    <div
      className={`fe-tree-item ${isSelected ? "fe-tree-item--selected" : ""} ${isHidden ? "fe-tree-item--hidden" : ""}`}
      style={{ paddingLeft: `${indent + 12}px` }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      aria-selected={isSelected}
      data-path={path}
    >
      {/* Indent guides */}
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="fe-tree-item__guide"
          style={{ left: `${i * 16 + 20}px` }}
        />
      ))}

      {/* Chevron for directories */}
      {isDir ? (
        <span
          className={`fe-tree-item__chevron ${isExpanded ? "fe-tree-item__chevron--open" : ""}`}
        >
          ▸
        </span>
      ) : (
        <span className="fe-tree-item__chevron-spacer" />
      )}

      {/* File/folder icon */}
      <span
        className="fe-tree-item__icon"
        style={{ color: icon.color }}
        title={icon.label}
      >
        {isDir ? (isExpanded ? "▾" : "▸") : icon.icon}
      </span>

      {/* Name */}
      <span
        className={`fe-tree-item__name ${isDir ? "fe-tree-item__name--dir" : ""}`}
      >
        {name}
        {isSymlink && <span className="fe-tree-item__symlink">→</span>}
      </span>

      {/* Size badge (files only) */}
      {!isDir && size > 0 && (
        <span className="fe-tree-item__size">{formatSize(size)}</span>
      )}
    </div>
  );
}
