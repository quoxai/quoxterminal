/**
 * FileExplorer — Left sidebar with file tree, filter input, and footer.
 *
 * Follows the same toggle/sidebar pattern as FleetDashboard, TerminalChat,
 * and ToolPalette. 240px default width, slide-in from left.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import FileTree from "./FileTree";
import "./FileExplorer.css";

interface FileExplorerProps {
  rootPath: string;
  onFileOpen: (path: string) => void;
  onClose: () => void;
}

export default function FileExplorer({
  rootPath,
  onFileOpen,
  onClose,
}: FileExplorerProps) {
  const [filterText, setFilterText] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const filterRef = useRef<HTMLInputElement>(null);

  // Focus filter input on mount
  useEffect(() => {
    // Small delay to let the slide-in animation start
    const timer = setTimeout(() => filterRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleFileOpen = useCallback(
    (path: string) => {
      onFileOpen(path);
    },
    [onFileOpen],
  );

  // Breadcrumb from rootPath
  const pathSegments = rootPath.split("/").filter(Boolean);
  const displayPath =
    pathSegments.length > 3
      ? `.../${pathSegments.slice(-2).join("/")}`
      : rootPath;

  return (
    <div className="fe-explorer">
      {/* Header */}
      <div className="fe-explorer__header">
        <span className="fe-explorer__title">EXPLORER</span>
        <div className="fe-explorer__actions">
          <button
            className="fe-explorer__action-btn"
            onClick={handleRefresh}
            title="Refresh"
          >
            ⟳
          </button>
          <button
            className="fe-explorer__action-btn"
            onClick={onClose}
            title="Close explorer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Root path breadcrumb */}
      <div className="fe-explorer__breadcrumb" title={rootPath}>
        {displayPath}
      </div>

      {/* Filter input */}
      <div className="fe-explorer__filter">
        <input
          ref={filterRef}
          className="fe-explorer__filter-input"
          type="text"
          placeholder="Filter files..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          spellCheck={false}
        />
        {filterText && (
          <button
            className="fe-explorer__filter-clear"
            onClick={() => setFilterText("")}
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      {/* File tree */}
      <div className="fe-explorer__tree">
        <FileTree
          key={refreshKey}
          rootPath={rootPath}
          selectedPath={selectedPath}
          onFileOpen={handleFileOpen}
          onSelectChange={setSelectedPath}
          filterText={filterText}
        />
      </div>
    </div>
  );
}
