/**
 * HostPicker — Dropdown for selecting a fleet host to connect to
 *
 * Fetches hosts from the bastion/collector API, groups them by category,
 * and shows a compact dropdown with status indicators.
 * Also includes a "Manual SSH..." fallback option.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  listHostsGrouped,
  type FleetHost,
  type HostGroup,
} from "../../services/bastionClient";
import "./HostPicker.css";

interface HostPickerProps {
  onSelectHost: (host: FleetHost) => void;
  onManualSsh: () => void;
  disabled?: boolean;
}

export default function HostPicker({
  onSelectHost,
  onManualSsh,
  disabled = false,
}: HostPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch hosts when dropdown opens
  const fetchHosts = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const g = await listHostsGrouped(forceRefresh);
      setGroups(g);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
    setLoading(false);
  }, []);

  // Fetch on first open
  useEffect(() => {
    if (isOpen && groups.length === 0 && !loading) {
      fetchHosts();
    }
  }, [isOpen, groups.length, loading, fetchHosts]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const handleSelectHost = useCallback(
    (host: FleetHost) => {
      setIsOpen(false);
      onSelectHost(host);
    },
    [onSelectHost],
  );

  const handleManualSsh = useCallback(() => {
    setIsOpen(false);
    onManualSsh();
  }, [onManualSsh]);

  const totalHosts = groups.reduce((sum, g) => sum + g.hosts.length, 0);

  return (
    <div className="host-picker" ref={dropdownRef}>
      <button
        className={`host-picker__trigger ${isOpen ? "host-picker__trigger--open" : ""}`}
        onClick={handleToggle}
        disabled={disabled}
        title="Connect to remote host"
      >
        <svg
          width="11"
          height="11"
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
        Connect
        <svg
          className="host-picker__chevron"
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="host-picker__dropdown">
          {/* Header */}
          <div className="host-picker__header">
            <span className="host-picker__header-title">Fleet Hosts</span>
            {totalHosts > 0 && (
              <span className="host-picker__count">{totalHosts}</span>
            )}
            <button
              className="host-picker__refresh"
              onClick={() => fetchHosts(true)}
              disabled={loading}
              title="Refresh host list"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={loading ? "host-picker__spin" : ""}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="host-picker__list">
            {loading && groups.length === 0 && (
              <div className="host-picker__loading">
                <span className="host-picker__spinner" />
                Loading hosts...
              </div>
            )}

            {error && (
              <div className="host-picker__error">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && groups.length === 0 && (
              <div className="host-picker__empty">
                No hosts found. Check your collector connection in Settings.
              </div>
            )}

            {groups.map((group) => (
              <div key={group.name} className="host-picker__group">
                <div className="host-picker__group-name">{group.name}</div>
                {group.hosts.map((host) => (
                  <button
                    key={host.hostname}
                    className="host-picker__host"
                    onClick={() => handleSelectHost(host)}
                  >
                    <span
                      className={`host-picker__status-dot ${
                        host.status === "online"
                          ? "host-picker__status-dot--online"
                          : host.status === "offline"
                            ? "host-picker__status-dot--offline"
                            : ""
                      }`}
                    />
                    <span className="host-picker__hostname">
                      {host.hostname}
                    </span>
                    {host.ip && (
                      <span className="host-picker__ip">{host.ip}</span>
                    )}
                    {host.os && (
                      <span className="host-picker__os">{host.os}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Footer with manual SSH option */}
          <div className="host-picker__footer">
            <button
              className="host-picker__manual-btn"
              onClick={handleManualSsh}
            >
              <svg
                width="11"
                height="11"
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
              Manual SSH...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
