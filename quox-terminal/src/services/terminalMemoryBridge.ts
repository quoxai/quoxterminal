/**
 * Terminal Memory Bridge Service
 *
 * Connects terminal sessions to the memory system:
 * - Extracts entities (hosts, IPs, services) from terminal output
 * - Tracks session lifecycle (connect/disconnect)
 * - Records error->resolution pairs as learned items (premium)
 * - Records command executions as decisions (premium)
 * - Updates WSM focus on workspace/tab changes (premium)
 *
 * Desktop port: replaces getMemoryManager() calls with Tauri invoke
 * to the collector API (stubs for now). All memory ops wrapped with
 * offline detection via isCollectorAvailable() check.
 *
 * Pattern: follows fileMemoryBridge.js -- pure service, no React.
 * Premium features require the Advanced Memory Plugin ($99 one-time).
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalEntity {
  type: string;
  value?: string;
  name?: string;
}

export interface TerminalError {
  errorType: string;
  errorLine: string;
}

export interface SessionInfo {
  sessionId: string;
  hostId: string;
  mode: 'local' | 'ssh';
  status: 'active' | 'disconnected';
  connectedAt: string;
  disconnectedAt?: string;
}

export interface TerminalMetrics {
  totalSessions: number;
  activeSessions: number;
  uniqueHosts: number;
}

export interface ErrorResolutionResult {
  stored: boolean;
  blocked?: boolean;
  upgrade?: UpgradePrompt;
}

export interface UpgradePrompt {
  feature: string;
  message: string;
  tier: string;
}

export interface MemoryEvent {
  type: string;
  detail: Record<string, unknown>;
  timestamp: string;
  isPremium: boolean;
}

// ============================================================================
// EVENT TYPES (mirrors memoryActivityEmitter)
// ============================================================================

export const EVENT_TYPES = {
  SESSION_START: 'memory:session_start',
  SESSION_END: 'memory:session_end',
  ENTITY_STORED: 'memory:entity_stored',
  ERROR_TRACKED: 'memory:error_tracked',
  RESOLUTION_STORED: 'memory:resolution_stored',
  COMMAND_RECORDED: 'memory:command_recorded',
  FOCUS_UPDATED: 'memory:focus_updated',
  UPGRADE_BLOCKED: 'memory:upgrade_blocked',
} as const;

// ============================================================================
// EVENT EMITTER
// ============================================================================

type EventHandler = (event: MemoryEvent) => void;
const listeners: EventHandler[] = [];

/**
 * Subscribe to memory activity events.
 */
export function onMemoryEvent(handler: EventHandler): () => void {
  listeners.push(handler);
  return () => {
    const idx = listeners.indexOf(handler);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Emit a memory activity event.
 */
function emit(type: string, detail: Record<string, unknown>, isPremium = false): void {
  const event: MemoryEvent = {
    type,
    detail,
    timestamp: new Date().toISOString(),
    isPremium,
  };
  for (const handler of listeners) {
    try {
      handler(event);
    } catch {
      // Don't let listener errors break the bridge
    }
  }
}

// ============================================================================
// COLLECTOR AVAILABILITY
// ============================================================================

let _collectorAvailable: boolean | null = null;
let _lastCollectorCheck = 0;
const COLLECTOR_CHECK_INTERVAL = 30_000; // 30 seconds

/**
 * Check if the Quox Collector is reachable.
 * Caches the result for 30 seconds to avoid excessive pinging.
 */
export async function isCollectorAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_collectorAvailable !== null && now - _lastCollectorCheck < COLLECTOR_CHECK_INTERVAL) {
    return _collectorAvailable;
  }

  try {
    const statusStr = await invoke<string>('collector_status');
    const status = JSON.parse(statusStr);
    _collectorAvailable = status === 'Connected';
    _lastCollectorCheck = now;
    return _collectorAvailable;
  } catch {
    _collectorAvailable = false;
    _lastCollectorCheck = now;
    return false;
  }
}

/**
 * Reset the collector availability cache (e.g., on settings change).
 */
export function resetCollectorCache(): void {
  _collectorAvailable = null;
  _lastCollectorCheck = 0;
}

// ============================================================================
// TIER GATING
// ============================================================================

let _premiumCached: boolean | null = null;

/**
 * Check if premium terminal memory features are available.
 * Premium requires the Advanced Memory plugin.
 */
export async function isPremiumTerminalMemory(): Promise<boolean> {
  try {
    if (!(await isCollectorAvailable())) return false;
    // TODO: Check plugin status via collector API
    return false;
  } catch {
    return false;
  }
}

/**
 * Synchronous check using cached premium status.
 * Falls back to false if not yet checked.
 */
function hasPremiumSync(): boolean {
  return _premiumCached ?? false;
}

/**
 * Update the cached premium status.
 */
export async function refreshPremiumStatus(): Promise<void> {
  _premiumCached = await isPremiumTerminalMemory();
}

/**
 * Create an upgrade prompt for gated features.
 */
