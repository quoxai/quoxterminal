/**
 * QuoxSettings — Connection & configuration settings panel
 *
 * Slide-out panel for configuring:
 * - QuoxMCP / Quox Core connection (URL + token)
 * - Bastion host defaults
 * - Default SSH user
 * - Anthropic API key
 * - About info
 *
 * All settings persist via Tauri Store (quox-terminal-settings.json).
 */

import { useState, useEffect, useCallback } from "react";
import { storeGet, storeSet } from "../../lib/store";
import "./QuoxSettings.css";

interface QuoxSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuoxConfig {
  collectorUrl: string;
  collectorToken: string;
  bastionHost: string;
  bastionPort: string;
  bastionUser: string;
  defaultSshUser: string;
  anthropicApiKey: string;
}

const DEFAULT_CONFIG: QuoxConfig = {
  collectorUrl: "",
  collectorToken: "",
  bastionHost: "",
  bastionPort: "22",
  bastionUser: "",
  defaultSshUser: "",
  anthropicApiKey: "",
};

const STORE_KEY = "quox-connection-config";
const API_KEY_STORE = "anthropic-api-key";

export default function QuoxSettings({ isOpen, onClose }: QuoxSettingsProps) {
  const [config, setConfig] = useState<QuoxConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");

  // Load config on mount
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      storeGet<Omit<QuoxConfig, "anthropicApiKey">>(STORE_KEY),
      storeGet<string>(API_KEY_STORE),
    ]).then(([cfg, apiKey]) => {
      setConfig({
        ...DEFAULT_CONFIG,
        ...(cfg || {}),
        anthropicApiKey: apiKey || "",
      });
    });
  }, [isOpen]);

  const updateField = useCallback(
    (field: keyof QuoxConfig, value: string) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      setSaved(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const { anthropicApiKey, ...rest } = config;
    await storeSet(STORE_KEY, rest);
    await storeSet(API_KEY_STORE, anthropicApiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config]);

  const handleTestConnection = useCallback(async () => {
    if (!config.collectorUrl) return;
    setTestStatus("testing");
    try {
      // Simple health check — the collector should respond at /api/v1/health
      const url = config.collectorUrl.replace(/\/$/, "");
      const resp = await fetch(`${url}/api/v1/health`, {
        headers: config.collectorToken
          ? { Authorization: `Bearer ${config.collectorToken}` }
          : {},
        signal: AbortSignal.timeout(5000),
      });
      setTestStatus(resp.ok ? "ok" : "error");
    } catch {
      setTestStatus("error");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  }, [config.collectorUrl, config.collectorToken]);

  if (!isOpen) return null;

  return (
    <div className="quox-settings-overlay" onClick={onClose}>
      <div
        className="quox-settings"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="quox-settings__header">
          <div className="quox-settings__header-left">
            <img
              src="/quox-q-icon.png"
              alt="Q"
              className="quox-settings__logo"
            />
            <span className="quox-settings__title">Settings</span>
          </div>
          <button
            className="quox-settings__close"
            onClick={onClose}
            title="Close settings"
          >
            <svg
              width="14"
              height="14"
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

        <div className="quox-settings__body">
          {showAbout ? (
            /* ── About Panel ── */
            <div className="quox-settings__about">
              <img
                src="/quox-logo-large.png"
                alt="QuoxTerminal"
                className="quox-settings__about-logo"
              />
              <h2 className="quox-settings__about-name">QuoxTerminal</h2>
              <span className="quox-settings__about-version">v0.1.0</span>
              <p className="quox-settings__about-desc">
                Desktop terminal for the Quox fleet management platform.
                Connect to remote hosts via SSH, manage infrastructure
                through QuoxMCP, and get AI-assisted operations.
              </p>
              <div className="quox-settings__about-links">
                <span className="quox-settings__about-link">quox.ai</span>
              </div>
              <button
                className="quox-settings__back-btn"
                onClick={() => setShowAbout(false)}
              >
                Back to Settings
              </button>
            </div>
          ) : (
            <>
              {/* ── QuoxMCP / Collector ── */}
              <section className="quox-settings__section">
                <h3 className="quox-settings__section-title">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                  QuoxMCP / Quox Core
                </h3>
                <p className="quox-settings__hint">
                  Connect to your Quox infrastructure for fleet management
                  and remote execution.
                </p>

                <div className="quox-settings__field">
                  <label>Collector URL</label>
                  <div className="quox-settings__input-row">
                    <input
                      type="text"
                      placeholder="https://collector.quox.io or http://localhost:9848"
                      value={config.collectorUrl}
                      onChange={(e) =>
                        updateField("collectorUrl", e.target.value)
                      }
                    />
                    <button
                      className={`quox-settings__test-btn quox-settings__test-btn--${testStatus}`}
                      onClick={handleTestConnection}
                      disabled={
                        !config.collectorUrl || testStatus === "testing"
                      }
                    >
                      {testStatus === "testing"
                        ? "Testing..."
                        : testStatus === "ok"
                          ? "Connected"
                          : testStatus === "error"
                            ? "Failed"
                            : "Test"}
                    </button>
                  </div>
                </div>

                <div className="quox-settings__field">
                  <label>API Token</label>
                  <input
                    type="password"
                    placeholder="quox_token_..."
                    value={config.collectorToken}
                    onChange={(e) =>
                      updateField("collectorToken", e.target.value)
                    }
                  />
                </div>
              </section>

              {/* ── Bastion / Jump Host ── */}
              <section className="quox-settings__section">
                <h3 className="quox-settings__section-title">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Default Bastion Host
                </h3>
                <p className="quox-settings__hint">
                  Pre-fill the bastion/jump host when opening SSH connections.
                  Saves time for Quox infrastructure behind a gateway.
                </p>

                <div className="quox-settings__field-row">
                  <div className="quox-settings__field quox-settings__field--grow">
                    <label>Bastion Host</label>
                    <input
                      type="text"
                      placeholder="access01 or 192.168.88.247"
                      value={config.bastionHost}
                      onChange={(e) =>
                        updateField("bastionHost", e.target.value)
                      }
                    />
                  </div>
                  <div className="quox-settings__field quox-settings__field--port">
                    <label>Port</label>
                    <input
                      type="number"
                      value={config.bastionPort}
                      onChange={(e) =>
                        updateField("bastionPort", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="quox-settings__field">
                  <label>Bastion User</label>
                  <input
                    type="text"
                    placeholder="control"
                    value={config.bastionUser}
                    onChange={(e) =>
                      updateField("bastionUser", e.target.value)
                    }
                  />
                </div>
              </section>

              {/* ── SSH Defaults ── */}
              <section className="quox-settings__section">
                <h3 className="quox-settings__section-title">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M10 14L21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                  SSH Defaults
                </h3>

                <div className="quox-settings__field">
                  <label>Default SSH User</label>
                  <input
                    type="text"
                    placeholder="root"
                    value={config.defaultSshUser}
                    onChange={(e) =>
                      updateField("defaultSshUser", e.target.value)
                    }
                  />
                </div>
              </section>

              {/* ── AI / Anthropic ── */}
              <section className="quox-settings__section">
                <h3 className="quox-settings__section-title">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  AI Assistant
                </h3>

                <div className="quox-settings__field">
                  <label>Anthropic API Key</label>
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    value={config.anthropicApiKey}
                    onChange={(e) =>
                      updateField("anthropicApiKey", e.target.value)
                    }
                  />
                </div>
              </section>

              {/* ── Footer ── */}
              <div className="quox-settings__footer">
                <button
                  className="quox-settings__about-btn"
                  onClick={() => setShowAbout(true)}
                >
                  About QuoxTerminal
                </button>
                <button
                  className={`quox-settings__save-btn ${saved ? "quox-settings__save-btn--saved" : ""}`}
                  onClick={handleSave}
                >
                  {saved ? "Saved" : "Save Settings"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
