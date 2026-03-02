/**
 * agentDefinitionService — Generates .claude/agents/<role-id>.md files
 *
 * On team launch, creates agent definition files in the project directory
 * so Claude Code picks up role-specific instructions.
 */

import { invoke } from '@tauri-apps/api/core';
import type { AgentRole, TeamSession } from '../config/teamConfig';
import { CLAUDE_MODELS } from '../config/terminalModes';

/** Generate the markdown content for an agent definition file. */
export function generateAgentDefinition(
  role: AgentRole,
  teammates: AgentRole[],
  workingOn: string,
): string {
  const modelLabel = CLAUDE_MODELS.find((m) => m.id === role.modelId)?.label ?? role.modelId;
  const teammateList = teammates
    .filter((t) => t.id !== role.id)
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  const lines: string[] = [
    '---',
    `name: ${role.id}`,
    `description: ${role.description}`,
    `model: ${role.modelId}`,
    '---',
    '',
  ];

  if (role.isLead) {
    lines.push(`You are **${role.name}** (team lead), part of an agent team.`);
    lines.push('');
    lines.push('## Your Responsibilities');
    lines.push('1. Review the project and understand the codebase');
    lines.push('2. Break down the work into tasks using the shared task list');
    lines.push('3. Assign tasks to teammates based on their roles');
    lines.push('4. Review completed work and verify quality');
    lines.push('');
    if (workingOn) {
      lines.push(`## Current Task`);
      lines.push(workingOn);
      lines.push('');
    }
  } else {
    lines.push(`You are **${role.name}**, part of an agent team.`);
    lines.push('');
    lines.push('## Your Responsibilities');
    lines.push('1. Check the shared task list for available tasks');
    lines.push('2. Mark tasks as in_progress when you start working on them');
    lines.push('3. Mark tasks as completed when you finish');
    lines.push('4. If you are blocked, create a new task describing the blocker');
    lines.push('');
  }

  if (role.initialPrompt) {
    lines.push('## Role Instructions');
    lines.push(role.initialPrompt);
    lines.push('');
  }

  if (teammateList) {
    lines.push('## Your Teammates');
    lines.push(teammateList);
    lines.push('');
  }

  return lines.join('\n');
}

/** Write agent definition files to the project directory. */
export async function writeAgentDefinitions(
  session: TeamSession,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];
  const projectDir = session.projectDir.replace(/^~/, '');

  // Resolve home directory
  let homeDir: string;
  try {
    homeDir = await invoke<string>('get_home_dir');
  } catch {
    homeDir = '/home/user';
  }

  const resolvedDir = session.projectDir.startsWith('~')
    ? `${homeDir}${projectDir}`
    : session.projectDir;

  const agentsDir = `${resolvedDir}/.claude/agents`;

  for (const agent of session.agents) {
    const filePath = `${agentsDir}/${agent.role.id}.md`;

    // Check if file already exists — don't overwrite
    try {
      const exists = await invoke<string>('fs_read_file', { path: filePath });
      if (exists) {
        skipped.push(filePath);
        continue;
      }
    } catch {
      // File doesn't exist, proceed to create
    }

    const content = generateAgentDefinition(
      agent.role,
      session.agents.map((a) => a.role),
      session.workingOn,
    );

    try {
      // Ensure directory exists
      await invoke('fs_create_dir', { path: agentsDir, recursive: true }).catch(() => {});
      await invoke('fs_write_file', { path: filePath, content });
      written.push(filePath);
    } catch {
      skipped.push(filePath);
    }
  }

  return { written, skipped };
}

/** Generate the initial prompt to send to the lead agent's PTY stdin. */
export function generateLeadPrompt(session: TeamSession): string {
  const lead = session.agents.find((a) => a.role.isLead);
  if (!lead) return '';

  const teammates = session.agents
    .filter((a) => !a.role.isLead)
    .map((a) => a.role.name)
    .join(', ');

  const parts: string[] = [];

  if (session.workingOn) {
    parts.push(session.workingOn);
  }

  parts.push(`\nYour team: ${teammates}.`);
  parts.push('Create tasks in the shared task list for each teammate.');
  parts.push('The project directory is: ' + session.projectDir);

  return parts.join(' ');
}
