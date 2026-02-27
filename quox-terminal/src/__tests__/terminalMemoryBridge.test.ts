import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localMemoryStore
vi.mock('../services/localMemoryStore', () => ({
  storeEntity: vi.fn(async () => ({
    id: 'host:docker01', type: 'host', name: 'docker01',
    firstSeen: '2025-01-01', lastSeen: '2025-01-01', mentionCount: 1, attributes: {},
  })),
  touchEntity: vi.fn(async () => {}),
  addSession: vi.fn(async () => {}),
  endSession: vi.fn(async () => {}),
  getSessions: vi.fn(async () => []),
  addError: vi.fn(async () => {}),
  getErrors: vi.fn(async () => []),
  addResolution: vi.fn(async () => {}),
  addCommand: vi.fn(async () => {}),
  setFocus: vi.fn(async () => {}),
  getFocus: vi.fn(async () => null),
}));

// Mock entityExtractor
vi.mock('../utils/entityExtractor', () => ({
  extractEntities: vi.fn(() => []),
}));

import {
  isCollectorAvailable,
  isPremiumTerminalMemory,
  trackSessionStart,
  trackSessionEnd,
  extractEntitiesFromOutput,
  recordDetectedError,
  recordErrorResolution,
  recordCommandExecution,
  updateTerminalFocus,
  getTerminalMetrics,
  onMemoryEvent,
  EVENT_TYPES,
  type MemoryEvent,
} from '../services/terminalMemoryBridge';

import * as localStore from '../services/localMemoryStore';
import { extractEntities } from '../utils/entityExtractor';

