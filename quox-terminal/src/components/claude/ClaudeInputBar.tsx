/**
 * ClaudeInputBar — Rich text input for Claude Mode.
 *
 * Multi-line textarea with history, submit on Enter (Shift+Enter for newline).
 */

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import "./ClaudeInputBar.css";

interface ClaudeInputBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_HISTORY = 50;

export default function ClaudeInputBar({
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
}: ClaudeInputBarProps) {
  const [value, setValue] = useState("");
  const [history] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;

    onSubmit(text);

    // Add to history
    history.unshift(text);
    if (history.length > MAX_HISTORY) history.pop();

    setValue("");
    setHistoryIndex(-1);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSubmit, history]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter = submit, Shift+Enter = newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Arrow Up = history navigation (only when at start of input)
      if (e.key === "ArrowUp" && !value) {
        e.preventDefault();
        const nextIdx = Math.min(historyIndex + 1, history.length - 1);
        if (history[nextIdx]) {
          setHistoryIndex(nextIdx);
          setValue(history[nextIdx]);
        }
        return;
      }

      // Arrow Down = history forward
      if (e.key === "ArrowDown" && historyIndex >= 0) {
        e.preventDefault();
        const nextIdx = historyIndex - 1;
        if (nextIdx < 0) {
          setHistoryIndex(-1);
          setValue("");
        } else {
          setHistoryIndex(nextIdx);
          setValue(history[nextIdx]);
        }
        return;
      }
    },
    [value, historyIndex, history, handleSubmit],
  );

  // Auto-resize textarea
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    },
    [],
  );

  return (
    <div className={`claude-input ${disabled ? "claude-input--disabled" : ""}`}>
      <textarea
        ref={textareaRef}
        className="claude-input__textarea"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        spellCheck={false}
      />
      <button
        className="claude-input__submit"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        title="Send (Enter)"
      >
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
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
