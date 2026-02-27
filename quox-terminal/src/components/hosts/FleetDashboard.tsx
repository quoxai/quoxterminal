/**
 * FleetDashboard — Real-time fleet status sidebar panel.
 *
 * Shows connected agents from the collector with status indicators,
 * CPU/memory metrics, and click-to-connect functionality.
 */

import React, { useMemo } from 'react';
import { useFleetStatus } from '../../hooks/useFleetStatus';
import type { FleetAgent } from '../../services/fleetService';
import './FleetDashboard.css';

interface FleetDashboardProps {
  onClose: () => void;
  /** Called when user clicks a host to open an SSH connection */
  onConnectHost?: (hostId: string) => void;
}

/** Format seconds to human-readable uptime. */
function formatUptime(seconds?: number): string {
  if (!seconds) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Format a timestamp to relative time. */
function formatLastSeen(ts?: number): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Get CSS class for a metric value. */
function metricClass(value?: number, warnAt = 70, critAt = 90): string {
  if (value == null) return '';
  if (value >= critAt) return 'fleet-dashboard__metric--crit';
  if (value >= warnAt) return 'fleet-dashboard__metric--warn';
  return '';
}

/** Group agents by their group field. */
function groupAgents(agents: FleetAgent[]): Map<string, FleetAgent[]> {
  const groups = new Map<string, FleetAgent[]>();
  for (const agent of agents) {
    const key = agent.group || 'Other';
    const list = groups.get(key) || [];
    list.push(agent);
    groups.set(key, list);
  }
  // Sort groups, "Other" last
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    })
  );
  return sorted;
}

export default function FleetDashboard({ onClose, onConnectHost }: FleetDashboardProps) {
  const { agentList, connected, stale, dead, total } = useFleetStatus();

  const grouped = useMemo(() => groupAgents(agentList), [agentList]);

  return (
    <div className="fleet-dashboard">
      {/* Header */}
      <div className="fleet-dashboard__header">
        <div className="fleet-dashboard__header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="8" rx="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="18" r="1" fill="currentColor" />
          </svg>
          <span className="fleet-dashboard__header-title">Fleet</span>
        </div>
        <button className="fleet-dashboard__close-btn" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      {/* Summary bar */}
      <div className="fleet-dashboard__summary">
        <div className="fleet-dashboard__stat fleet-dashboard__stat--total">
          <div className="fleet-dashboard__stat-value">{total}</div>
          <div className="fleet-dashboard__stat-label">Total</div>
        </div>
        <div className="fleet-dashboard__stat fleet-dashboard__stat--connected">
          <div className="fleet-dashboard__stat-value">{connected}</div>
          <div className="fleet-dashboard__stat-label">Online</div>
        </div>
        <div className="fleet-dashboard__stat fleet-dashboard__stat--stale">
          <div className="fleet-dashboard__stat-value">{stale}</div>
          <div className="fleet-dashboard__stat-label">Stale</div>
        </div>
        <div className="fleet-dashboard__stat fleet-dashboard__stat--dead">
          <div className="fleet-dashboard__stat-value">{dead}</div>
          <div className="fleet-dashboard__stat-label">Dead</div>
        </div>
      </div>

      {/* Agent list */}
      <div className="fleet-dashboard__list">
        {total === 0 ? (
          <div className="fleet-dashboard__empty">
            <div className="fleet-dashboard__empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <div>No agents connected</div>
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
              Configure your collector in Settings
            </div>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([group, agents]) => (
            <div key={group}>
              <div className="fleet-dashboard__group-label">{group}</div>
              {agents.map((agent) => (
                <div
                  key={agent.host_id}
                  className="fleet-dashboard__agent"
                  onClick={() => onConnectHost?.(agent.host_id)}
                  title={`Connect to ${agent.host_id}`}
                >
                  <div className={`fleet-dashboard__agent-dot fleet-dashboard__agent-dot--${agent.status}`} />
                  <div className="fleet-dashboard__agent-info">
                    <div className="fleet-dashboard__agent-name">{agent.host_id}</div>
                    <div className="fleet-dashboard__agent-detail">
                      {[
                        agent.ip,
                        agent.os,
                        formatUptime(agent.uptime),
                        formatLastSeen(agent.last_seen),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="fleet-dashboard__agent-metrics">
                    {agent.cpu_percent != null && (
                      <span className={`fleet-dashboard__metric ${metricClass(agent.cpu_percent)}`}>
                        {Math.round(agent.cpu_percent)}%
                      </span>
                    )}
                    {agent.memory_percent != null && (
                      <span className={`fleet-dashboard__metric ${metricClass(agent.memory_percent)}`}>
                        {Math.round(agent.memory_percent)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
