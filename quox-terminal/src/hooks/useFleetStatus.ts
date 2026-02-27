/**
 * useFleetStatus — React hook for real-time fleet status from the collector.
 *
 * Subscribes to fleetService and provides reactive state:
 * - agents: Map of all fleet agents
 * - connected/stale/dead/total counts
 *
 * Starts fleet event listening on mount, cleans up on unmount.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  onFleetChange,
  startFleetListening,
  type FleetAgent,
} from '../services/fleetService';

export interface FleetStatusResult {
  agents: Map<string, FleetAgent>;
  agentList: FleetAgent[];
  connected: number;
  stale: number;
  dead: number;
  total: number;
}

export function useFleetStatus(): FleetStatusResult {
  const [agents, setAgents] = useState<Map<string, FleetAgent>>(new Map());

  useEffect(() => {
    startFleetListening();
    const unsub = onFleetChange((newAgents) => {
      setAgents(newAgents);
    });
    return unsub;
  }, []);

  const agentList = Array.from(agents.values());
  const connected = agentList.filter((a) => a.status === 'connected').length;
  const stale = agentList.filter((a) => a.status === 'stale').length;
  const dead = agentList.filter((a) => a.status === 'dead').length;

  return { agents, agentList, connected, stale, dead, total: agents.size };
}
