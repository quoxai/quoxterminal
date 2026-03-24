/**
 * quoxEditorTheme.ts — Custom CodeMirror 6 theme for QuoxTerminal.
 *
 * Matches the terminal palette: #0a0e14 background, cyan accents,
 * violet keywords, green strings, amber numbers. Built using
 * EditorView.theme() + HighlightStyle.define() for full control.
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

// ── Palette ──────────────────────────────────────────────────────────────

const palette = {
  bg: "#0a0e14",
  fg: "#b3b1ad",
  cyan: "#38bdf8",
  lightCyan: "#7dd3fc",
  violet: "#a78bfa",
  green: "#a5d6a7",
  amber: "#ffcc80",
  red: "#ef5350",
  pink: "#f48fb1",
  gray: "#5c6370",
  mutedGray: "#6a7380",
  selection: "#1a1f29",
  activeLine: "#0d1117",
  gutterFg: "#4a4a4a",
  matchBracket: "rgba(56, 189, 248, 0.19)",
  searchMatch: "rgba(56, 189, 248, 0.12)",
  searchMatchActive: "rgba(56, 189, 248, 0.25)",
};

// ── Editor chrome ────────────────────────────────────────────────────────

const quoxTheme = EditorView.theme(
  {
    "&": {
      color: palette.fg,
      backgroundColor: palette.bg,
    },
    ".cm-content": {
      caretColor: palette.cyan,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      lineHeight: "1.6",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: palette.cyan,
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: palette.selection,
      },
    ".cm-activeLine": {
      backgroundColor: palette.activeLine,
    },
    ".cm-gutters": {
      backgroundColor: palette.bg,
      color: palette.gutterFg,
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      color: palette.cyan,
      backgroundColor: palette.activeLine,
    },
    ".cm-foldGutter .cm-gutterElement": {
      color: palette.gutterFg,
      transition: "color 0.15s",
    },
    ".cm-foldGutter .cm-gutterElement:hover": {
      color: palette.cyan,
    },
    ".cm-matchingBracket": {
      backgroundColor: palette.matchBracket,
      outline: `1px solid rgba(56, 189, 248, 0.3)`,
    },
    ".cm-searchMatch": {
      backgroundColor: palette.searchMatch,
      outline: `1px solid rgba(56, 189, 248, 0.25)`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: palette.searchMatchActive,
    },
    ".cm-tooltip": {
      backgroundColor: "#111620",
      border: `1px solid ${palette.selection}`,
      borderRadius: "6px",
    },
    ".cm-panels": {
      backgroundColor: "#111620",
      color: palette.fg,
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${palette.selection}`,
    },
    ".cm-scroller": {
      scrollBehavior: "smooth",
    },
    // Scrollbar styling
    ".cm-scroller::-webkit-scrollbar": {
      width: "6px",
      height: "6px",
    },
    ".cm-scroller::-webkit-scrollbar-track": {
      background: "transparent",
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "rgba(56, 189, 248, 0.12)",
      borderRadius: "3px",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
      background: "rgba(56, 189, 248, 0.25)",
    },
  },
  { dark: true },
);

// ── Syntax highlighting ──────────────────────────────────────────────────

const quoxHighlightStyle = HighlightStyle.define([
  // Keywords
  { tag: t.keyword, color: palette.violet },
  { tag: t.controlKeyword, color: palette.violet, fontWeight: "500" },
  { tag: t.operatorKeyword, color: palette.violet },

  // Functions
  { tag: t.function(t.variableName), color: palette.cyan },
  { tag: t.definition(t.variableName), color: palette.lightCyan },
  { tag: t.function(t.propertyName), color: palette.cyan },

  // Variables & properties
  { tag: t.variableName, color: palette.fg },
  { tag: t.propertyName, color: palette.lightCyan },
  { tag: t.definition(t.propertyName), color: palette.lightCyan },

  // Strings
  { tag: t.string, color: palette.green },
  { tag: t.special(t.string), color: palette.green },
  { tag: t.regexp, color: palette.pink },

  // Numbers & booleans
  { tag: t.number, color: palette.amber },
  { tag: t.bool, color: palette.amber },
  { tag: t.null, color: palette.amber },

  // Types
  { tag: t.typeName, color: palette.cyan },
  { tag: t.className, color: palette.cyan },
  { tag: t.namespace, color: palette.lightCyan },
  { tag: t.macroName, color: palette.violet },

  // Comments
  { tag: t.comment, color: palette.gray, fontStyle: "italic" },
  { tag: t.lineComment, color: palette.gray, fontStyle: "italic" },
  { tag: t.blockComment, color: palette.gray, fontStyle: "italic" },
  { tag: t.docComment, color: "#6a7380", fontStyle: "italic" },

  // Operators & punctuation
  { tag: t.operator, color: palette.cyan },
  { tag: t.punctuation, color: palette.mutedGray },
  { tag: t.paren, color: palette.fg },
  { tag: t.squareBracket, color: palette.fg },
  { tag: t.brace, color: palette.fg },

  // Markup
  { tag: t.heading, color: palette.cyan, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.link, color: palette.cyan, textDecoration: "underline" },

  // Tags (HTML/JSX)
  { tag: t.tagName, color: palette.violet },
  { tag: t.attributeName, color: palette.lightCyan },
  { tag: t.attributeValue, color: palette.green },

  // Special
  { tag: t.invalid, color: palette.red, textDecoration: "line-through" },
  { tag: t.meta, color: palette.gray },
  { tag: t.atom, color: palette.amber },
]);

// ── Combined export ──────────────────────────────────────────────────────

export const quoxEditorTheme: Extension = [
  quoxTheme,
  syntaxHighlighting(quoxHighlightStyle),
];
