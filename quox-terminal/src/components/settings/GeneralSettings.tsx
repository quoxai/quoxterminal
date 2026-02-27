/**
 * GeneralSettings — Shell and system settings.
 */

import { useState, useEffect } from "react";
import { getDefaultShell } from "../../lib/tauri-pty";
import type { AppSettings } from "../../types/terminal";

interface GeneralSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export default function GeneralSettings({
  settings,
  onUpdate,
}: GeneralSettingsProps) {
  const [detectedShell, setDetectedShell] = useState<string>("");

  useEffect(() => {
    getDefaultShell()
      .then(setDetectedShell)
      .catch(() => setDetectedShell("unknown"));
  }, []);

  return (
    <div className="settings-view__section">
      <h3 className="settings-view__section-title">General</h3>

      <div className="settings-view__field">
        <label>Default Shell</label>
        <input
          type="text"
          value={settings.defaultShell}
          onChange={(e) => onUpdate("defaultShell", e.target.value)}
          placeholder={detectedShell || "Auto-detect"}
        />
        {detectedShell && (
          <span className="settings-view__hint">
            Detected: {detectedShell}
          </span>
        )}
      </div>

      <div className="settings-view__field">
        <label>Global Hotkey</label>
        <input
          type="text"
          value={settings.globalHotkey}
          onChange={(e) => onUpdate("globalHotkey", e.target.value)}
          placeholder="Ctrl+`"
        />
      </div>
    </div>
  );
}
