import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the store module before importing localMemoryStore
const mockStore: Record<string, unknown> = {};

vi.mock('../lib/store', () => ({
  storeGet: vi.fn(async (key: string) => mockStore[key] ?? null),
  storeSet: vi.fn(async (key: string, value: unknown) => {
    mockStore[key] = value;
  }),
}));

import {
  storeEntity,
  touchEntity,
  getAllEntities,
  getEntitiesByType,
  addSession,
  endSession,
  getSessions,
  addError,
  getErrors,
  getLastErrorForHost,
  addResolution,
  addCommand,
  setFocus,
  getFocus,
  migrateFromLocalStorage,
} from '../services/localMemoryStore';

describe('localMemoryStore', () => {
  beforeEach(() => {
    // Clear the mock store between tests
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
  });

  // ── Entity operations ──────────────────────────────────────────────────

  describe('storeEntity', () => {
    it('creates a new entity with mentionCount=1', async () => {
      const entity = await storeEntity('host', 'docker01');
      expect(entity.id).toBe('host:docker01');
      expect(entity.type).toBe('host');
      expect(entity.name).toBe('docker01');
      expect(entity.mentionCount).toBe(1);
      expect(entity.firstSeen).toBeTruthy();
      expect(entity.lastSeen).toBeTruthy();
    });

    it('increments mentionCount on re-store', async () => {
      await storeEntity('host', 'docker01');
      const entity = await storeEntity('host', 'docker01');
      expect(entity.mentionCount).toBe(2);
    });

    it('merges attributes on re-store', async () => {
      await storeEntity('host', 'docker01', { os: 'linux' });
      const entity = await storeEntity('host', 'docker01', { cpu: 4 });
      expect(entity.attributes).toEqual({ os: 'linux', cpu: 4 });
    });

    it('preserves firstSeen on re-store', async () => {
      const first = await storeEntity('host', 'docker01');
      const second = await storeEntity('host', 'docker01');
      expect(second.firstSeen).toBe(first.firstSeen);
    });
  });

  describe('getAllEntities', () => {
    it('returns empty array when no entities stored', async () => {
      const all = await getAllEntities();
      expect(all).toEqual([]);
    });

    it('returns all stored entities', async () => {
      await storeEntity('host', 'docker01');
      await storeEntity('ip', '10.0.0.1');
      const all = await getAllEntities();
      expect(all.length).toBe(2);
    });
  });

  describe('getEntitiesByType', () => {
    it('filters entities by type', async () => {
      await storeEntity('host', 'docker01');
      await storeEntity('host', 'docker02');
      await storeEntity('ip', '10.0.0.1');
      const hosts = await getEntitiesByType('host');
      expect(hosts.length).toBe(2);
      expect(hosts.every((e) => e.type === 'host')).toBe(true);
    });
  });

  describe('touchEntity', () => {
    it('adds entity to recent-entities list', async () => {
      await touchEntity('host', 'host:docker01', { session: 'abc' });
      const recent = mockStore['memory:recent-entities'] as unknown[];
      expect(recent.length).toBe(1);
    });

    it('moves existing entity to end on re-touch', async () => {
      await touchEntity('host', 'host:docker01');
      await touchEntity('host', 'host:docker02');
      await touchEntity('host', 'host:docker01');
      const recent = mockStore['memory:recent-entities'] as { id: string }[];
      expect(recent.length).toBe(2);
      expect(recent[recent.length - 1].id).toBe('host:docker01');
    });
  });

  // ── Session operations ─────────────────────────────────────────────────

  describe('addSession', () => {
    it('adds a session record', async () => {
      await addSession('sess-1', 'docker01', 'ssh');
      const sessions = await getSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe('sess-1');
      expect(sessions[0].hostId).toBe('docker01');
      expect(sessions[0].mode).toBe('ssh');
      expect(sessions[0].status).toBe('active');
    });

    it('trims to 50 sessions', async () => {
      for (let i = 0; i < 55; i++) {
        await addSession(`sess-${i}`, 'host', 'local');
      }
      const sessions = await getSessions();
      expect(sessions.length).toBe(50);
    });
  });

  describe('endSession', () => {
    it('marks session as disconnected', async () => {
      await addSession('sess-1', 'docker01', 'ssh');
      await endSession('sess-1');
      const sessions = await getSessions();
      expect(sessions[0].status).toBe('disconnected');
      expect(sessions[0].disconnectedAt).toBeTruthy();
    });

    it('does nothing for nonexistent session', async () => {
      await endSession('nonexistent');
      const sessions = await getSessions();
      expect(sessions.length).toBe(0);
    });
  });

  // ── Error operations ───────────────────────────────────────────────────

  describe('addError', () => {
    it('stores an error', async () => {
      await addError('permission_denied', 'Permission denied (publickey)', 'docker01');
      const errors = await getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].errorType).toBe('permission_denied');
      expect(errors[0].hostId).toBe('docker01');
    });

    it('defaults hostId to "local" when null', async () => {
      await addError('command_not_found', 'bash: foo: command not found', null);
      const errors = await getErrors();
      expect(errors[0].hostId).toBe('local');
    });

    it('truncates long error lines', async () => {
      const longLine = 'x'.repeat(500);
      await addError('error', longLine, null);
      const errors = await getErrors();
      expect(errors[0].errorLine.length).toBe(200);
    });
  });

  describe('getLastErrorForHost', () => {
    it('returns most recent error for host', async () => {
      await addError('error1', 'first error', 'docker01');
      await addError('error2', 'second error', 'docker01');
      await addError('error3', 'other host', 'docker02');
      const last = await getLastErrorForHost('docker01');
      expect(last).not.toBeNull();
      expect(last!.errorType).toBe('error2');
    });

    it('returns null for host with no errors', async () => {
      const last = await getLastErrorForHost('unknown');
      expect(last).toBeNull();
    });
  });

  // ── Resolution operations ──────────────────────────────────────────────

  describe('addResolution', () => {
    it('stores a resolution', async () => {
      await addResolution('permission_denied', 'Add your SSH key', 'docker01');
      const resolutions = mockStore['memory:resolutions'] as unknown[];
      expect(resolutions.length).toBe(1);
    });
  });

  // ── Command operations ─────────────────────────────────────────────────

  describe('addCommand', () => {
    it('stores a command', async () => {
      await addCommand('docker ps', 'docker01');
      const commands = mockStore['memory:commands'] as { command: string }[];
      expect(commands.length).toBe(1);
      expect(commands[0].command).toBe('docker ps');
    });

    it('defaults hostId to "local" when null', async () => {
      await addCommand('ls -la', null);
      const commands = mockStore['memory:commands'] as { hostId: string }[];
      expect(commands[0].hostId).toBe('local');
    });
  });

  // ── Focus operations ───────────────────────────────────────────────────

  describe('setFocus / getFocus', () => {
    it('stores and retrieves focus', async () => {
      await setFocus('Deploy app', 'Working on docker01');
      const focus = await getFocus();
      expect(focus).not.toBeNull();
      expect(focus!.task).toBe('Deploy app');
      expect(focus!.goal).toBe('Working on docker01');
    });

    it('returns null when no focus set', async () => {
      const focus = await getFocus();
      expect(focus).toBeNull();
    });
  });

  // ── Migration ──────────────────────────────────────────────────────────

  describe('migrateFromLocalStorage', () => {
    it('migrates sessions from localStorage', async () => {
      const oldSessions = [
        { sessionId: 'old-1', hostId: 'docker01', mode: 'ssh', status: 'disconnected', connectedAt: '2025-01-01' },
      ];
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(oldSessions));
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      await migrateFromLocalStorage();

      const sessions = await getSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe('old-1');

      // Should mark as migrated
      expect(mockStore['memory:migrated']).toBe(true);

      vi.restoreAllMocks();
    });

    it('skips if already migrated', async () => {
      mockStore['memory:migrated'] = true;
      const spy = vi.spyOn(Storage.prototype, 'getItem');

      await migrateFromLocalStorage();

      expect(spy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
