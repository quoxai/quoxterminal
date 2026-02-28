/**
 * ToolParamModal — Inline parameter form for tools that need input
 *
 * Renders inside the ToolPalette as an overlay form.
 * Builds the final command via buildCommand() and calls onExecute.
 */

import { useState, useCallback } from "react";
import { buildCommand, type ToolDefinition } from "../../services/toolRegistry";

interface ToolParamModalProps {
  tool: ToolDefinition;
  onExecute: (command: string) => void;
  onClose: () => void;
}

export default function ToolParamModal({
  tool,
  onExecute,
  onClose,
}: ToolParamModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of tool.params || []) {
      initial[param.name] = param.default ?? "";
    }
    return initial;
  });

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const canSubmit = (tool.params || []).every((p) => {
    if (!p.required) return true;
    return (values[p.name] ?? "").trim().length > 0;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onExecute(buildCommand(tool, values));
  };

  return (
    <div className="tool-param-overlay" onClick={onClose}>
      <form
        className="tool-param-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        data-testid="tool-param-modal"
      >
        <div className="tool-param-modal__header">
          <span className="tool-param-modal__title">{tool.name}</span>
          <button
            type="button"
            className="tool-param-modal__close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="tool-param-modal__desc">{tool.description}</div>

        <div className="tool-param-modal__fields">
          {(tool.params || []).map((param) => (
            <div key={param.name} className="tool-param-modal__field">
              <label className="tool-param-modal__label">
                {param.label}
                {param.required && (
                  <span className="tool-param-modal__required">*</span>
                )}
              </label>

              {param.type === "select" && param.options ? (
                <select
                  className="tool-param-modal__select"
                  value={values[param.name] ?? ""}
                  onChange={(e) => setValue(param.name, e.target.value)}
                >
                  <option value="">Select...</option>
                  {param.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : param.type === "flag" ? (
                <label className="tool-param-modal__flag">
                  <input
                    type="checkbox"
                    checked={values[param.name] === "true"}
                    onChange={(e) =>
                      setValue(param.name, e.target.checked ? "true" : "")
                    }
                  />
                  <span>Enable</span>
                </label>
              ) : (
                <input
                  className="tool-param-modal__input"
                  type="text"
                  placeholder={param.placeholder}
                  value={values[param.name] ?? ""}
                  onChange={(e) => setValue(param.name, e.target.value)}
                  autoFocus={
                    (tool.params || []).indexOf(param) === 0
                  }
                />
              )}
            </div>
          ))}
        </div>

        <div className="tool-param-modal__preview">
          <code>{buildCommand(tool, values)}</code>
        </div>

        <div className="tool-param-modal__actions">
          <button
            type="button"
            className="tool-param-modal__cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="tool-param-modal__run"
            disabled={!canSubmit}
          >
            Run
          </button>
        </div>
      </form>

      <style>{`
        .tool-param-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          backdrop-filter: blur(2px);
        }

        .tool-param-modal {
          background: #0d1117;
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 8px;
          padding: 16px;
          width: 320px;
          max-height: 80%;
          overflow-y: auto;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        .tool-param-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .tool-param-modal__title {
          font-size: 13px;
          font-weight: 600;
          color: #10b981;
          font-family: 'JetBrains Mono', monospace;
        }

        .tool-param-modal__close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          font-size: 16px;
          padding: 2px 4px;
          border-radius: 3px;
          transition: color 0.15s, background 0.15s;
        }
        .tool-param-modal__close:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
        }

        .tool-param-modal__desc {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-bottom: 12px;
        }

        .tool-param-modal__fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }

        .tool-param-modal__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tool-param-modal__label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .tool-param-modal__required {
          color: #f87171;
          margin-left: 2px;
        }

        .tool-param-modal__input,
        .tool-param-modal__select {
          height: 28px;
          padding: 0 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          outline: none;
          transition: border-color 0.15s;
        }

        .tool-param-modal__input:focus,
        .tool-param-modal__select:focus {
          border-color: rgba(16, 185, 129, 0.5);
        }

        .tool-param-modal__input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .tool-param-modal__select option {
          background: #0d1117;
          color: rgba(255, 255, 255, 0.85);
        }

        .tool-param-modal__flag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
        }

        .tool-param-modal__preview {
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .tool-param-modal__preview code {
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          color: rgba(16, 185, 129, 0.8);
          word-break: break-all;
        }

        .tool-param-modal__actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .tool-param-modal__cancel {
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 11px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .tool-param-modal__cancel:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
        }

        .tool-param-modal__run {
          padding: 5px 16px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 4px;
          color: #10b981;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .tool-param-modal__run:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.25);
          border-color: rgba(16, 185, 129, 0.5);
        }
        .tool-param-modal__run:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
