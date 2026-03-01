/**
 * ClaudeConversation — Scrollable message + tool card stream.
 *
 * Renders assistant text (markdown), user messages, system messages,
 * and inline tool call cards. Auto-scrolls to newest content with
 * scroll-lock when user scrolls up.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ToolCallCard from "./ToolCallCard";
import type { ClaudeMessage } from "../../services/claudeOutputParser";
import type { SessionStatus } from "../../hooks/useClaudeSession";
import "./ClaudeConversation.css";

interface ClaudeConversationProps {
  messages: ClaudeMessage[];
  status: SessionStatus;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
  onToggleToolCollapse: (toolId: string) => void;
}

export default function ClaudeConversation({
  messages,
  status,
  onApprove,
  onDeny,
  onToggleToolCollapse,
}: ClaudeConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Detect user scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  if (messages.length === 0 && status === "idle") {
    return (
      <div className="claude-conv claude-conv--empty" ref={containerRef}>
        <div className="claude-conv__welcome">
          <div className="claude-conv__welcome-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <p className="claude-conv__welcome-text">
            Claude Mode — type a message to start
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="claude-conv"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`claude-conv__msg claude-conv__msg--${msg.type}`}
        >
          {msg.type === "user" && (
            <div className="claude-conv__user-msg">
              <span className="claude-conv__role">you</span>
              <div className="claude-conv__text">{msg.text}</div>
            </div>
          )}

          {msg.type === "assistant" && (
            <div className="claude-conv__assistant-msg">
              {msg.text && (
                <div className="claude-conv__markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
              {msg.toolCalls.map((tc) => (
                <ToolCallCard
                  key={tc.id}
                  toolCall={tc}
                  onToggleCollapse={onToggleToolCollapse}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              ))}
              {msg.pending && (
                <span className="claude-conv__typing">
                  <span className="claude-conv__typing-dot" />
                  <span className="claude-conv__typing-dot" />
                  <span className="claude-conv__typing-dot" />
                </span>
              )}
            </div>
          )}

          {msg.type === "system" && (
            <div className="claude-conv__system-msg">
              {msg.text}
            </div>
          )}
        </div>
      ))}

      {status === "spawning" && (
        <div className="claude-conv__status">
          <span className="claude-conv__spinner" />
          Starting Claude...
        </div>
      )}

      {/* Scroll anchor */}
      {!autoScroll && (
        <button
          className="claude-conv__scroll-btn"
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            }
          }}
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
