/**
 * bastionClient.ts — Fleet host discovery via Quox collector/bastion API
 *
 * Fetches the host list from the configured collector URL (set in Settings).
 * The actual HTTP request happens in Rust (bastion_list_hosts Tauri command)
 * to bypass CORS and CSP restrictions.
 *
 * Caches results for 30 seconds to avoid hammering the API.
 */

import { invoke } from "@tauri-apps/api/core";

/** A host from the fleet, as returned by the bastion API. */
export interface FleetHost {
  hostname: string;
  ip: string | null;
  group: string | null;
  status: string | null;
  lastSeen: string | null;
  os: string | null;
  cpuCount: number | null;
  memoryTotal: number | null;
}

/** Hosts grouped by their group field. */
export interface HostGroup {
  name: string;
  hosts: FleetHost[];
}

/** Cache entry for host list. */
interface HostCache {
  hosts: FleetHost[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
let hostCache: HostCache | null = null;
let inflightRequest: Promise<FleetHost[]> | null = null;

/**
 * Fetch the host list from the bastion/collector API.
 * Results are cached for 30 seconds.
 *
 * @param forceRefresh - bypass cache and fetch fresh data
 */
export async function listHosts(forceRefresh = false): Promise<FleetHost[]> {
  // Return cached if fresh
  if (
    !forceRefresh &&
    hostCache &&
    Date.now() - hostCache.fetchedAt < CACHE_TTL_MS
  ) {
    return hostCache.hosts;
  }

  // Deduplicate concurrent requests
  if (inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = invoke<FleetHost[]>("bastion_list_hosts")
    .then((hosts) => {
      hostCache = { hosts, fetchedAt: Date.now() };
      inflightRequest = null;
      return hosts;
    })
    .catch((err) => {
      inflightRequest = null;
      throw err;
    });

  return inflightRequest;
}

/**
 * Get hosts grouped by their group field.
 * Ungrouped hosts go into an "Other" group.
 */
export async function listHostsGrouped(
  forceRefresh = false,
): Promise<HostGroup[]> {
  const hosts = await listHosts(forceRefresh);

  const groups = new Map<string, FleetHost[]>();
  for (const host of hosts) {
    const groupName = host.group || "Other";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(host);
  }

  // Sort groups alphabetically, but "Other" goes last
  const sorted = Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    })
    .map(([name, hosts]) => ({
      name,
      hosts: hosts.sort((a, b) => a.hostname.localeCompare(b.hostname)),
    }));

  return sorted;
}

/**
 * Fetch fleet summary from the bastion/collector API.
 */
export async function getFleetSummary(): Promise<Record<string, unknown>> {
  return invoke("bastion_fleet_summary");
}

/** Clear the host cache (e.g. after changing settings). */
export function clearHostCache(): void {
  hostCache = null;
}

/** Check if the host cache has any data. */
export function hasCachedHosts(): boolean {
  return hostCache !== null && hostCache.hosts.length > 0;
}
