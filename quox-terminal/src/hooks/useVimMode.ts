/**
 * useVimMode — Per-pane vim keybinding state and key handler
 *
 * Manages NORMAL/INSERT mode toggle for terminal panes.
 * In NORMAL mode, navigation keys scroll the terminal buffer.
 * In INSERT mode (default), all keys pass through to the shell.
 *
 * Ported directly from quox-source/src/hooks/useVimMode.js — pure keyboard
 * state machine, no changes needed for Tauri.
 */

import { useState, useCallback, useRef } from "react";
import { VIM_BINDINGS } from "../config/terminalConfig";

export type VimModeState = "insert" | "normal";

interface ScrollRef {
  scrollLines?: (n: number) => void;
  scrollPages?: (n: number) => void;
  scrollToTop?: () => void;
  scrollToBottom?: () => void;
}

interface UseVimModeOptions {
  enabled: boolean;
  scrollRef: React.MutableRefObject<ScrollRef | null>;
}

interface UseVimModeReturn {
  vimMode: VimModeState;
  vimKeyHandler: (event: KeyboardEvent) => boolean;
  resetMode: () => void;
}

export default function useVimMode({
  enabled,
  scrollRef,
}: UseVimModeOptions): UseVimModeReturn {
  const [vimMode, setVimMode] = useState<VimModeState>("insert");

  // gg state machine: track pending 'g' press
  const pendingGRef = useRef(false);
  const pendingGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vimKeyHandler = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!enabled) return true;
      if (event.type !== "keydown") return true;

      // INSERT mode
      if (vimMode === "insert") {
        if (event.key === "Escape") {
          setVimMode("normal");
          return false;
        }
        return true;
      }

      // NORMAL mode — Ctrl combos
      if (event.ctrlKey || event.metaKey) {
        const scroll = scrollRef?.current;
        if (event.key === VIM_BINDINGS.SCROLL_HALF_PAGE_DOWN) {
          if (scroll?.scrollPages) scroll.scrollPages(0.5);
          return false;
        }
        if (event.key === VIM_BINDINGS.SCROLL_HALF_PAGE_UP) {
          if (scroll?.scrollPages) scroll.scrollPages(-0.5);
          return false;
        }
        return true;
      }

      const scroll = scrollRef?.current;

      switch (event.key) {
        case "i":
        case "a":
          setVimMode("insert");
          return false;

        case VIM_BINDINGS.SCROLL_LINE_DOWN:
          if (scroll?.scrollLines) scroll.scrollLines(1);
          return false;
        case VIM_BINDINGS.SCROLL_LINE_UP:
          if (scroll?.scrollLines) scroll.scrollLines(-1);
          return false;

        case VIM_BINDINGS.SCROLL_TO_BOTTOM:
          if (scroll?.scrollToBottom) scroll.scrollToBottom();
          return false;

        case VIM_BINDINGS.SCROLL_TO_TOP_TRIGGER:
          if (pendingGRef.current) {
            if (pendingGTimerRef.current)
              clearTimeout(pendingGTimerRef.current);
            pendingGRef.current = false;
            if (scroll?.scrollToTop) scroll.scrollToTop();
          } else {
            pendingGRef.current = true;
            pendingGTimerRef.current = setTimeout(() => {
              pendingGRef.current = false;
            }, VIM_BINDINGS.GG_TIMEOUT_MS);
          }
          return false;

        case "Escape":
          return false;

        default:
          return false;
      }
    },
    [enabled, vimMode, scrollRef],
  );

  const resetMode = useCallback(() => {
    setVimMode("insert");
    pendingGRef.current = false;
    if (pendingGTimerRef.current) clearTimeout(pendingGTimerRef.current);
  }, []);

  return { vimMode, vimKeyHandler, resetMode };
}
