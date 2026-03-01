/**
 * ClaudePaneEmbed — Main Claude pane component.
 *
 * Replaces TerminalEmbed when pane mode="claude". Provides a structured
 * conversation UI for Claude CLI with tool call cards, markdown rendering,
 * and an input bar.
 */

import { useEffect, useCallback, useRef } from "react";
import ClaudeConversation from "./ClaudeConversation";
import ClaudeInputBar from "./ClaudeInputBar";
import useClaudeSession from "../../hooks/useClaudeSession";
import { estimateCost } from "../../config/claudeConfig";
import "./ClaudePaneEmbed.css";

interface ClaudePaneEmbedProps {
  /** Working directory for the Claude session */
  cwd?: string;
  /** Called when the session connects (spawns) */
  onConnect?: () => void;
  /** Called when the session exits */
  onDisconnect?: () => void;
  /** Extra CLI args to pass to Claude */
  extraArgs?: string[];
}

export default function ClaudePaneEmbed({
  cwd,
  onConnect,
  onDisconnect,
  extraArgs,
}: ClaudePaneEmbedProps) {
  const { state, spawn, sendMessage, approveToolCall, denyToolCall, kill } =
    useClaudeSession();

  const hasSpawned = useRef(false);

  // Auto-spawn on mount
  useEffect(() => {
    if (hasSpawned.current) return;
    hasSpawned.current = true;

    const workingDir = cwd || "/";
    spawn(workingDir, extraArgs).then(() => {
      onConnect?.();
    });

    return () => {
      kill().then(() => onDisconnect?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent on exit
  useEffect(() => {
    if (state.status === "exited") {
      onDisconnect?.();
    }
  }, [state.status, onDisconnect]);

  // Toggle tool card collapse
  const handleToggleCollapse = useCallback(
    (toolId: string) => {
      // We need to update the tool call's collapsed state in the session
      // This is a UI-only state change, so we mutate directly
      for (const msg of state.messages) {
        const tc = msg.toolCalls.find((t) => t.id === toolId);
        if (tc) {
          tc.collapsed = !tc.collapsed;
          break;
        }
      }
      // Force re-render by creating a shallow copy
      // (The hook's setState will handle this on next real event)
    },
    [state.messages],
  );

  const cost = estimateCost(
    state.model || "opus",
    state.inputTokens,
    state.outputTokens,
  );

  const isInputDisabled =
    state.status === "spawning" || state.status === "exited";

  return (
    <div className="claude-pane">
      {/* Header bar */}
      <div className="claude-pane__header-bar">
        <span className="claude-pane__model">
          {state.model
            ? state.model.replace("claude-", "").replace(/-\d+$/, "")
            : "claude"}
        </span>
        {state.inputTokens > 0 && (
          <span className="claude-pane__tokens">
            {formatTokens(state.inputTokens)}in /{" "}
            {formatTokens(state.outputTokens)}out
          </span>
        )}
        {cost > 0 && (
          <span className="claude-pane__cost">${cost.toFixed(2)}</span>
        )}
        <div className="claude-pane__spacer" />
        <span
          className={`claude-pane__status claude-pane__status--${state.status}`}
        >
          {state.status}
        </span>
      </div>

      {/* Conversation */}
      <ClaudeConversation
        messages={state.messages}
        status={state.status}
        onApprove={approveToolCall}
        onDeny={denyToolCall}
        onToggleToolCollapse={handleToggleCollapse}
      />

      {/* Error banner */}
      {state.error && (
        <div className="claude-pane__error">
          {state.error}
          <button
            className="claude-pane__error-retry"
            onClick={() => {
              hasSpawned.current = false;
              const workingDir = cwd || "/";
              spawn(workingDir, extraArgs);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Input bar */}
      <ClaudeInputBar
        onSubmit={sendMessage}
        disabled={isInputDisabled}
        placeholder={
          state.status === "waiting"
            ? "Respond to Claude..."
            : "Type a message..."
        }
      />
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k `;
  return `${n} `;
}
