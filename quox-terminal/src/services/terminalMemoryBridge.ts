/**
 * Terminal Memory Bridge Service
 *
 * Connects terminal sessions to the memory system:
 * - Extracts entities (hosts, IPs, services) from terminal output
 * - Tracks session lifecycle (connect/disconnect)
 * - Records error->resolution pairs
 * - Records command executions
 * - Updates workspace focus
 *
 * Local-first: all memory operations use the Tauri store via localMemoryStore.
 * No collector/Rust backend dependency. Entity extraction runs in pure TypeScript.
 *
 * Pattern: follows fileMemoryBridge.js -- pure service, no React.
 */

import { extractEntities } from '../utils/entityExtractor';
import * as localStore from './localMemoryStore';

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
// AVAILABILITY (local-first — always available)
// ============================================================================

/**
 * Check if memory storage is available.
 * Local-first: always returns true (no external dependency).
 */
export async function isCollectorAvailable(): Promise<boolean> {
  return true;
}

/**
 * Reset the collector availability cache (no-op for local-first).
 */
export function resetCollectorCache(): void {
  // No-op — local store is always available
}

// ============================================================================
// TIER GATING (local-first — all features available)
// ============================================================================

/**
 * Check if premium terminal memory features are available.
 * Local-first: all features work on desktop without a collector.
 */
export async function isPremiumTerminalMemory(): Promise<boolean> {
  return true;
}

/**
 * Update the cached premium status (no-op for local-first).
 */
export async function refreshPremiumStatus(): Promise<void> {
  // No-op — always premium on desktop
}

// ============================================================================
// SESSION LIFECYCLE
// ============================================================================

/**
 * Track a terminal session start.
 * Stores session record, entity, and touches host entity.
 */
export async function trackSessionStart(
  hostId: string | null,
  sessionId: string,
  mode: 'local' | 'ssh'
): Promise<void> {
  try {
    const host = hostId || 'local';
    const now = new Date().toISOString();

    // Store session in local store
    await localStore.addSession(sessionId, host, mode);

    // Store host entity
    await localStore.storeEntity('host', host, {
      lastTerminalSession: now,
      mode,
    });

    // Touch host in recent entities
    await localStore.touchEntity('host', `host:${host}`, {
      lastTerminalSession: now,
    });

    // Set focus
    await localStore.setFocus(
      `Terminal on ${host}`,
      `${mode === 'ssh' ? 'SSH' : 'Local'} session active`,
    );

    emit(EVENT_TYPES.SESSION_START, { hostId: host, mode });
    console.log(`[TerminalMemoryBridge] Session started: ${sessionId} on ${host}`);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to track session start:', err);
  }
}

/**
 * Track a terminal session end.
 * Updates session record status to 'disconnected'.
 */
export async function trackSessionEnd(sessionId: string): Promise<void> {
  try {
    await localStore.endSession(sessionId);

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
 * Stores each entity and touches it in recent-entities list.
 */
export async function extractEntitiesFromOutput(
  cleanOutput: string
): Promise<TerminalEntity[]> {
  if (!cleanOutput || cleanOutput.length < 5) return [];

  try {
    const extracted = extractEntities(cleanOutput);

    // Store each extracted entity
    for (const entity of extracted) {
      const entityName = entity.value || entity.name || '';
      if (!entityName) continue;

      try {
        await localStore.storeEntity(entity.type, entityName, {
          source: 'terminal',
          detectedAt: new Date().toISOString(),
        });

        await localStore.touchEntity(entity.type, `${entity.type}:${entityName}`);

        emit(EVENT_TYPES.ENTITY_STORED, {
          type: entity.type,
          name: entityName,
        });
      } catch {
        // Individual entity storage failure -- continue
      }
    }

    // Convert to TerminalEntity format
    return extracted.map((e) => ({
      type: e.type,
      name: e.name,
      value: e.value,
    }));
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Entity extraction failed:', err);
    return [];
  }
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

const MAX_ERROR_LINE = 200;

/**
 * Record a detected terminal error in memory.
 */
export async function recordDetectedError(
  error: TerminalError,
  hostId: string | null
): Promise<void> {
  if (!error) return;

  try {
    const host = hostId || 'local';
    const truncatedLine = (error.errorLine || '').slice(0, MAX_ERROR_LINE);

    await localStore.addError(error.errorType, truncatedLine, host);

    emit(EVENT_TYPES.ERROR_TRACKED, { errorType: error.errorType, hostId: host });
    console.log(`[TerminalMemoryBridge] Error recorded: ${error.errorType}`);
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record error:', err);
  }
}

/**
 * Record an error resolution (error + AI explanation).
 */
export async function recordErrorResolution(
  error: TerminalError,
  aiResponse: string,
  hostId: string | null
): Promise<ErrorResolutionResult> {
  if (!error || !aiResponse) return { stored: false };

  try {
    const host = hostId || 'local';
    const truncatedResponse = aiResponse.slice(0, 500);

    await localStore.addResolution(error.errorType, truncatedResponse, host);

    emit(EVENT_TYPES.RESOLUTION_STORED, { errorType: error.errorType });
    console.log(`[TerminalMemoryBridge] Error resolution stored: ${error.errorType}`);
    return { stored: true };
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record error resolution:', err);
    return { stored: false };
  }
}

// ============================================================================
// COMMAND TRACKING
// ============================================================================

/**
 * Record a command execution.
 */
export async function recordCommandExecution(
  command: string,
  hostId: string | null
): Promise<void> {
  if (!command) return;

  try {
    await localStore.addCommand(command, hostId);

    emit(EVENT_TYPES.COMMAND_RECORDED, { command: command.slice(0, 80) });
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to record command:', err);
  }
}

// ============================================================================
// FOCUS TRACKING
// ============================================================================

/**
 * Update workspace focus when terminal workspace/tab changes.
 */
export async function updateTerminalFocus(
  workspaceName: string,
  hostId: string | null
): Promise<void> {
  try {
    await localStore.setFocus(
      `Workspace: ${workspaceName}`,
      `Working on ${hostId || 'local'}`,
    );

    emit(EVENT_TYPES.FOCUS_UPDATED, { workspace: workspaceName });
  } catch (err) {
    console.warn('[TerminalMemoryBridge] Failed to update focus:', err);
  }
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Get terminal session metrics from local store.
 */
export async function getTerminalMetrics(): Promise<TerminalMetrics> {
  try {
    const sessions = await localStore.getSessions();
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
