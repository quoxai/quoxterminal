/**
 * Fleet Service — Real-time fleet state management via Collector WebSocket events.
 *
 * Listens to Tauri events emitted by the collector WS client and maintains
 * an in-memory map of all fleet agents with their status and metrics.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Types ────────────────────────────────────────────────────────────

export interface FleetAgent {
  host_id: string;
  ip?: string;
  status: 'connected' | 'stale' | 'dead';
  health?: 'healthy' | 'warning' | 'critical';
  cpu_percent?: number;
  memory_percent?: number;
  os?: string;
  uptime?: number;
  last_seen: number;
  group?: string;
}

export interface FleetSummary {
  total: number;
  connected: number;
  stale: number;
  dead: number;
}

// ── State ────────────────────────────────────────────────────────────

const fleetAgents = new Map<string, FleetAgent>();
type FleetChangeHandler = (agents: Map<string, FleetAgent>) => void;
const changeListeners: FleetChangeHandler[] = [];

function notifyListeners(): void {
  const snapshot = new Map(fleetAgents);
  for (const handler of changeListeners) {
    try {
      handler(snapshot);
    } catch {
      /* ignore listener errors */
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Subscribe to fleet state changes. Returns unsubscribe function.
 * Fires immediately with current state.
 */
export function onFleetChange(handler: FleetChangeHandler): () => void {
  changeListeners.push(handler);
  handler(new Map(fleetAgents));
  return () => {
    const idx = changeListeners.indexOf(handler);
    if (idx >= 0) changeListeners.splice(idx, 1);
  };
}

/** Get a snapshot of the current fleet state. */
export function getFleetAgents(): Map<string, FleetAgent> {
  return new Map(fleetAgents);
}

/** Get a summary of fleet status counts. */
export function getFleetSummary(): FleetSummary {
  let connected = 0;
  let stale = 0;
  let dead = 0;
  for (const agent of fleetAgents.values()) {
    if (agent.status === 'connected') connected++;
    else if (agent.status === 'stale') stale++;
    else dead++;
  }
  return { total: fleetAgents.size, connected, stale, dead };
}

// ── Parsing ──────────────────────────────────────────────────────────

function parseAgent(data: Record<string, unknown>): FleetAgent {
  const resources = data.resources as Record<string, unknown> | undefined;
  const cpu = resources?.cpu as Record<string, number> | undefined;
  const memory = resources?.memory as Record<string, number> | undefined;

  // Determine status from various possible formats
  let status: 'connected' | 'stale' | 'dead' = 'connected';
  const rawStatus = (data.status as string) ?? '';
  if (rawStatus === 'offline' || rawStatus === 'dead') status = 'dead';
  else if (rawStatus === 'stale') status = 'stale';

  return {
    host_id: (data.host_id as string) || (data.hostname as string) || '',
    ip: (data.ip as string) || (data.remote_addr as string) || undefined,
    status,
    health: (data.health as FleetAgent['health']) || undefined,
    cpu_percent: cpu?.usage_percent,
    memory_percent: memory?.usage_percent,
    os: (data.os as string) || (data.distribution as string) || undefined,
    uptime: (data.uptime as number) || undefined,
    last_seen: (data.received_at as number) || Date.now(),
    group: (data.group as string) || undefined,
  };
}

// ── Event Listeners ──────────────────────────────────────────────────

let unlisteners: UnlistenFn[] = [];
let _listening = false;

/** Start listening to collector fleet events. Idempotent. */
export async function startFleetListening(): Promise<void> {
  if (_listening) return;
  _listening = true;

  // Fleet init — full agent list on connect
  const u1 = await listen<string>('collector-fleet-init', (event) => {
    try {
      const msg = typeof event.payload === 'string'
        ? JSON.parse(event.payload)
        : event.payload;
      fleetAgents.clear();
      if (Array.isArray(msg.agents)) {
        for (const agentData of msg.agents) {
          const agent = parseAgent(agentData);
          if (agent.host_id) fleetAgents.set(agent.host_id, agent);
        }
      }
      notifyListeners();
    } catch {
      /* ignore parse errors */
    }
  });

  // Agent updates (join / heartbeat)
  const u2 = await listen<string>('collector-agent-update', (event) => {
    try {
      const msg = typeof event.payload === 'string'
        ? JSON.parse(event.payload)
        : event.payload;
      const hostId = msg.host_id || msg.data?.host_id;
      const data = msg.data || msg;
      if (hostId) {
        const agent = parseAgent({ ...data, host_id: hostId });
        fleetAgents.set(hostId, agent);
        notifyListeners();
      }
    } catch {
      /* ignore */
    }
  });

  // Agent removed
  const u3 = await listen<string>('collector-agent-removed', (event) => {
    try {
      const msg = typeof event.payload === 'string'
        ? JSON.parse(event.payload)
        : event.payload;
      if (msg.host_id) {
        fleetAgents.delete(msg.host_id);
        notifyListeners();
      }
    } catch {
      /* ignore */
    }
  });

  unlisteners = [u1, u2, u3];
}

/** Stop listening and clear fleet state. */
export function stopFleetListening(): void {
  for (const unlisten of unlisteners) unlisten();
  unlisteners = [];
  fleetAgents.clear();
  _listening = false;
}
