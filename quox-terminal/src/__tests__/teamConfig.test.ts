import { describe, it, expect } from 'vitest';
import {
  TEAM_TEMPLATES,
  TEAM_ENV_KEYS,
  getAgentEnv,
  generateTaskListId,
  getTemplate,
  estimateTeamCostPerHour,
} from '../config/teamConfig';
import { LAYOUTS } from '../hooks/useTerminalWorkspace';
import { TERMINAL_MODES, CLAUDE_MODELS } from '../config/terminalModes';

describe('teamConfig', () => {
  describe('TEAM_TEMPLATES', () => {
    it('has at least 2 templates', () => {
      expect(TEAM_TEMPLATES.length).toBeGreaterThanOrEqual(2);
    });

    it('all templates have valid layouts from LAYOUTS map', () => {
      for (const tpl of TEAM_TEMPLATES) {
        expect(LAYOUTS).toHaveProperty(tpl.layout);
      }
    });

    it('all templates have 2-4 agents (respects MAX_PANES=4)', () => {
      for (const tpl of TEAM_TEMPLATES) {
        expect(tpl.agents.length).toBeGreaterThanOrEqual(2);
        expect(tpl.agents.length).toBeLessThanOrEqual(4);
      }
    });

    it('agent count matches layout pane count', () => {
      for (const tpl of TEAM_TEMPLATES) {
        const paneCount = LAYOUTS[tpl.layout];
        expect(tpl.agents.length).toBe(paneCount);
      }
    });

    it('templates with a lead have lead as the first agent', () => {
      for (const tpl of TEAM_TEMPLATES) {
        const hasLead = tpl.agents.some((a) => a.isLead);
        if (hasLead) {
          expect(tpl.agents[0].isLead).toBe(true);
        }
      }
    });

    it('each template has exactly one lead agent', () => {
      for (const tpl of TEAM_TEMPLATES) {
        const leads = tpl.agents.filter((a) => a.isLead);
        expect(leads.length).toBe(1);
      }
    });

    it('all agents reference valid modeIds', () => {
      const validModes = Object.keys(TERMINAL_MODES);
      for (const tpl of TEAM_TEMPLATES) {
        for (const agent of tpl.agents) {
          expect(validModes).toContain(agent.modeId);
        }
      }
    });

    it('all agents reference valid modelIds', () => {
      const validModels = CLAUDE_MODELS.map((m) => m.id);
      for (const tpl of TEAM_TEMPLATES) {
        for (const agent of tpl.agents) {
          expect(validModels).toContain(agent.modelId);
        }
      }
    });

    it('all templates have required fields', () => {
      for (const tpl of TEAM_TEMPLATES) {
        expect(tpl.id).toBeTruthy();
        expect(tpl.name).toBeTruthy();
        expect(tpl.description).toBeTruthy();
        expect(tpl.color).toBeTruthy();
        expect(tpl.layout).toBeTruthy();
      }
    });

    it('all agent IDs are unique within each template', () => {
      for (const tpl of TEAM_TEMPLATES) {
        const ids = tpl.agents.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  describe('getTemplate', () => {
    it('returns a template by ID', () => {
      const tpl = getTemplate('feature-build');
      expect(tpl).toBeDefined();
      expect(tpl!.name).toBe('Feature Build');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('getAgentEnv', () => {
    it('returns both required env vars', () => {
      const env = getAgentEnv('test-task-list-123');
      expect(env[TEAM_ENV_KEYS.AGENT_TEAMS]).toBe('1');
      expect(env[TEAM_ENV_KEYS.TASK_LIST_ID]).toBe('test-task-list-123');
    });

    it('returns exactly 2 keys', () => {
      const env = getAgentEnv('id');
      expect(Object.keys(env).length).toBe(2);
    });
  });

  describe('generateTaskListId', () => {
    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTaskListId());
      }
      expect(ids.size).toBe(100);
    });

    it('starts with "team-" prefix', () => {
      const id = generateTaskListId();
      expect(id.startsWith('team-')).toBe(true);
    });
  });

  describe('estimateTeamCostPerHour', () => {
    it('returns positive cost for any template', () => {
      for (const tpl of TEAM_TEMPLATES) {
        const cost = estimateTeamCostPerHour(tpl.agents);
        expect(cost).toBeGreaterThan(0);
      }
    });

    it('opus agents cost more than haiku agents', () => {
      const opusAgent = TEAM_TEMPLATES[0].agents.find((a) => a.modelId === 'opus');
      const haikuAgent = TEAM_TEMPLATES.flatMap((t) => t.agents).find((a) => a.modelId === 'haiku');
      if (opusAgent && haikuAgent) {
        const opusCost = estimateTeamCostPerHour([opusAgent]);
        const haikuCost = estimateTeamCostPerHour([haikuAgent]);
        expect(opusCost).toBeGreaterThan(haikuCost);
      }
    });
  });
});
