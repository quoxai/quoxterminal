import { describe, it, expect } from 'vitest';
import {
  generateAgentDefinition,
  generateLeadPrompt,
} from '../services/agentDefinitionService';
import { TEAM_TEMPLATES } from '../config/teamConfig';
import type { AgentRole, TeamSession } from '../config/teamConfig';

describe('agentDefinitionService', () => {
  const featureBuild = TEAM_TEMPLATES[0];
  const allRoles = featureBuild.agents;
  const leadRole = allRoles.find((a) => a.isLead)!;
  const builderRole = allRoles.find((a) => a.id === 'builder-a')!;

  describe('generateAgentDefinition', () => {
    it('generates YAML frontmatter with role metadata', () => {
      const content = generateAgentDefinition(leadRole, allRoles, '');
      expect(content).toContain('---');
      expect(content).toContain(`name: ${leadRole.id}`);
      expect(content).toContain(`model: ${leadRole.modelId}`);
    });

    it('includes "team lead" for lead agents', () => {
      const content = generateAgentDefinition(leadRole, allRoles, '');
      expect(content).toContain('team lead');
    });

    it('includes task list instructions for non-lead agents', () => {
      const content = generateAgentDefinition(builderRole, allRoles, '');
      expect(content).toContain('Check the shared task list');
      expect(content).toContain('Mark tasks as in_progress');
    });

    it('includes "Working On" text for lead when provided', () => {
      const content = generateAgentDefinition(leadRole, allRoles, 'Add OAuth support');
      expect(content).toContain('Add OAuth support');
    });

    it('lists teammates', () => {
      const content = generateAgentDefinition(leadRole, allRoles, '');
      // Should list other agents but not the lead itself
      expect(content).toContain('Builder A');
      expect(content).toContain('Builder B');
      expect(content).toContain('Tester');
    });

    it('does not list self as teammate', () => {
      const content = generateAgentDefinition(leadRole, allRoles, '');
      // The teammates section should not list the Architect
      const lines = content.split('\n');
      const teammatesSection = lines.slice(
        lines.findIndex((l) => l.includes('Your Teammates')),
      );
      const architectLine = teammatesSection.find((l) => l.includes('- Architect'));
      expect(architectLine).toBeUndefined();
    });

    it('includes initial prompt when present', () => {
      const content = generateAgentDefinition(leadRole, allRoles, '');
      if (leadRole.initialPrompt) {
        expect(content).toContain(leadRole.initialPrompt);
      }
    });
  });

  describe('generateLeadPrompt', () => {
    const makeSession = (): TeamSession => ({
      id: 'ts-test',
      templateId: featureBuild.id,
      templateName: featureBuild.name,
      taskListId: 'task-123',
      workspaceId: 'ws-0',
      agents: featureBuild.agents.map((role, i) => ({
        paneId: `pane-${i}`,
        role,
        sessionId: null,
        status: 'pending' as const,
      })),
      status: 'setting-up',
      startedAt: Date.now(),
      projectDir: '~/my-project',
      workingOn: 'Add user authentication',
    });

    it('includes the "working on" text', () => {
      const prompt = generateLeadPrompt(makeSession());
      expect(prompt).toContain('Add user authentication');
    });

    it('includes teammate names', () => {
      const prompt = generateLeadPrompt(makeSession());
      expect(prompt).toContain('Builder A');
      expect(prompt).toContain('Builder B');
      expect(prompt).toContain('Tester');
    });

    it('includes project directory', () => {
      const prompt = generateLeadPrompt(makeSession());
      expect(prompt).toContain('~/my-project');
    });

    it('returns empty string when no lead exists', () => {
      const session = makeSession();
      session.agents = session.agents.map((a) => ({
        ...a,
        role: { ...a.role, isLead: false },
      }));
      const prompt = generateLeadPrompt(session);
      expect(prompt).toBe('');
    });
  });
});