describe('terminalMemoryBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Availability ───────────────────────────────────────────────────────

  describe('isCollectorAvailable', () => {
    it('always returns true (local-first)', async () => {
      expect(await isCollectorAvailable()).toBe(true);
    });
  });

  describe('isPremiumTerminalMemory', () => {
    it('always returns true (local-first)', async () => {
      expect(await isPremiumTerminalMemory()).toBe(true);
    });
  });

  // ── Session lifecycle ──────────────────────────────────────────────────

  describe('trackSessionStart', () => {
    it('calls localStore.addSession', async () => {
      await trackSessionStart('docker01', 'sess-1', 'ssh');
      expect(localStore.addSession).toHaveBeenCalledWith('sess-1', 'docker01', 'ssh');
    });

    it('stores host entity', async () => {
      await trackSessionStart('docker01', 'sess-1', 'ssh');
      expect(localStore.storeEntity).toHaveBeenCalledWith(
        'host', 'docker01',
        expect.objectContaining({ mode: 'ssh' }),
      );
    });

    it('touches host in recent entities', async () => {
      await trackSessionStart('docker01', 'sess-1', 'ssh');
      expect(localStore.touchEntity).toHaveBeenCalledWith(
        'host', 'host:docker01',
        expect.any(Object),
      );
    });

    it('sets focus', async () => {
      await trackSessionStart('docker01', 'sess-1', 'ssh');
      expect(localStore.setFocus).toHaveBeenCalledWith(
        'Terminal on docker01',
        'SSH session active',
      );
    });

    it('defaults hostId to "local" when null', async () => {
      await trackSessionStart(null, 'sess-1', 'local');
      expect(localStore.addSession).toHaveBeenCalledWith('sess-1', 'local', 'local');
    });

    it('emits SESSION_START event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await trackSessionStart('docker01', 'sess-1', 'ssh');
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.SESSION_START)).toBe(true);
    });
  });

  describe('trackSessionEnd', () => {
    it('calls localStore.endSession', async () => {
      await trackSessionEnd('sess-1');
      expect(localStore.endSession).toHaveBeenCalledWith('sess-1');
    });

    it('emits SESSION_END event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await trackSessionEnd('sess-1');
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.SESSION_END)).toBe(true);
    });
  });

  // ── Entity extraction ──────────────────────────────────────────────────

  describe('extractEntitiesFromOutput', () => {
    it('returns [] for short input', async () => {
      const result = await extractEntitiesFromOutput('hi');
      expect(result).toEqual([]);
    });

    it('calls extractEntities and stores results', async () => {
      vi.mocked(extractEntities).mockReturnValue([
        { type: 'host', name: 'docker01', source: 'pattern' },
        { type: 'ip', value: '10.0.0.1', source: 'pattern' },
      ]);

      const result = await extractEntitiesFromOutput('host: docker01 at 10.0.0.1');
      expect(extractEntities).toHaveBeenCalledWith('host: docker01 at 10.0.0.1');
      expect(result.length).toBe(2);
      expect(localStore.storeEntity).toHaveBeenCalledTimes(2);
      expect(localStore.touchEntity).toHaveBeenCalledTimes(2);
    });

    it('emits ENTITY_STORED per entity', async () => {
      vi.mocked(extractEntities).mockReturnValue([
        { type: 'host', name: 'docker01', source: 'pattern' },
      ]);

      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await extractEntitiesFromOutput('host: docker01 running');
      unsub();

      const entityEvents = events.filter((e) => e.type === EVENT_TYPES.ENTITY_STORED);
      expect(entityEvents.length).toBe(1);
      expect(entityEvents[0].detail.name).toBe('docker01');
    });
  });

  // ── Error tracking ─────────────────────────────────────────────────────

  describe('recordDetectedError', () => {
    it('calls localStore.addError', async () => {
      await recordDetectedError(
        { errorType: 'permission_denied', errorLine: 'Permission denied' },
        'docker01',
      );
      expect(localStore.addError).toHaveBeenCalledWith(
        'permission_denied', 'Permission denied', 'docker01',
      );
    });

    it('emits ERROR_TRACKED event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await recordDetectedError(
        { errorType: 'permission_denied', errorLine: 'denied' },
        'docker01',
      );
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.ERROR_TRACKED)).toBe(true);
    });

    it('does nothing for null error', async () => {
      await recordDetectedError(null as unknown as { errorType: string; errorLine: string }, null);
      expect(localStore.addError).not.toHaveBeenCalled();
    });
  });

  describe('recordErrorResolution', () => {
    it('calls localStore.addResolution and returns stored=true', async () => {
      const result = await recordErrorResolution(
        { errorType: 'permission_denied', errorLine: 'denied' },
        'Add SSH key to authorized_keys',
        'docker01',
      );
      expect(localStore.addResolution).toHaveBeenCalledWith(
        'permission_denied',
        'Add SSH key to authorized_keys',
        'docker01',
      );
      expect(result.stored).toBe(true);
    });

    it('emits RESOLUTION_STORED event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await recordErrorResolution(
        { errorType: 'err', errorLine: 'line' },
        'fix it',
        null,
      );
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.RESOLUTION_STORED)).toBe(true);
    });

    it('returns stored=false for missing error or response', async () => {
      expect((await recordErrorResolution(null as never, 'resp', null)).stored).toBe(false);
      expect((await recordErrorResolution({ errorType: 'e', errorLine: 'l' }, '', null)).stored).toBe(false);
    });
  });

  // ── Command tracking ───────────────────────────────────────────────────

  describe('recordCommandExecution', () => {
    it('calls localStore.addCommand', async () => {
      await recordCommandExecution('docker ps', 'docker01');
      expect(localStore.addCommand).toHaveBeenCalledWith('docker ps', 'docker01');
    });

    it('emits COMMAND_RECORDED event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await recordCommandExecution('docker ps', 'docker01');
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.COMMAND_RECORDED)).toBe(true);
    });

    it('does nothing for empty command', async () => {
      await recordCommandExecution('', null);
      expect(localStore.addCommand).not.toHaveBeenCalled();
    });
  });

  // ── Focus tracking ─────────────────────────────────────────────────────

  describe('updateTerminalFocus', () => {
    it('calls localStore.setFocus', async () => {
      await updateTerminalFocus('Main', 'docker01');
      expect(localStore.setFocus).toHaveBeenCalledWith(
        'Workspace: Main',
        'Working on docker01',
      );
    });

    it('emits FOCUS_UPDATED event', async () => {
      const events: MemoryEvent[] = [];
      const unsub = onMemoryEvent((e) => events.push(e));
      await updateTerminalFocus('Main', null);
      unsub();
      expect(events.some((e) => e.type === EVENT_TYPES.FOCUS_UPDATED)).toBe(true);
    });
  });

  // ── Metrics ────────────────────────────────────────────────────────────

  describe('getTerminalMetrics', () => {
    it('returns metrics from local store sessions', async () => {
      vi.mocked(localStore.getSessions).mockResolvedValue([
        { sessionId: 's1', hostId: 'docker01', mode: 'ssh', status: 'active', connectedAt: '2025-01-01' },
        { sessionId: 's2', hostId: 'docker02', mode: 'ssh', status: 'disconnected', connectedAt: '2025-01-01' },
      ]);

      const metrics = await getTerminalMetrics();
      expect(metrics.totalSessions).toBe(2);
      expect(metrics.activeSessions).toBe(1);
      expect(metrics.uniqueHosts).toBe(2);
    });

    it('returns zeros when no sessions', async () => {
      vi.mocked(localStore.getSessions).mockResolvedValue([]);
      const metrics = await getTerminalMetrics();
      expect(metrics).toEqual({ totalSessions: 0, activeSessions: 0, uniqueHosts: 0 });
    });
  });
});