function createUpgradePrompt(feature: string): UpgradePrompt {
  return {
    feature,
    message: 'Unlock advanced terminal memory with the Advanced Memory Plugin.',
    tier: 'premium',
  };
}

// ============================================================================
// LOCAL STORAGE KEY
// ============================================================================

const SESSIONS_KEY = 'quox_terminal_sessions';
const MAX_ERROR_LINE = 200;

// ============================================================================
// SESSION LIFECYCLE
// ============================================================================

/**
 * Track a terminal session start.
 * Free: stores session entity, touches host entity.
 * Premium: also sets WSM current focus.
 */
export async function trackSessionStart(
  hostId: string | null,
  sessionId: string,
  mode: 'local' | 'ssh'
): Promise<void> {
  try {
    const host = hostId || 'local';
    const now = new Date().toISOString();

    // Store locally (always works, even offline)
    _trackSessionLocally(sessionId, host, mode);

    // Attempt to store in collector if available
    if (await isCollectorAvailable()) {
      try {
        await invoke('collector_store_entity', {
          entityType: 'terminal_session',
          name: sessionId,
          attributes: { hostId: host, mode, connectedAt: now, status: 'active' },
        });

        await invoke('collector_touch_entity', {
          entityType: 'host',
          id: host,
          name: host,
          context: { lastTerminalSession: now },
        });
      } catch {
        // Collector unavailable -- continue with local-only tracking
      }

      // Premium: set WSM focus
      if (hasPremiumSync()) {
        try {
          await invoke('collector_set_focus', {
            task: `Terminal on ${host}`,
            goal: `${mode === 'ssh' ? 'SSH' : 'Local'} session active`,
          });
        } catch {
          // Non-critical
        }
      }
    }

    emit(EVENT_TYPES.SESSION_START, { hostId: host, mode });
    console.log(`[TerminalMemoryBridge] Session started: ${sessionId} on ${host}`);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to track session start:', err);
  }
}

/**
 * Track a terminal session end.
 * Updates session entity status to 'disconnected'.
 */
export async function trackSessionEnd(sessionId: string): Promise<void> {
  try {
    _updateSessionLocally(sessionId, 'disconnected');

    if (await isCollectorAvailable()) {
      try {
        await invoke('collector_store_entity', {
          entityType: 'terminal_session',
          name: sessionId,
          attributes: {
            status: 'disconnected',
            disconnectedAt: new Date().toISOString(),
          },
        });
      } catch {
        // Collector unavailable
      }
    }

    emit(EVENT_TYPES.SESSION_END, { sessionId });
    console.log(`[TerminalMemoryBridge] Session ended: ${sessionId}`);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to track session end:', err);
  }
}

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

/**
 * Extract entities (hosts, IPs, services, containers, ports) from terminal output.
 * Stores each entity and touches it in WSM.
 */
