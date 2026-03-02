/**
 * ClaudeStatusBar — Translucent overlay at bottom of terminal pane in native Claude mode.
 * Shows mode pill, model picker, session duration, project detection badge,
 * resume buttons, and quick action buttons.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ModeId, ModelId } from "../../config/terminalModes";
import { TERMINAL_MODES, CLAUDE_MODELS } from "../../config/terminalModes";
import { ptyWrite } from "../../lib/tauri-pty";
import ClaudeMdViewer from "./ClaudeMdViewer";
import "./ClaudeStatusBar.css";

interface ClaudeStatusBarProps {
  mode: ModeId;
  model: ModelId;
  projectDetected?: boolean;
  claudeMdPath?: string | null;
  sessionStartTime?: number;
  sessionId?: string | null;
  onModelChange?: (model: ModelId) => void;
  onResume?: (mode: "continue" | "resume") => void;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const QUICK_ACTIONS = [
  { label: "/compact", command: "/compact\n", title: "Compress context" },
  { label: "/cost", command: "/cost\n", title: "Show spending" },
  { label: "/clear", command: "/clear\n", title: "Clear conversation" },
  { label: "/model", command: "/model\n", title: "Switch model mid-session" },
] as const;

export default function ClaudeStatusBar({
  mode,
  model,
  projectDetected,
  claudeMdPath,
  sessionStartTime,
  sessionId,
  onModelChange,
  onResume,
}: ClaudeStatusBarProps) {
  const modeInfo = TERMINAL_MODES[mode];
  const [elapsed, setElapsed] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionStartTime) return;
    const tick = () => setElapsed(formatDuration(Date.now() - sessionStartTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  // Close model dropdown on outside click
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [modelDropdownOpen]);

  const handleQuickAction = useCallback(
    (command: string) => {
      if (!sessionId) return;
      ptyWrite(sessionId, command).catch(() => {});
    },
    [sessionId],
  );

  const currentModel = CLAUDE_MODELS.find((m) => m.id === model) || CLAUDE_MODELS[0];

  return (
    <>
      {/* Combined status area — stacked via flexbox, no magic offsets */}
      <div className="claude-status-area">
        {/* Quick action buttons row — only when session is active */}
        {sessionId && (
          <div className="claude-quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="claude-quick-actions__btn"
                onClick={() => handleQuickAction(action.command)}
                title={action.title}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Main status bar */}
        <div className="claude-status-bar">
          {/* Mode badge */}
          <span
            className="claude-status-bar__mode"
            style={{ borderColor: modeInfo.color, color: modeInfo.color }}
          >
            {modeInfo.label.toUpperCase()}
          </span>

          {/* Model picker */}
          <div className="claude-status-bar__model-picker" ref={modelRef}>
            <button
              className="claude-status-bar__model-btn"
              onClick={() => setModelDropdownOpen((v) => !v)}
              style={{ color: currentModel.color }}
              title="Select model"
            >
              {currentModel.label}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points={modelDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
              </svg>
            </button>
            {modelDropdownOpen && (
              <div className="claude-status-bar__model-dropdown">
                {CLAUDE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`claude-status-bar__model-option${m.id === model ? " claude-status-bar__model-option--active" : ""}`}
                    onClick={() => {
                      onModelChange?.(m.id);
                      setModelDropdownOpen(false);
                    }}
                    style={{ color: m.color }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CLAUDE.md badge — clickable to open viewer */}
          {projectDetected && (
            <button
              className="claude-status-bar__badge claude-status-bar__badge--clickable"
              onClick={() => setShowClaudeMd(true)}
              title="View CLAUDE.md"
            >
              CLAUDE.md
            </button>
          )}

          {/* Resume buttons */}
          <button
            className="claude-status-bar__resume-btn"
            onClick={() => onResume?.("continue")}
            title="Continue last session (--continue)"
          >
            Continue
          </button>
          <button
            className="claude-status-bar__resume-btn"
            onClick={() => onResume?.("resume")}
            title="Resume a session (--resume)"
          >
            Resume
          </button>

          <span className="claude-status-bar__spacer" />

          {elapsed && (
            <span className="claude-status-bar__duration">{elapsed}</span>
          )}

          <span className="claude-status-bar__label">Claude Code</span>
        </div>
      </div>

      {/* CLAUDE.md viewer modal */}
      {showClaudeMd && claudeMdPath && (
        <ClaudeMdViewer
          filePath={claudeMdPath}
          onClose={() => setShowClaudeMd(false)}
        />
      )}
    </>
  );
}
