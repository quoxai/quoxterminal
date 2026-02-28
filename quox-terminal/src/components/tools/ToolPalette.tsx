/**
 * ToolPalette — Sidebar with one-click access to Quox CLI tools
 *
 * Follows the FleetDashboard sidebar pattern: 380px, slide-in, BEM CSS.
 * Groups tools by category with search filtering and collapsible sections.
 */

import { useState, useMemo } from "react";
import {
  getToolsByCategory,
  getCategoryLabel,
  buildCommand,
  type ToolDefinition,
  type ToolCategory,
} from "../../services/toolRegistry";
import ToolParamModal from "./ToolParamModal";
import "./ToolPalette.css";

interface ToolPaletteProps {
  onClose: () => void;
  onExecute: (command: string) => void;
}

const CATEGORY_ORDER: ToolCategory[] = [
  "fleet",
  "ops",
  "ai",
  "workflows",
  "memory",
  "monitoring",
  "admin",
  "tui",
];

export default function ToolPalette({ onClose, onExecute }: ToolPaletteProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [paramTool, setParamTool] = useState<ToolDefinition | null>(null);

  const toolsByCategory = useMemo(() => getToolsByCategory(), []);

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return toolsByCategory;

    const result: Partial<Record<ToolCategory, ToolDefinition[]>> = {};
    for (const [cat, tools] of Object.entries(toolsByCategory)) {
      const matches = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.command.toLowerCase().includes(query),
      );
      if (matches.length > 0) {
        result[cat as ToolCategory] = matches;
      }
    }
    return result as Record<ToolCategory, ToolDefinition[]>;
  }, [search, toolsByCategory]);

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleToolClick = (tool: ToolDefinition) => {
    if (tool.params && tool.params.length > 0) {
      setParamTool(tool);
    } else {
      onExecute(buildCommand(tool));
    }
  };

  return (
    <div className="tool-palette" data-testid="tool-palette">
      {/* Header */}
      <div className="tool-palette__header">
        <div className="tool-palette__header-left">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span className="tool-palette__header-title">Tools</span>
        </div>
        <button
          className="tool-palette__close-btn"
          onClick={onClose}
          title="Close"
        >
          &times;
        </button>
      </div>

      {/* Search */}
      <div className="tool-palette__search-wrap">
        <input
          className="tool-palette__search"
          type="text"
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Tool list */}
      <div className="tool-palette__list">
        {CATEGORY_ORDER.map((cat) => {
          const tools = filteredCategories[cat];
          if (!tools || tools.length === 0) return null;
          const isCollapsed = collapsed[cat];

          return (
            <div key={cat} className="tool-palette__category">
              <button
                className="tool-palette__category-header"
                onClick={() => toggleCategory(cat)}
              >
                <svg
                  className={`tool-palette__chevron ${isCollapsed ? "tool-palette__chevron--collapsed" : ""}`}
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="tool-palette__category-label">
                  {getCategoryLabel(cat)}
                </span>
                <span className="tool-palette__category-count">
                  {tools.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="tool-palette__category-tools">
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      className="tool-palette__tool-btn"
                      onClick={() => handleToolClick(tool)}
                      title={`${tool.name}: ${tool.description}`}
                    >
                      <div className="tool-palette__tool-info">
                        <span className="tool-palette__tool-name">
                          {tool.name}
                        </span>
                        <span className="tool-palette__tool-desc">
                          {tool.description}
                        </span>
                      </div>
                      <svg
                        className="tool-palette__play-icon"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="tool-palette__empty">
            No tools match "{search}"
          </div>
        )}
      </div>

      {/* Parameter modal */}
      {paramTool && (
        <ToolParamModal
          tool={paramTool}
          onExecute={(cmd) => {
            onExecute(cmd);
            setParamTool(null);
          }}
          onClose={() => setParamTool(null)}
        />
      )}
    </div>
  );
}