export async function extractEntitiesFromOutput(
  cleanOutput: string
): Promise<TerminalEntity[]> {
  if (!cleanOutput || cleanOutput.length < 5) return [];

  try {
    if (!(await isCollectorAvailable())) return [];

    try {
      // TODO: Use collector's built-in entity extraction
      const entities: TerminalEntity[] = await invoke('collector_extract_entities', {
        text: cleanOutput,
      });

      // Store each extracted entity
      for (const entity of entities) {
        try {
          await invoke('collector_store_entity', {
            entityType: entity.type,
            name: entity.value || entity.name,
            attributes: {
              source: 'terminal',
              detectedAt: new Date().toISOString(),
            },
          });

          emit(EVENT_TYPES.ENTITY_STORED, {
            type: entity.type,
            name: entity.value || entity.name || '',
          });
        } catch {
          // Individual entity storage failure -- continue
        }
      }

      return entities;
    } catch {
      return [];
    }
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Entity extraction failed:', err);
    return [];
  }
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

/**
 * Record a detected terminal error in memory.
 * Free: stores error entity.
 * Premium: also creates an open loop.
 */
export async function recordDetectedError(
  error: TerminalError,
  hostId: string | null
): Promise<void> {
  if (!error) return;

  try {
    const host = hostId || 'local';
    const truncatedLine = (error.errorLine || '').slice(0, MAX_ERROR_LINE);

    if (await isCollectorAvailable()) {
      try {
        // Store error entity (free)
        await invoke('collector_store_entity', {
          entityType: 'error',
          name: `${error.errorType}_${Date.now()}`,
          attributes: {
            errorType: error.errorType,
            errorLine: truncatedLine,
            hostId: host,
            source: 'terminal',
            detectedAt: new Date().toISOString(),
          },
        });

        // Premium: create an open loop for unresolved errors
        if (hasPremiumSync()) {
          await invoke('collector_add_open_loop', {
            loopType: 'task',
            description: `${error.errorType} on ${host}: ${truncatedLine}`,
            priority: 'medium',
          });
        }
      } catch {
        // Collector unavailable
      }
    }

    emit(EVENT_TYPES.ERROR_TRACKED, { errorType: error.errorType, hostId: host });
    console.log(`[TerminalMemoryBridge] Error recorded: ${error.errorType}`);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record error:', err);
  }
}

/**
 * Record an error resolution (error + AI explanation).
 * Premium only: stores as a learned item of type 'error'.
 * Free: returns upgrade prompt.
 */
export async function recordErrorResolution(
  error: TerminalError,
  aiResponse: string,
  hostId: string | null
): Promise<ErrorResolutionResult> {
  if (!error || !aiResponse) return { stored: false };

  // Premium only
  if (!hasPremiumSync()) {
    emit(EVENT_TYPES.UPGRADE_BLOCKED, { feature: 'resolution' });
    return {
      stored: false,
      blocked: true,
      upgrade: createUpgradePrompt('terminalMemory'),
    };
  }

  try {
    if (!(await isCollectorAvailable())) return { stored: false };

    const host = hostId || 'local';
    const truncatedLine = (error.errorLine || '').slice(0, MAX_ERROR_LINE);
    const truncatedResponse = aiResponse.slice(0, 500);

    try {
      await invoke('collector_add_learned_item', {
        itemType: 'error',
        content: `Error ${error.errorType}: ${truncatedLine} -- Resolution: ${truncatedResponse}`,
        tags: ['terminal', host, error.errorType],
        source: 'terminal-memory-bridge',
      });

      emit(EVENT_TYPES.RESOLUTION_STORED, { errorType: error.errorType }, true);
      console.log(`[TerminalMemoryBridge] Error resolution stored: ${error.errorType}`);
      return { stored: true };
    } catch {
      return { stored: false };
    }
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record error resolution:', err);
    return { stored: false };
  }
}

// ============================================================================
// COMMAND TRACKING
// ============================================================================

/**
 * Record a command execution as a decision.
 * Premium only (uses WSM recordDecision).
 */
export async function recordCommandExecution(
  command: string,
  hostId: string | null
): Promise<void> {
  if (!command || !hasPremiumSync()) return;

  try {
    if (!(await isCollectorAvailable())) return;

    await invoke('collector_record_decision', {
      decision: `Executed: ${command.slice(0, 200)}`,
      context: {
        hostId: hostId || 'local',
        source: 'terminal',
        executedAt: new Date().toISOString(),
      },
    });

    emit(EVENT_TYPES.COMMAND_RECORDED, { command: command.slice(0, 80) }, true);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record command:', err);
  }
}

// ============================================================================
// FOCUS TRACKING
// ============================================================================

/**
 * Update WSM focus when terminal workspace/tab changes.
 * Premium only.
 */
export async function updateTerminalFocus(
  workspaceName: string,
  hostId: string | null
): Promise<void> {
  if (!hasPremiumSync()) return;

  try {
    if (!(await isCollectorAvailable())) return;

    await invoke('collector_set_focus', {
      task: `Workspace: ${workspaceName}`,
      goal: `Working on ${hostId || 'local'}`,
    });

    emit(EVENT_TYPES.FOCUS_UPDATED, { workspace: workspaceName }, true);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to update focus:', err);
  }
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Get terminal session metrics from local tracking.
 * Works for all tiers (no collector needed).
 */
export function getTerminalMetrics(): TerminalMetrics {
  try {
    const sessions = _getLocalSessions();
    const active = sessions.filter((s) => s.status === 'active');
    const hosts = new Set(sessions.map((s) => s.hostId));

    return {
      totalSessions: sessions.length,
      activeSessions: active.length,
      uniqueHosts: hosts.size,
    };
  } catch {
    return { totalSessions: 0, activeSessions: 0, uniqueHosts: 0 };
  }
}

// ============================================================================
// PRIVATE: LOCAL SESSION TRACKING
// ============================================================================

function _trackSessionLocally(sessionId: string, hostId: string, mode: string): void {
  try {
    const sessions = _getLocalSessions();
    sessions.push({
      sessionId,
      hostId,
      mode: mode as 'local' | 'ssh',
      status: 'active',
      connectedAt: new Date().toISOString(),
    });
    // Keep only last 50 sessions
    const trimmed = sessions.slice(-50);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable
  }
}

function _updateSessionLocally(sessionId: string, status: 'active' | 'disconnected'): void {
  try {
    const sessions = _getLocalSessions();
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      session.status = status;
      session.disconnectedAt = new Date().toISOString();
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  } catch {
    // localStorage may be unavailable
  }
}

function _getLocalSessions(): SessionInfo[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const terminalMemoryBridge = {
  isPremiumTerminalMemory,
  trackSessionStart,
  trackSessionEnd,
  extractEntitiesFromOutput,
  recordDetectedError,
  recordErrorResolution,
  recordCommandExecution,
  updateTerminalFocus,
  getTerminalMetrics,
  isCollectorAvailable,
  resetCollectorCache,
  refreshPremiumStatus,
  onMemoryEvent,
  EVENT_TYPES,
};

export default terminalMemoryBridge;
