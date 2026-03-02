import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadCustomTeams,
  saveCustomTeam,
  deleteCustomTeam,
  getAllTemplates,
  exportTeamAsJson,
  importTeamFromJson,
  loadTeamHistory,
  recordTeamCompletion,
  type TeamHistoryEntry,
} from '../services/teamStorageService';
import { TEAM_TEMPLATES, type TeamTemplate } from '../config/teamConfig';
import { storeGet, storeSet } from '../lib/store';

vi.mock('../lib/store', () => ({
  storeGet: vi.fn().mockResolvedValue(null),
  storeSet: vi.fn().mockResolvedValue(undefined),
}));

const mockStoreGet = storeGet as ReturnType<typeof vi.fn>;
const mockStoreSet = storeSet as ReturnType<typeof vi.fn>;

describe('teamStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadCustomTeams', () => {
    it('returns empty array when store is empty', async () => {
      mockStoreGet.mockResolvedValue(null);
      const teams = await loadCustomTeams();
      expect(teams).toEqual([]);
    });

    it('returns stored teams', async () => {
      const custom: TeamTemplate[] = [
        { ...TEAM_TEMPLATES[0], id: 'custom-1', name: 'My Team' },
      ];
      mockStoreGet.mockResolvedValue(custom);
      const teams = await loadCustomTeams();
      expect(teams.length).toBe(1);
      expect(teams[0].name).toBe('My Team');
    });
  });

  describe('saveCustomTeam', () => {
    it('saves a new custom team', async () => {
      mockStoreGet.mockResolvedValue([]);
      const team: TeamTemplate = { ...TEAM_TEMPLATES[0], id: 'custom-new', name: 'New Team' };
      await saveCustomTeam(team);
      expect(mockStoreSet).toHaveBeenCalledWith(
        'quox-custom-teams',
        expect.arrayContaining([expect.objectContaining({ id: 'custom-new' })]),
      );
    });

    it('updates an existing custom team by ID', async () => {
      const existing = [{ ...TEAM_TEMPLATES[0], id: 'custom-1', name: 'Old Name' }];
      mockStoreGet.mockResolvedValue(existing);
      const updated = { ...TEAM_TEMPLATES[0], id: 'custom-1', name: 'Updated Name' };
      await saveCustomTeam(updated);
      const saved = mockStoreSet.mock.calls[0][1] as TeamTemplate[];
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('Updated Name');
    });
  });

  describe('deleteCustomTeam', () => {
    it('removes a team by ID', async () => {
      const existing = [
        { ...TEAM_TEMPLATES[0], id: 'custom-1' },
        { ...TEAM_TEMPLATES[0], id: 'custom-2' },
      ];
      mockStoreGet.mockResolvedValue(existing);
      await deleteCustomTeam('custom-1');
      const saved = mockStoreSet.mock.calls[0][1] as TeamTemplate[];
      expect(saved.length).toBe(1);
      expect(saved[0].id).toBe('custom-2');
    });
  });

  describe('getAllTemplates', () => {
    it('combines built-in and custom templates', async () => {
      const custom: TeamTemplate[] = [
        { ...TEAM_TEMPLATES[0], id: 'custom-1', name: 'Custom' },
      ];
      mockStoreGet.mockResolvedValue(custom);
      const all = await getAllTemplates();
      expect(all.length).toBe(TEAM_TEMPLATES.length + 1);
    });
  });

  describe('exportTeamAsJson / importTeamFromJson', () => {
    it('round-trips a template through JSON', () => {
      const original: TeamTemplate = { ...TEAM_TEMPLATES[0], id: 'custom-rt', name: 'Roundtrip' };
      const json = exportTeamAsJson(original);
      const imported = importTeamFromJson(json);
      // ID will have custom- prefix since it collides with a built-in
      expect(imported.name).toBe('Roundtrip');
      expect(imported.agents.length).toBe(original.agents.length);
    });

    it('throws on invalid JSON structure', () => {
      expect(() => importTeamFromJson('{}')).toThrow('Invalid team template JSON');
    });

    it('prefixes ID to avoid built-in collision', () => {
      const json = exportTeamAsJson(TEAM_TEMPLATES[0]);
      const imported = importTeamFromJson(json);
      expect(imported.id).toContain('custom-');
    });
  });

  describe('team history', () => {
    it('returns empty array when no history', async () => {
      mockStoreGet.mockResolvedValue(null);
      const history = await loadTeamHistory();
      expect(history).toEqual([]);
    });

    it('records a completed session', async () => {
      mockStoreGet.mockResolvedValue([]);
      const entry: TeamHistoryEntry = {
        id: 'ts-1',
        templateId: 'feature-build',
        templateName: 'Feature Build',
        startedAt: Date.now() - 60000,
        endedAt: Date.now(),
        duration: 60000,
        agentCount: 4,
        taskCount: 5,
      };
      await recordTeamCompletion(entry);
      expect(mockStoreSet).toHaveBeenCalledWith(
        'quox-team-history',
        expect.arrayContaining([expect.objectContaining({ id: 'ts-1' })]),
      );
    });
  });
});
