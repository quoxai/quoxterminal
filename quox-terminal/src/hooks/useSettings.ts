/**
 * useSettings — Application settings hook with Tauri store persistence.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { storeGet, storeSet } from "../lib/store";
import type { AppSettings } from "../types/terminal";

const SETTINGS_KEY = "quox-terminal-app-settings";

const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
  theme: "quox-dark",
  defaultShell: "",
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 5000,
  globalHotkey: "Ctrl+`",
};

export default function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const initializedRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    storeGet<AppSettings>(SETTINGS_KEY).then((stored) => {
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      }
    });
  }, []);

  // Persist on change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      storeSet(SETTINGS_KEY, settings).catch(() => {});
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSetting, resetSettings };
}

export { DEFAULT_SETTINGS };
