/**
 * localMemoryStore.ts — Local-first memory store backed by Tauri store
 *
 * Replaces the collector dependency with local persistence via storeGet/storeSet.
 * All memory data (entities, sessions, errors, commands, focus) is stored
 * in the Tauri plugin-store (falls back to localStorage in dev).
 */

import { storeGet, storeSet } from '../lib/store';

// ============================================================================
// TYPES
// ============================================================================

export interface StoredEntity {
  id: string;            // "type:name"
  type: string;
  name: string;
  firstSeen: string;     // ISO
  lastSeen: string;      // ISO
  mentionCount: number;
  attributes: Record<string, unknown>;
}

export interface SessionRecord {
  sessionId: string;
  hostId: string;
  mode: 'local' | 'ssh';
  status: 'active' | 'disconnected';
  connectedAt: string;
  disconnectedAt?: string;
}

export interface StoredError {
  id: string;
  errorType: string;
  errorLine: string;
  hostId: string;
  detectedAt: string;
}

export interface StoredResolution {
  id: string;
  errorType: string;
  resolution: string;
  hostId: string;
  resolvedAt: string;
}

export interface StoredCommand {
  command: string;
  hostId: string;
  executedAt: string;
}

export interface FocusState {
  task: string;
  goal: string;
  updatedAt: string;
}

export interface RecentEntity {
  type: string;
  id: string;
  context?: Record<string, unknown>;
  touchedAt: string;
}

// ============================================================================
// STORE KEYS
// ============================================================================

const KEYS = {
  ENTITIES: 'memory:entities',
  SESSIONS: 'memory:sessions',
  ERRORS: 'memory:errors',
  RESOLUTIONS: 'memory:resolutions',
  COMMANDS: 'memory:commands',
  FOCUS: 'memory:focus',
  RECENT_ENTITIES: 'memory:recent-entities',
  MIGRATED: 'memory:migrated',
} as const;

// ============================================================================
// LIMITS
// ============================================================================

const MAX_SESSIONS = 50;
const MAX_ERRORS = 100;
const MAX_RESOLUTIONS = 50;
const MAX_COMMANDS = 200;
const MAX_RECENT_ENTITIES = 20;
const RECENT_ENTITY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// ENTITY OPERATIONS
// ============================================================================

/**
 * Store or update an entity. Increments mentionCount on re-encounter.
 */
export async function storeEntity(
  type: string,
  name: string,
  attributes?: Record<string, unknown>,
): Promise<StoredEntity> {
  const entities = await storeGet<Record<string, StoredEntity>>(KEYS.ENTITIES) ?? {};
  const id = `${type}:${name}`;
  const now = new Date().toISOString();

  const existing = entities[id];
  if (existing) {
    existing.lastSeen = now;
    existing.mentionCount += 1;
    if (attributes) {
      existing.attributes = { ...existing.attributes, ...attributes };
    }
    entities[id] = existing;
  } else {
    entities[id] = {
      id,
      type,
      name,
      firstSeen: now,
      lastSeen: now,
      mentionCount: 1,
      attributes: attributes ?? {},
    };
  }

  await storeSet(KEYS.ENTITIES, entities);
  return entities[id];
}

/**
 * Touch an entity in the recent-entities list (WSM equivalent).
 */
export async function touchEntity(
  type: string,
  id: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const recent = await storeGet<RecentEntity[]>(KEYS.RECENT_ENTITIES) ?? [];
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // Remove expired entries
  const filtered = recent.filter(
    (r) => now - new Date(r.touchedAt).getTime() < RECENT_ENTITY_TTL_MS,
  );

  // Remove existing entry for this id (will re-add at end)
  const withoutCurrent = filtered.filter((r) => r.id !== id);

  withoutCurrent.push({ type, id, context, touchedAt: nowIso });

  // Trim to max
  const trimmed = withoutCurrent.slice(-MAX_RECENT_ENTITIES);
  await storeSet(KEYS.RECENT_ENTITIES, trimmed);
}

/**
 * Get all stored entities.
 */
export async function getAllEntities(): Promise<StoredEntity[]> {
  const entities = await storeGet<Record<string, StoredEntity>>(KEYS.ENTITIES) ?? {};
  return Object.values(entities);
}

/**
 * Get entities filtered by type.
 */
