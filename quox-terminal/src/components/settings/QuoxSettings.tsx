/**
 * QuoxSettings — Full-page settings view
 *
 * Matches the QuoxCORE CoreIntegrations pattern:
 * - Sidebar navigation with section groups
 * - Full content area with embedded terminal for Claude CLI login
 * - Two Claude auth options: API Key + Claude Subscription (CLI login)
 * - All connection/infra/SSH settings
 * - About panel
 *
 * All settings persist via Tauri Store (quox-terminal-settings.json).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { storeGet, storeSet } from "../../lib/store";
import { clearHostCache } from "../../services/bastionClient";
import SettingsTerminal from "./SettingsTerminal";
import "./QuoxSettings.css";

interface ChatAuthStatus {
  ready: boolean;
  auth_method: string;
  cli_expires_in_minutes: number | null;
}

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

type Section = "ai" | "infrastructure" | "ssh" | "about";

const SIDEBAR_ITEMS: { id: Section; label: string; group: string }[] = [
  { id: "ai", label: "AI Services", group: "Core Setup" },
  { id: "infrastructure", label: "Infrastructure", group: "Connections" },
  { id: "ssh", label: "SSH Defaults", group: "Connections" },
  { id: "about", label: "About", group: "Info" },
];

export default function QuoxSettings({ isOpen, onClose }: QuoxSettingsProps) {
  const [config, setConfig] = useState<QuoxConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("ai");
  const [showTerminal, setShowTerminal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [authStatus, setAuthStatus] = useState<ChatAuthStatus | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const refreshAuthStatus = useCallback(() => {
    invoke<ChatAuthStatus>("chat_auth_status").then(setAuthStatus).catch(() => {});
  }, []);

  // Load config on mount
  useEffect(() => {
    if (!isOpen) return;
    setShowTerminal(false);
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
    refreshAuthStatus();
  }, [isOpen, refreshAuthStatus]);

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
    clearHostCache();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config]);

  const handleTestConnection = useCallback(async () => {
    if (!config.collectorUrl) return;
    setTestStatus("testing");
    try {
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

  const scrollToSection = useCallback((section: Section) => {
    setActiveSection(section);
    const el = document.getElementById(`settings-section-${section}`);
    if (el && contentRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const apiKeyValid = config.anthropicApiKey
    ? config.anthropicApiKey.startsWith("sk-ant-") ? "valid" : "invalid"
    : null;

  if (!isOpen) return null;

  return (
    <div className="quox-settings-overlay" onClick={onClose}>
      <div className="quox-settings" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="quox-settings__header">
          <div className="quox-settings__header-left">
            <img src="/quox-q-icon.png" alt="Q" className="quox-settings__logo" />
            <span className="quox-settings__title">Settings</span>
          </div>
          <div className="quox-settings__header-right">
            <button
              className={`quox-settings__save-btn ${saved ? "quox-settings__save-btn--saved" : ""}`}
              onClick={handleSave}
            >
              {saved ? "Saved" : "Save"}
            </button>
            <button className="quox-settings__close" onClick={onClose} title="Close settings (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="quox-settings__layout">
          {/* Sidebar */}
          <nav className="quox-settings__sidebar">
            {(() => {
              let lastGroup = "";
              return SIDEBAR_ITEMS.map((item) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="quox-settings__sidebar-group">{item.group}</div>
                    )}
                    <button
                      className={`quox-settings__sidebar-item ${activeSection === item.id ? "quox-settings__sidebar-item--active" : ""}`}
                      onClick={() => scrollToSection(item.id)}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              });
            })()}
          </nav>

          {/* Content */}
          <div className="quox-settings__content" ref={contentRef}>
            {/* ═══ AI Services ═══ */}
            <div id="settings-section-ai" className="quox-settings__section">
              <h3 className="quox-settings__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                AI Services
              </h3>
              <p className="quox-settings__hint">
                Configure authentication for Claude AI. Use either an API key or sign in with your Claude subscription.
              </p>

              {/* ── Option 1: API Key ── */}
              <div className="quox-settings__card">
                <div className="quox-settings__card-header">
                  <div className="quox-settings__card-info">
                    <label className="quox-settings__card-label">Anthropic API Key</label>
                    <span className="quox-settings__card-hint">Powers Claude AI chat assistant</span>
                  </div>
                  <div className="quox-settings__card-status">
                    {config.anthropicApiKey ? (
                      <span className="quox-settings__badge quox-settings__badge--ok">Configured</span>
                    ) : (
                      <span className="quox-settings__badge quox-settings__badge--missing">Not Set</span>
                    )}
                  </div>
                </div>
                <div className="quox-settings__card-body">
                  <div className="quox-settings__input-group">
                    <div className="quox-settings__input-wrapper">
                      <input
                        type={showApiKey ? "text" : "password"}
                        placeholder={config.anthropicApiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "sk-ant-..."}
                        value={config.anthropicApiKey}
                        onChange={(e) => updateField("anthropicApiKey", e.target.value)}
                      />
                      <button
                        className="quox-settings__eye-btn"
                        onClick={() => setShowApiKey((p) => !p)}
                        title={showApiKey ? "Hide" : "Show"}
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showApiKey ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                    {apiKeyValid && (
                      <span className={`quox-settings__key-status quox-settings__key-status--${apiKeyValid}`}>
                        {apiKeyValid === "valid" ? "Valid format" : "Invalid format"}
                      </span>
                    )}
                  </div>
                  <a
                    className="quox-settings__link"
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get key at console.anthropic.com
                  </a>
                </div>
              </div>

              {/* ── Option 2: Claude Subscription (CLI login) ── */}
              <div className="quox-settings__card">
                <div className="quox-settings__card-header">
                  <div className="quox-settings__card-info">
                    <label className="quox-settings__card-label">Claude Subscription</label>
                    <span className="quox-settings__card-hint">Use your Claude Pro/Max/Team plan instead of an API key</span>
                  </div>
                  <div className="quox-settings__card-status">
                    {authStatus?.auth_method === "cli_credentials" ? (
                      <>
                        <span className="quox-settings__badge quox-settings__badge--ok">CLI Authenticated</span>
                        {authStatus.cli_expires_in_minutes != null && (
                          <span className="quox-settings__badge-detail">
                            expires in {Math.round(authStatus.cli_expires_in_minutes / 60)}h
                          </span>
                        )}
                      </>
                    ) : authStatus?.auth_method === "api_key" ? (
                      <span className="quox-settings__badge quox-settings__badge--ok">API Key Active</span>
                    ) : (
                      <span className="quox-settings__badge quox-settings__badge--missing">Not Connected</span>
                    )}
                  </div>
                </div>
                <div className="quox-settings__card-body">
                  <button
                    className="quox-settings__terminal-btn"
                    onClick={() => setShowTerminal((prev) => !prev)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    {showTerminal ? "Close Terminal" : "Open Terminal"}
                  </button>

                  {showTerminal && (
                    <div className="quox-settings__terminal-container">
                      <SettingsTerminal
                        initialCommand="claude"
                        onConnect={() => {}}
                        onDisconnect={() => {
                          // Refresh auth status after terminal closes — user may have logged in
                          setTimeout(() => refreshAuthStatus(), 1000);
                        }}
                      />
                    </div>
                  )}

                  <span className="quox-settings__terminal-hint">
                    {showTerminal
                      ? "Type /login in the Claude CLI to sign in with your account."
                      : "Open the terminal to sign in with your Claude account"}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ Infrastructure ═══ */}
            <div id="settings-section-infrastructure" className="quox-settings__section">
              <h3 className="quox-settings__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
                Infrastructure
              </h3>
              <p className="quox-settings__hint">
                Connect to your Quox infrastructure for fleet management and remote execution.
              </p>

              {/* Collector URL */}
              <div className="quox-settings__card">
                <div className="quox-settings__card-header">
                  <div className="quox-settings__card-info">
                    <label className="quox-settings__card-label">QuoxMCP / Quox Core</label>
                    <span className="quox-settings__card-hint">Collector URL and API token</span>
                  </div>
                  <div className="quox-settings__card-status">
                    {config.collectorUrl ? (
                      <span className="quox-settings__badge quox-settings__badge--ok">Configured</span>
                    ) : (
                      <span className="quox-settings__badge quox-settings__badge--missing">Not Set</span>
                    )}
                  </div>
                </div>
                <div className="quox-settings__card-body">
                  <div className="quox-settings__field">
                    <label>Collector URL</label>
                    <div className="quox-settings__input-row">
                      <input
                        type="text"
                        placeholder="https://collector.quox.io or http://localhost:9848"
                        value={config.collectorUrl}
                        onChange={(e) => updateField("collectorUrl", e.target.value)}
                      />
                      <button
                        className={`quox-settings__test-btn quox-settings__test-btn--${testStatus}`}
                        onClick={handleTestConnection}
                        disabled={!config.collectorUrl || testStatus === "testing"}
                      >
                        {testStatus === "testing" ? "Testing..." : testStatus === "ok" ? "Connected" : testStatus === "error" ? "Failed" : "Test"}
                      </button>
                    </div>
                  </div>
                  <div className="quox-settings__field">
                    <label>API Token</label>
                    <input
                      type="password"
                      placeholder="quox_token_..."
                      value={config.collectorToken}
                      onChange={(e) => updateField("collectorToken", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Bastion */}
              <div className="quox-settings__card">
                <div className="quox-settings__card-header">
                  <div className="quox-settings__card-info">
                    <label className="quox-settings__card-label">Default Bastion Host</label>
                    <span className="quox-settings__card-hint">Jump host for SSH connections behind a gateway</span>
                  </div>
                </div>
                <div className="quox-settings__card-body">
                  <div className="quox-settings__field-row">
                    <div className="quox-settings__field quox-settings__field--grow">
                      <label>Bastion Host</label>
                      <input
                        type="text"
                        placeholder="access01 or 192.168.88.247"
                        value={config.bastionHost}
                        onChange={(e) => updateField("bastionHost", e.target.value)}
                      />
                    </div>
                    <div className="quox-settings__field quox-settings__field--port">
                      <label>Port</label>
                      <input
                        type="number"
                        value={config.bastionPort}
                        onChange={(e) => updateField("bastionPort", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="quox-settings__field">
                    <label>Bastion User</label>
                    <input
                      type="text"
                      placeholder="control"
                      value={config.bastionUser}
                      onChange={(e) => updateField("bastionUser", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ SSH Defaults ═══ */}
            <div id="settings-section-ssh" className="quox-settings__section">
              <h3 className="quox-settings__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M10 14L21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                SSH Defaults
              </h3>

              <div className="quox-settings__card">
                <div className="quox-settings__card-body">
                  <div className="quox-settings__field">
                    <label>Default SSH User</label>
                    <input
                      type="text"
                      placeholder="root"
                      value={config.defaultSshUser}
                      onChange={(e) => updateField("defaultSshUser", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ About ═══ */}
            <div id="settings-section-about" className="quox-settings__section">
              <div className="quox-settings__about">
                <img src="/quox-logo-large.png" alt="QuoxTerminal" className="quox-settings__about-logo" />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
