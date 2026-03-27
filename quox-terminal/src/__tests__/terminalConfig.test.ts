import { describe, it, expect, vi } from "vitest";
import {
  TERMINAL_LIMITS,
  TERMINAL_SHORTCUTS,
  matchShortcut,
  VIM_BINDINGS,
} from "../config/terminalConfig";

describe("terminalConfig", () => {
  describe("TERMINAL_LIMITS", () => {
    it("has sensible max pane count", () => {
      expect(TERMINAL_LIMITS.MAX_PANES).toBeGreaterThanOrEqual(1);
      expect(TERMINAL_LIMITS.MAX_PANES).toBeLessThanOrEqual(16);
    });

    it("has sensible font size range", () => {
      expect(TERMINAL_LIMITS.MIN_FONT_SIZE).toBeLessThan(
        TERMINAL_LIMITS.MAX_FONT_SIZE
      );
      expect(TERMINAL_LIMITS.DEFAULT_FONT_SIZE).toBeGreaterThanOrEqual(
        TERMINAL_LIMITS.MIN_FONT_SIZE
      );
      expect(TERMINAL_LIMITS.DEFAULT_FONT_SIZE).toBeLessThanOrEqual(
        TERMINAL_LIMITS.MAX_FONT_SIZE
      );
    });

    it("has positive scrollback limit", () => {
      expect(TERMINAL_LIMITS.MAX_SCROLLBACK).toBeGreaterThan(0);
    });
  });

  describe("TERMINAL_SHORTCUTS", () => {
    it("has at least one category", () => {
      expect(TERMINAL_SHORTCUTS.length).toBeGreaterThan(0);
    });

    it("every shortcut has required fields", () => {
      for (const cat of TERMINAL_SHORTCUTS) {
        expect(cat.category).toBeTruthy();
        for (const item of cat.items) {
          expect(item.action).toBeTruthy();
          expect(item.key).toBeTruthy();
          expect(typeof item.ctrl).toBe("boolean");
          expect(typeof item.shift).toBe("boolean");
        }
      }
    });

    it("has no duplicate actions", () => {
      const actions = TERMINAL_SHORTCUTS.flatMap((c) =>
        c.items.map((i) => i.action)
      );
      const unique = new Set(actions);
      expect(unique.size).toBe(actions.length);
    });
  });

  describe("matchShortcut", () => {
    function makeEvent(
      overrides: Partial<KeyboardEvent> & { key: string }
    ): KeyboardEvent {
      return {
        key: overrides.key,
        ctrlKey: overrides.ctrlKey ?? false,
        metaKey: overrides.metaKey ?? false,
        shiftKey: overrides.shiftKey ?? false,
        target: overrides.target ?? document.createElement("div"),
        ...overrides,
      } as unknown as KeyboardEvent;
    }

    it("matches Ctrl+1 to focusPane0", () => {
      const result = matchShortcut(makeEvent({ key: "1", ctrlKey: true }));
      expect(result).toBe("focusPane0");
    });

    it("returns null for unmatched keys", () => {
      const result = matchShortcut(makeEvent({ key: "z", ctrlKey: true }));
      expect(result).toBeNull();
    });

    it("returns null when target is an input field", () => {
      const input = document.createElement("input");
      const result = matchShortcut(
        makeEvent({ key: "1", ctrlKey: true, target: input })
      );
      expect(result).toBeNull();
    });

    it("returns null when target is a textarea", () => {
      const textarea = document.createElement("textarea");
      const result = matchShortcut(
        makeEvent({ key: "1", ctrlKey: true, target: textarea })
      );
      expect(result).toBeNull();
    });

    it("returns null for plain key without modifier", () => {
      const result = matchShortcut(makeEvent({ key: "1" }));
      expect(result).toBeNull();
    });
  });

  describe("VIM_BINDINGS", () => {
    it("has insert mode keys", () => {
      expect(VIM_BINDINGS.INSERT_KEYS).toContain("i");
      expect(VIM_BINDINGS.INSERT_KEYS).toContain("a");
    });

    it("has scroll bindings", () => {
      expect(VIM_BINDINGS.SCROLL_LINE_DOWN).toBe("j");
      expect(VIM_BINDINGS.SCROLL_LINE_UP).toBe("k");
    });

    it("has a reasonable gg timeout", () => {
      expect(VIM_BINDINGS.GG_TIMEOUT_MS).toBeGreaterThan(0);
      expect(VIM_BINDINGS.GG_TIMEOUT_MS).toBeLessThanOrEqual(5000);
    });
  });
});
