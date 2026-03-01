/**
 * ClaudeProjectBadge — Subtle indicator in pane header when Claude project detected.
 *
 * Shows a small badge when the pane's cwd has CLAUDE.md or .claude/ directory.
 */

import "./ClaudeProjectBadge.css";

interface ClaudeProjectBadgeProps {
  hasClaudeMd: boolean;
  hasClaudeDir: boolean;
  onClick?: () => void;
}

export default function ClaudeProjectBadge({
  hasClaudeMd,
  hasClaudeDir,
  onClick,
}: ClaudeProjectBadgeProps) {
  if (!hasClaudeMd && !hasClaudeDir) return null;

  const title = [
    hasClaudeMd && "CLAUDE.md",
    hasClaudeDir && ".claude/",
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <span
      className="claude-project-badge"
      title={`Claude project: ${title}`}
      onClick={onClick}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    </span>
  );
}
