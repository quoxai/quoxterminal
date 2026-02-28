/**
 * ToolParamModal — Inline parameter form for tools that need input
 *
 * Renders inside the ToolPalette as an overlay form.
 * Builds the final command via buildCommand() and calls onExecute.
 *
 * Supports a `confirmOnly` mode for dangerous tools with no params —
 * shows the command preview and "Execute" / "Cancel" buttons.
 */

import { useState, useCallback, useEffect } from "react";
import { buildCommand, type ToolDefinition } from "../../services/toolRegistry";
import "./ToolParamModal.css";

interface ToolParamModalProps {
  tool: ToolDefinition;
  onExecute: (command: string) => void;
  onClose: () => void;
  /** Show confirmation only (no param fields) for dangerous tools */
  confirmOnly?: boolean;
}

export default function ToolParamModal({
  tool,
  onExecute,
  onClose,
  confirmOnly = false,
}: ToolParamModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of tool.params || []) {
      initial[param.name] = param.default ?? "";
    }
    return initial;
  });

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const canSubmit = confirmOnly || (tool.params || []).every((p) => {
    if (!p.required) return true;
    return (values[p.name] ?? "").trim().length > 0;
  });

  const commandStr = buildCommand(tool, values);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onExecute(commandStr);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(commandStr).catch(() => {});
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

        {confirmOnly && (
          <div className="tool-param-modal__confirm-warning">
            This action requires confirmation before execution.
          </div>
        )}

        {!confirmOnly && (tool.params || []).length > 0 && (
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
        )}

        <div className="tool-param-modal__preview">
          <code>{commandStr}</code>
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
            type="button"
            className="tool-param-modal__copy"
            onClick={handleCopy}
            title="Copy command to clipboard"
          >
            Copy
          </button>
          <button
            type="submit"
            className="tool-param-modal__run"
            disabled={!canSubmit}
          >
            {confirmOnly ? "Execute" : "Run"}
          </button>
        </div>
      </form>
    </div>
  );
}
