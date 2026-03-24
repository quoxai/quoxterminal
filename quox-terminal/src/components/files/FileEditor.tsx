/**
 * FileEditor — CodeMirror 6 editor/viewer component.
 *
 * Mounts CM6 once and uses Compartments for live reconfiguration
 * (language, readOnly, fontSize). Never destroys/recreates the view
 * on prop changes.
 */

import { useRef, useEffect, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  drawSelection,
  keymap,
} from "@codemirror/view";
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { languages } from "@codemirror/language-data";
import { quoxEditorTheme } from "./quoxEditorTheme";
import type { Extension } from "@codemirror/state";

// ── Compartments for dynamic reconfiguration ────────────────────────────

const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const fontSizeCompartment = new Compartment();

function fontSizeExtension(size: number): Extension {
  return EditorView.theme({
    ".cm-content": { fontSize: `${size}px` },
    ".cm-gutters": { fontSize: `${Math.max(size - 2, 10)}px` },
  });
}

// ── Props ────────────────────────────────────────────────────────────────

export interface FileEditorProps {
  /** File content to display */
  value: string;
  /** File path — used for language detection */
  filePath: string;
  /** Terminal font size (follows zoom controls) */
  fontSize?: number;
  /** Read-only mode (default true — viewer mode) */
  readOnly?: boolean;
  /** Called when document changes (only in edit mode) */
  onChange?: (value: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function FileEditor({
  value,
  filePath,
  fontSize = 14,
  readOnly = true,
  onChange,
}: FileEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Detect language from file path
  const detectLanguage = useCallback(async (): Promise<Extension> => {
    const fileName = filePath.split("/").pop() || "";
    const match = languages.find((lang) => {
      // Check extensions
      if (lang.extensions?.some((ext) => fileName.endsWith(`.${ext}`))) {
        return true;
      }
      // Check filename patterns
      if (lang.filename?.test(fileName)) {
        return true;
      }
      return false;
    });

    if (match) {
      try {
        const support = await match.load();
        return support;
      } catch {
        return [];
      }
    }
    return [];
  }, [filePath]);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        // Core editing
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        history(),
        highlightSelectionMatches(),
        foldGutter({
          openText: "\u25BE",
          closedText: "\u25B8",
        }),

        // Keymaps
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),

        // Theme
        quoxEditorTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

        // Dynamic compartments
        languageCompartment.of([]),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        fontSizeCompartment.of(fontSizeExtension(fontSize)),

        // Change listener
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Load language async
    detectLanguage().then((lang) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(lang),
        });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once — value/filePath changes handled by separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Swap language when filePath changes
  useEffect(() => {
    detectLanguage().then((lang) => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(lang),
        });
      }
    });
  }, [filePath, detectLanguage]);

  // Update readOnly
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.reconfigure(
          EditorState.readOnly.of(readOnly),
        ),
      });
    }
  }, [readOnly]);

  // Update fontSize
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: fontSizeCompartment.reconfigure(fontSizeExtension(fontSize)),
      });
    }
  }, [fontSize]);

  return <div ref={containerRef} className="fe-editor" />;
}
