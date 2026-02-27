/**
 * AppearanceSettings — Font, theme, cursor settings.
 */

import { THEME_NAMES } from "../../config/themes";
import type { AppSettings } from "../../types/terminal";

interface AppearanceSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export default function AppearanceSettings({
  settings,
  onUpdate,
}: AppearanceSettingsProps) {
  return (
    <div className="settings-view__section">
      <h3 className="settings-view__section-title">Appearance</h3>

      <div className="settings-view__field">
        <label>Theme</label>
        <select
          value={settings.theme}
          onChange={(e) => onUpdate("theme", e.target.value)}
        >
          {THEME_NAMES.map((name) => (
            <option key={name} value={name}>
              {name
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-view__field">
        <label>Font Size</label>
        <input
          type="number"
          min={10}
          max={24}
          value={settings.fontSize}
          onChange={(e) => onUpdate("fontSize", parseInt(e.target.value) || 14)}
        />
      </div>

      <div className="settings-view__field">
        <label>Font Family</label>
        <input
          type="text"
          value={settings.fontFamily}
          onChange={(e) => onUpdate("fontFamily", e.target.value)}
        />
      </div>

      <div className="settings-view__field">
        <label>Cursor Style</label>
        <select
          value={settings.cursorStyle}
          onChange={(e) =>
            onUpdate(
              "cursorStyle",
              e.target.value as "block" | "underline" | "bar",
            )
          }
        >
          <option value="block">Block</option>
          <option value="underline">Underline</option>
          <option value="bar">Bar</option>
        </select>
      </div>

      <div className="settings-view__field">
        <label>Cursor Blink</label>
        <input
          type="checkbox"
          checked={settings.cursorBlink}
          onChange={(e) => onUpdate("cursorBlink", e.target.checked)}
        />
      </div>

      <div className="settings-view__field">
        <label>Scrollback Lines</label>
        <input
          type="number"
          min={1000}
          max={100000}
          step={1000}
          value={settings.scrollback}
          onChange={(e) =>
            onUpdate("scrollback", parseInt(e.target.value) || 5000)
          }
        />
      </div>
    </div>
  );
}
