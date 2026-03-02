/**
 * teamConfig.ts — Agent Teams configuration
 *
 * Types, templates, and env generation for Claude Code Agent Teams mode.
 * Teams overlay existing claude panes with extra env vars and role metadata.
 */

import type { LayoutPreset } from '../hooks/useTerminalWorkspace';
import type { ModeId, ModelId } from './terminalModes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  color: string;
  modeId: ModeId;
  modelId: ModelId;
  isLead: boolean;
  initialPrompt?: string;
}

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  layout: LayoutPreset;
  agents: AgentRole[];
}

export interface TeamSession {
  id: string;
  templateId: string;
  templateName: string;
  taskListId: string;
  workspaceId: string;
  agents: TeamAgentInstance[];
  status: 'setting-up' | 'running' | 'paused' | 'completed';
  startedAt: number;
  projectDir: string;
  workingOn: string;
}

export interface TeamAgentInstance {
  paneId: string;
  role: AgentRole;
  sessionId: string | null;
  status: 'pending' | 'spawning' | 'running' | 'idle' | 'exited';
}

// ── Constants ────────────────────────────────────────────────────────────────

export const TEAM_ENV_KEYS = {
  AGENT_TEAMS: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  TASK_LIST_ID: 'CLAUDE_CODE_TASK_LIST_ID',
} as const;

// ── Env generation ───────────────────────────────────────────────────────────

let taskListCounter = 0;

/** Generate a unique task list ID for a team session. */
export function generateTaskListId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  taskListCounter++;
  return `team-${ts}-${rand}-${taskListCounter}`;
}

/** Build the env vars needed for an agent in a team. */
export function getAgentEnv(taskListId: string): Record<string, string> {
  return {
    [TEAM_ENV_KEYS.AGENT_TEAMS]: '1',
    [TEAM_ENV_KEYS.TASK_LIST_ID]: taskListId,
  };
}

// ── Built-in team templates ──────────────────────────────────────────────────

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'feature-build',
    name: 'Feature Build',
    description: 'Full-stack feature development with architect, builders, and tester',
    icon: 'hammer',
    color: '#38bdf8',
    layout: 'quad',
    agents: [
      {
        id: 'architect',
        name: 'Architect',
        description: 'Plans architecture, creates tasks, reviews PRs',
        color: '#a855f7',
        modeId: 'balanced',
        modelId: 'opus',
        isLead: true,
        initialPrompt: 'You are the team lead. Review the project, break down the work into tasks, and coordinate the team.',
      },
      {
        id: 'builder-a',
        name: 'Builder A',
        description: 'Implements frontend/UI changes',
        color: '#38bdf8',
        modeId: 'builder',
        modelId: 'sonnet',
        isLead: false,
      },
      {
        id: 'builder-b',
        name: 'Builder B',
        description: 'Implements backend/logic changes',
        color: '#22c55e',
        modeId: 'builder',
        modelId: 'sonnet',
        isLead: false,
      },
      {
        id: 'tester',
        name: 'Tester',
        description: 'Writes and runs tests, validates builds',
        color: '#f59e0b',
        modeId: 'balanced',
        modelId: 'sonnet',
        isLead: false,
      },
    ],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Security audit, quality review, and documentation check',
    icon: 'shield',
    color: '#ef4444',
    layout: 'main-side',
    agents: [
      {
        id: 'security-auditor',
        name: 'Security Auditor',
        description: 'Scans for vulnerabilities, secrets, OWASP issues',
        color: '#ef4444',
        modeId: 'audit',
        modelId: 'opus',
        isLead: true,
        initialPrompt: 'You are leading a security review. Audit the codebase for vulnerabilities, hardcoded secrets, and OWASP top 10 issues.',
      },
      {
        id: 'quality-reviewer',
        name: 'Quality Reviewer',
        description: 'Reviews code quality, patterns, and test coverage',
        color: '#38bdf8',
        modeId: 'audit',
        modelId: 'sonnet',
        isLead: false,
      },
      {
        id: 'docs-writer',
        name: 'Docs Writer',
        description: 'Reviews and updates documentation',
        color: '#22c55e',
        modeId: 'balanced',
        modelId: 'haiku',
        isLead: false,
      },
    ],
  },
  {
    id: 'bug-hunt',
    name: 'Bug Hunt',
    description: 'Investigate and fix bugs with researcher and fixer pair',
    icon: 'bug',
    color: '#f59e0b',
    layout: 'split-h',
    agents: [
      {
        id: 'researcher',
        name: 'Researcher',
        description: 'Investigates root cause, traces code paths',
        color: '#f59e0b',
        modeId: 'audit',
        modelId: 'opus',
        isLead: true,
        initialPrompt: 'You are the lead researcher. Investigate the bug, trace code paths, and create fix tasks for the Fixer.',
      },
      {
        id: 'fixer',
        name: 'Fixer',
        description: 'Implements fixes and verifies them',
        color: '#22c55e',
        modeId: 'builder',
        modelId: 'sonnet',
        isLead: false,
      },
    ],
  },
  {
    id: 'refactor-sprint',
    name: 'Refactor Sprint',
    description: 'Planned refactoring with parallel workers and reviewer',
    icon: 'refresh',
    color: '#a855f7',
    layout: 'quad',
    agents: [
      {
        id: 'planner',
        name: 'Planner',
        description: 'Plans refactoring strategy and creates tasks',
        color: '#a855f7',
        modeId: 'balanced',
        modelId: 'opus',
        isLead: true,
        initialPrompt: 'You are the refactoring lead. Analyze the code, plan the refactoring strategy, and create tasks for the team.',
      },
      {
        id: 'refactorer-a',
        name: 'Refactorer A',
        description: 'Executes refactoring changes',
        color: '#38bdf8',
        modeId: 'builder',
        modelId: 'sonnet',
        isLead: false,
      },
      {
        id: 'refactorer-b',
        name: 'Refactorer B',
        description: 'Executes refactoring changes',
        color: '#22c55e',
        modeId: 'builder',
        modelId: 'sonnet',
        isLead: false,
      },
      {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Reviews changes and runs tests',
        color: '#f59e0b',
        modeId: 'balanced',
        modelId: 'sonnet',
        isLead: false,
      },
    ],
  },
];

/** Get a template by ID. */
export function getTemplate(id: string): TeamTemplate | undefined {
  return TEAM_TEMPLATES.find((t) => t.id === id);
}

// ── Team settings defaults ───────────────────────────────────────────────────

export const TEAM_DEFAULTS = {
  /** Default model for team leads */
  defaultLeadModel: 'opus' as ModelId,
  /** Cost warning threshold ($/hr) — show warning if team cost exceeds this */
  costWarningThreshold: 10,
  /** Auto-pause after N minutes of inactivity (0 = disabled) */
  autoPauseMinutes: 0,
  /** Lead prompt delay (ms) — wait after spawn before writing initial prompt */
  leadPromptDelayMs: 2000,
} as const;

// ── Cost estimation ──────────────────────────────────────────────────────────

const HOURLY_RATES: Record<ModelId, number> = {
  opus: 3.60,
  sonnet: 0.72,
  haiku: 0.19,
};

/** Estimate hourly cost for a team template based on agent models. */
export function estimateTeamCostPerHour(agents: AgentRole[]): number {
  return agents.reduce((sum, a) => sum + (HOURLY_RATES[a.modelId] || 0), 0);
}
