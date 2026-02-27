/**
 * SettingsView — Settings panel for QuoxTerminal Desktop.
 */

import useSettings from "../hooks/useSettings";
import AppearanceSettings from "../components/settings/AppearanceSettings";
import GeneralSettings from "../components/settings/GeneralSettings";

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <div className="settings-view">
      <div className="settings-view__header">
        <h2>Settings</h2>
        <button className="settings-view__close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="settings-view__body">
        <AppearanceSettings settings={settings} onUpdate={updateSetting} />
        <GeneralSettings settings={settings} onUpdate={updateSetting} />
        <div className="settings-view__section">
          <button className="settings-view__reset" onClick={resetSettings}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
