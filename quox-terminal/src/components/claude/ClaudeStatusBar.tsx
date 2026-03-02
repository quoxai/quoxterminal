/**
 * ClaudeStatusBar — Translucent overlay at bottom of terminal pane in native Claude mode.
 * Shows mode pill, session duration, and project detection badge.
 */

import { useState, useEffect } from "react";
import type { ModeId } from "../../config/terminalModes";
import { TERMINAL_MODES } from "../../config/terminalModes";
import "./ClaudeStatusBar.css";

interface ClaudeStatusBarProps {
  mode: ModeId;
  projectDetected?: boolean;
  sessionStartTime?: number;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function ClaudeStatusBar({
  mode,
  projectDetected,
  sessionStartTime,
}: ClaudeStatusBarProps) {
  const modeInfo = TERMINAL_MODES[mode];
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!sessionStartTime) return;
    const tick = () => setElapsed(formatDuration(Date.now() - sessionStartTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  return (
    <div className="claude-status-bar">
      <span
        className="claude-status-bar__mode"
        style={{ borderColor: modeInfo.color, color: modeInfo.color }}
      >
        {modeInfo.label.toUpperCase()}
      </span>

      {projectDetected && (
        <span className="claude-status-bar__badge">CLAUDE.md</span>
      )}

      <span className="claude-status-bar__spacer" />

      {elapsed && (
        <span className="claude-status-bar__duration">{elapsed}</span>
      )}

      <span className="claude-status-bar__label">Claude Code</span>
    </div>
  );
}