export async function getEntitiesByType(type: string): Promise<StoredEntity[]> {
  const all = await getAllEntities();
  return all.filter((e) => e.type === type);
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Add a session record.
 */
export async function addSession(
  sessionId: string,
  hostId: string,
  mode: 'local' | 'ssh',
): Promise<void> {
  const sessions = await storeGet<SessionRecord[]>(KEYS.SESSIONS) ?? [];
  sessions.push({
    sessionId,
    hostId,
    mode,
    status: 'active',
    connectedAt: new Date().toISOString(),
  });
  const trimmed = sessions.slice(-MAX_SESSIONS);
  await storeSet(KEYS.SESSIONS, trimmed);
}

/**
 * Mark a session as disconnected.
 */
export async function endSession(sessionId: string): Promise<void> {
  const sessions = await storeGet<SessionRecord[]>(KEYS.SESSIONS) ?? [];
  const session = sessions.find((s) => s.sessionId === sessionId);
  if (session) {
    session.status = 'disconnected';
    session.disconnectedAt = new Date().toISOString();
    await storeSet(KEYS.SESSIONS, sessions);
  }
}

/**
 * Get all session records.
 */
export async function getSessions(): Promise<SessionRecord[]> {
  return await storeGet<SessionRecord[]>(KEYS.SESSIONS) ?? [];
}

// ============================================================================
// ERROR OPERATIONS
// ============================================================================

/**
 * Store a detected error.
 */
export async function addError(
  errorType: string,
  errorLine: string,
  hostId: string | null,
): Promise<void> {
  const errors = await storeGet<StoredError[]>(KEYS.ERRORS) ?? [];
  errors.push({
    id: `${errorType}_${Date.now()}`,
    errorType,
    errorLine: errorLine.slice(0, 200),
    hostId: hostId || 'local',
    detectedAt: new Date().toISOString(),
  });
  const trimmed = errors.slice(-MAX_ERRORS);
  await storeSet(KEYS.ERRORS, trimmed);
}

/**
 * Get all stored errors.
 */
export async function getErrors(): Promise<StoredError[]> {
  return await storeGet<StoredError[]>(KEYS.ERRORS) ?? [];
}

/**
 * Get the most recent error for a specific host.
 */
export async function getLastErrorForHost(hostId: string): Promise<StoredError | null> {
  const errors = await getErrors();
  const hostErrors = errors.filter((e) => e.hostId === hostId);
  return hostErrors.length > 0 ? hostErrors[hostErrors.length - 1] : null;
}

// ============================================================================
// RESOLUTION OPERATIONS
// ============================================================================

/**
 * Store an error resolution.
 */
export async function addResolution(
  errorType: string,
  resolution: string,
  hostId: string | null,
): Promise<void> {
  const resolutions = await storeGet<StoredResolution[]>(KEYS.RESOLUTIONS) ?? [];
  resolutions.push({
    id: `${errorType}_${Date.now()}`,
    errorType,
    resolution: resolution.slice(0, 500),
    hostId: hostId || 'local',
    resolvedAt: new Date().toISOString(),
  });
  const trimmed = resolutions.slice(-MAX_RESOLUTIONS);
  await storeSet(KEYS.RESOLUTIONS, trimmed);
}

// ============================================================================
// COMMAND OPERATIONS
// ============================================================================

/**
 * Store a command execution.
 */
export async function addCommand(
  command: string,
  hostId: string | null,
): Promise<void> {
  const commands = await storeGet<StoredCommand[]>(KEYS.COMMANDS) ?? [];
  commands.push({
    command: command.slice(0, 200),
    hostId: hostId || 'local',
    executedAt: new Date().toISOString(),
  });
  const trimmed = commands.slice(-MAX_COMMANDS);
  await storeSet(KEYS.COMMANDS, trimmed);
}

// ============================================================================
// FOCUS OPERATIONS
// ============================================================================

/**
 * Set current workspace focus.
 */
export async function setFocus(task: string, goal: string): Promise<void> {
  const focus: FocusState = {
    task,
    goal,
    updatedAt: new Date().toISOString(),
  };
  await storeSet(KEYS.FOCUS, focus);
}

/**
 * Get current workspace focus.
 */
export async function getFocus(): Promise<FocusState | null> {
  return await storeGet<FocusState>(KEYS.FOCUS) ?? null;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * One-time migration from raw localStorage session data to the new store.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  const migrated = await storeGet<boolean>(KEYS.MIGRATED);
  if (migrated) return;

  try {
    const raw = localStorage.getItem('quox_terminal_sessions');
    if (raw) {
      const oldSessions: SessionRecord[] = JSON.parse(raw);
      if (Array.isArray(oldSessions) && oldSessions.length > 0) {
        const existing = await storeGet<SessionRecord[]>(KEYS.SESSIONS) ?? [];
        const merged = [...existing, ...oldSessions].slice(-MAX_SESSIONS);
        await storeSet(KEYS.SESSIONS, merged);
        localStorage.removeItem('quox_terminal_sessions');
      }
    }
  } catch {
    // Migration is best-effort
  }

  await storeSet(KEYS.MIGRATED, true);
}
