/**
 * SshConnectDialog — Modal for establishing SSH connections
 *
 * Provides a form for connecting to remote hosts via SSH with:
 * - Key-based or password authentication
 * - Optional bastion/jump host configuration
 * - SSH key discovery from ~/.ssh/
 */

import { useState, useEffect, useCallback } from "react";
import Modal from "../ui/Modal";
import { sshListKeys, type SshKeyInfo } from "../../lib/tauri-ssh";
import "./SshConnectDialog.css";

interface SshConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (opts: SshConnectionConfig) => void;
  connecting?: boolean;
  error?: string | null;
}

export interface SshConnectionConfig {
  host: string;
  port: number;
  user: string;
  authMethod: "key" | "password";
  keyPath?: string;
  keyPassphrase?: string;
  password?: string;
  bastionHost?: string;
  bastionPort?: number;
  bastionUser?: string;
  bastionKeyPath?: string;
}

export default function SshConnectDialog({
  isOpen,
  onClose,
  onConnect,
  connecting = false,
  error = null,
}: SshConnectDialogProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("");
  const [authMethod, setAuthMethod] = useState<"key" | "password">("key");
  const [keyPath, setKeyPath] = useState("");
  const [keyPassphrase, setKeyPassphrase] = useState("");
  const [password, setPassword] = useState("");
  const [showBastion, setShowBastion] = useState(false);
  const [bastionHost, setBastionHost] = useState("");
  const [bastionPort, setBastionPort] = useState("22");
  const [bastionUser, setBastionUser] = useState("");
  const [bastionKeyPath, setBastionKeyPath] = useState("");
  const [sshKeys, setSshKeys] = useState<SshKeyInfo[]>([]);

  // Load SSH keys on open
  useEffect(() => {
    if (isOpen) {
      sshListKeys()
        .then((keys) => {
          setSshKeys(keys);
          // Auto-select first key if available
          if (keys.length > 0 && !keyPath) {
            setKeyPath(keys[0].path);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, keyPath]);

  const canConnect =
    host.trim() !== "" &&
    user.trim() !== "" &&
    !connecting &&
    (authMethod === "key" ? keyPath.trim() !== "" : password.trim() !== "");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canConnect) return;

      const config: SshConnectionConfig = {
        host: host.trim(),
        port: parseInt(port) || 22,
        user: user.trim(),
        authMethod,
      };

      if (authMethod === "key") {
        config.keyPath = keyPath;
        if (keyPassphrase) config.keyPassphrase = keyPassphrase;
      } else {
        config.password = password;
      }

      if (showBastion && bastionHost.trim()) {
        config.bastionHost = bastionHost.trim();
        config.bastionPort = parseInt(bastionPort) || 22;
        config.bastionUser = bastionUser.trim() || user.trim();
        config.bastionKeyPath = bastionKeyPath || keyPath;
      }

      onConnect(config);
    },
    [
      canConnect,
      host,
      port,
      user,
      authMethod,
      keyPath,
      keyPassphrase,
      password,
      showBastion,
      bastionHost,
      bastionPort,
      bastionUser,
      bastionKeyPath,
      onConnect,
    ],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SSH Connection">
      <form className="ssh-dialog" onSubmit={handleSubmit}>
        {/* Host + Port */}
        <div className="ssh-dialog__row">
          <div className="ssh-dialog__field ssh-dialog__field--grow">
            <label className="ssh-dialog__label">Host</label>
            <input
              className="ssh-dialog__input"
              type="text"
              placeholder="hostname or IP"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              autoFocus
              disabled={connecting}
            />
          </div>
          <div className="ssh-dialog__field ssh-dialog__field--port">
            <label className="ssh-dialog__label">Port</label>
            <input
              className="ssh-dialog__input"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={connecting}
            />
          </div>
        </div>

        {/* Username */}
        <div className="ssh-dialog__field">
          <label className="ssh-dialog__label">Username</label>
          <input
            className="ssh-dialog__input"
            type="text"
            placeholder="user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={connecting}
          />
        </div>

        {/* Auth method toggle */}
        <div className="ssh-dialog__field">
          <label className="ssh-dialog__label">Authentication</label>
          <div className="ssh-dialog__auth-toggle">
            <button
              type="button"
              className={`ssh-dialog__auth-btn ${authMethod === "key" ? "ssh-dialog__auth-btn--active" : ""}`}
              onClick={() => setAuthMethod("key")}
              disabled={connecting}
            >
              SSH Key
            </button>
            <button
              type="button"
              className={`ssh-dialog__auth-btn ${authMethod === "password" ? "ssh-dialog__auth-btn--active" : ""}`}
              onClick={() => setAuthMethod("password")}
              disabled={connecting}
            >
              Password
            </button>
          </div>
        </div>

        {/* Key selection */}
        {authMethod === "key" && (
          <>
            <div className="ssh-dialog__field">
              <label className="ssh-dialog__label">SSH Key</label>
              {sshKeys.length > 0 ? (
                <select
                  className="ssh-dialog__input ssh-dialog__select"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  disabled={connecting}
                >
                  {sshKeys.map((k) => (
                    <option key={k.path} value={k.path}>
                      {k.name}
                      {k.key_type ? ` (${k.key_type})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="ssh-dialog__input"
                  type="text"
                  placeholder="~/.ssh/id_ed25519"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  disabled={connecting}
                />
              )}
            </div>
            <div className="ssh-dialog__field">
              <label className="ssh-dialog__label">
                Key Passphrase{" "}
                <span className="ssh-dialog__optional">(optional)</span>
              </label>
              <input
                className="ssh-dialog__input"
                type="password"
                placeholder="passphrase"
                value={keyPassphrase}
                onChange={(e) => setKeyPassphrase(e.target.value)}
                disabled={connecting}
              />
            </div>
          </>
        )}

        {/* Password */}
        {authMethod === "password" && (
          <div className="ssh-dialog__field">
            <label className="ssh-dialog__label">Password</label>
            <input
              className="ssh-dialog__input"
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={connecting}
            />
          </div>
        )}

        {/* Bastion toggle */}
        <div className="ssh-dialog__bastion-toggle">
          <label className="ssh-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={showBastion}
              onChange={(e) => setShowBastion(e.target.checked)}
              disabled={connecting}
            />
            <span>Connect via bastion/jump host</span>
          </label>
        </div>

        {/* Bastion fields */}
        {showBastion && (
          <div className="ssh-dialog__bastion">
            <div className="ssh-dialog__row">
              <div className="ssh-dialog__field ssh-dialog__field--grow">
                <label className="ssh-dialog__label">Bastion Host</label>
                <input
                  className="ssh-dialog__input"
                  type="text"
                  placeholder="bastion hostname or IP"
                  value={bastionHost}
                  onChange={(e) => setBastionHost(e.target.value)}
                  disabled={connecting}
                />
              </div>
              <div className="ssh-dialog__field ssh-dialog__field--port">
                <label className="ssh-dialog__label">Port</label>
                <input
                  className="ssh-dialog__input"
                  type="number"
                  value={bastionPort}
                  onChange={(e) => setBastionPort(e.target.value)}
                  disabled={connecting}
                />
              </div>
            </div>
            <div className="ssh-dialog__row">
              <div className="ssh-dialog__field ssh-dialog__field--grow">
                <label className="ssh-dialog__label">
                  Bastion User{" "}
                  <span className="ssh-dialog__optional">
                    (defaults to target user)
                  </span>
                </label>
                <input
                  className="ssh-dialog__input"
                  type="text"
                  placeholder="user"
                  value={bastionUser}
                  onChange={(e) => setBastionUser(e.target.value)}
                  disabled={connecting}
                />
              </div>
              <div className="ssh-dialog__field ssh-dialog__field--grow">
                <label className="ssh-dialog__label">
                  Bastion Key{" "}
                  <span className="ssh-dialog__optional">
                    (defaults to target key)
                  </span>
                </label>
                <input
                  className="ssh-dialog__input"
                  type="text"
                  placeholder="~/.ssh/id_ed25519"
                  value={bastionKeyPath}
                  onChange={(e) => setBastionKeyPath(e.target.value)}
                  disabled={connecting}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && <div className="ssh-dialog__error">{error}</div>}

        {/* Actions */}
        <div className="ssh-dialog__actions">
          <button
            type="button"
            className="ssh-dialog__btn ssh-dialog__btn--cancel"
            onClick={onClose}
            disabled={connecting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ssh-dialog__btn ssh-dialog__btn--connect"
            disabled={!canConnect}
          >
            {connecting ? (
              <>
                <span className="ssh-dialog__spinner" />
                Connecting...
              </>
            ) : (
              <>
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
                Connect
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
