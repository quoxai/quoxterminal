/**
 * FileTree — Recursive lazy-loading directory tree.
 *
 * Fetches directory contents on first expand via fsListDir.
 * Manages expanded/selected state. Supports keyboard navigation
 * (arrow keys, Enter to open/expand, Backspace to go up).
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { fsListDir, type DirEntry } from "../../lib/tauri-fs";
import FileTreeItem from "./FileTreeItem";

export interface FileTreeProps {
  rootPath: string;
  selectedPath: string | null;
  onFileOpen: (path: string) => void;
  onSelectChange?: (path: string | null) => void;
  filterText?: string;
}

interface TreeNode {
  entry: DirEntry;
  children: TreeNode[] | null; // null = not loaded yet
  loading: boolean;
}

/** Recursively flatten the tree into a visible list for keyboard navigation. */
function flattenVisible(
  nodes: TreeNode[],
  expanded: Set<string>,
  filter: string,
  depth = 0,
): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = [];
  for (const node of nodes) {
    // Apply filter (only to files, always show dirs)
    if (filter && !node.entry.is_dir) {
      if (!node.entry.name.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }
    }

    result.push({ node, depth });

    if (node.entry.is_dir && expanded.has(node.entry.path) && node.children) {
      result.push(...flattenVisible(node.children, expanded, filter, depth + 1));
    }
  }
  return result;
}

export default function FileTree({
  rootPath,
  selectedPath,
  onFileOpen,
  onSelectChange,
  filterText = "",
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load root directory on mount or rootPath change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fsListDir(rootPath)
      .then((entries) => {
        if (cancelled) return;
        setRootNodes(
          entries.map((entry) => ({
            entry,
            children: entry.is_dir ? null : [],
            loading: false,
          })),
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  // Load children when a directory is expanded for the first time
  const loadChildren = useCallback(
    async (dirPath: string) => {
      try {
        const entries = await fsListDir(dirPath);
        const children: TreeNode[] = entries.map((entry) => ({
          entry,
          children: entry.is_dir ? null : [],
          loading: false,
        }));

        setRootNodes((prev) => updateNodeChildren(prev, dirPath, children));
      } catch {
        // Failed to load — collapse the directory
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
      }
    },
    [],
  );

  const handleClick = useCallback(
    (path: string, isDir: boolean) => {
      onSelectChange?.(path);

      if (isDir) {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(path)) {
            next.delete(path);
          } else {
            next.add(path);
            // Load children if not yet loaded
            const node = findNode(rootNodes, path);
            if (node && node.children === null) {
              loadChildren(path);
            }
          }
          return next;
        });
      } else {
        onFileOpen(path);
      }
    },
    [rootNodes, onFileOpen, onSelectChange, loadChildren],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const visible = flattenVisible(rootNodes, expanded, filterText);
      const selectedIdx = visible.findIndex(
        (v) => v.node.entry.path === selectedPath,
      );

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = Math.min(selectedIdx + 1, visible.length - 1);
          onSelectChange?.(visible[nextIdx]?.node.entry.path ?? null);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx = Math.max(selectedIdx - 1, 0);
          onSelectChange?.(visible[prevIdx]?.node.entry.path ?? null);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (selectedPath) {
            const item = visible[selectedIdx];
            if (item?.node.entry.is_dir && !expanded.has(selectedPath)) {
              handleClick(selectedPath, true);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (selectedPath) {
            const item = visible[selectedIdx];
            if (item?.node.entry.is_dir && expanded.has(selectedPath)) {
              handleClick(selectedPath, true);
            } else {
              // Select parent
              const parentPath = selectedPath.substring(
                0,
                selectedPath.lastIndexOf("/"),
              );
              if (parentPath && parentPath !== rootPath) {
                onSelectChange?.(parentPath);
              }
            }
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (selectedPath) {
            const item = visible[selectedIdx];
            if (item) {
              handleClick(selectedPath, item.node.entry.is_dir);
            }
          }
          break;
        }
        case "Backspace": {
          e.preventDefault();
          // Navigate up to parent directory
          if (selectedPath) {
            const parentPath = selectedPath.substring(
              0,
              selectedPath.lastIndexOf("/"),
            );
            if (parentPath && parentPath.length >= rootPath.length) {
              onSelectChange?.(parentPath);
            }
          }
          break;
        }
      }
    },
    [rootNodes, expanded, selectedPath, rootPath, filterText, onSelectChange, handleClick],
  );

  const visible = flattenVisible(rootNodes, expanded, filterText);

  if (loading) {
    return (
      <div className="fe-tree fe-tree--loading" role="tree">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="fe-tree__skeleton"
            style={{
              animationDelay: `${i * 30}ms`,
              paddingLeft: `${12 + (i % 3) * 16}px`,
            }}
          >
            <span className="fe-tree__skeleton-icon" />
            <span
              className="fe-tree__skeleton-label"
              style={{ width: `${50 + Math.random() * 80}px` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="fe-tree fe-tree--error" role="tree">
        <div className="fe-tree__error">
          <span className="fe-tree__error-icon">!</span>
          <span className="fe-tree__error-text">{error}</span>
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="fe-tree fe-tree--empty" role="tree">
        <div className="fe-tree__empty">
          {filterText
            ? `No files matching "${filterText}"`
            : "This folder is empty"}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fe-tree"
      ref={containerRef}
      role="tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {visible.map(({ node, depth }) => (
        <FileTreeItem
          key={node.entry.path}
          name={node.entry.name}
          path={node.entry.path}
          isDir={node.entry.is_dir}
          size={node.entry.size}
          isHidden={node.entry.is_hidden}
          isSymlink={node.entry.is_symlink}
          extension={node.entry.extension}
          depth={depth}
          isExpanded={expanded.has(node.entry.path)}
          isSelected={selectedPath === node.entry.path}
          onClick={handleClick}
        />
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Find a node by path in the tree. */
function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.entry.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Immutably update a node's children in the tree. */
function updateNodeChildren(
  nodes: TreeNode[],
  dirPath: string,
  children: TreeNode[],
): TreeNode[] {
  return nodes.map((node) => {
    if (node.entry.path === dirPath) {
      return { ...node, children, loading: false };
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeChildren(node.children, dirPath, children),
      };
    }
    return node;
  });
}
