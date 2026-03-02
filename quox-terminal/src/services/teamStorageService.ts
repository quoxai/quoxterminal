/**
 * teamStorageService — Save/load custom team templates
 *
 * Persists customized team presets to Tauri store alongside built-in templates.
 */

import { storeGet, storeSet } from '../lib/store';
import { TEAM_TEMPLATES, type TeamTemplate } from '../config/teamConfig';

const CUSTOM_TEAMS_KEY = 'quox-custom-teams';
const TEAM_HISTORY_KEY = 'quox-team-history';

// ── Custom Teams ─────────────────────────────────────────────────────────────

/** Load all custom team templates from store. */
export async function loadCustomTeams(): Promise<TeamTemplate[]> {
  try {
    const saved = await storeGet<TeamTemplate[]>(CUSTOM_TEAMS_KEY);
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Save a custom team template. */
export async function saveCustomTeam(template: TeamTemplate): Promise<void> {
  const existing = await loadCustomTeams();
  const idx = existing.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    existing[idx] = template;
  } else {
    existing.push(template);
  }
  await storeSet(CUSTOM_TEAMS_KEY, existing);
}

/** Delete a custom team template by ID. */
export async function deleteCustomTeam(templateId: string): Promise<void> {
  const existing = await loadCustomTeams();
  const filtered = existing.filter((t) => t.id !== templateId);
  await storeSet(CUSTOM_TEAMS_KEY, filtered);
}

/** Get all templates (built-in + custom). */
export async function getAllTemplates(): Promise<TeamTemplate[]> {
  const custom = await loadCustomTeams();
  return [...TEAM_TEMPLATES, ...custom];
}

/** Export a custom team template as JSON string. */
export function exportTeamAsJson(template: TeamTemplate): string {
  return JSON.stringify(template, null, 2);
}

/** Import a team template from JSON string. */
export function importTeamFromJson(json: string): TeamTemplate {
  const parsed = JSON.parse(json);
  // Validate required fields
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.agents)) {
    throw new Error('Invalid team template JSON');
  }
  // Ensure custom prefix to avoid collision with built-in IDs
  if (TEAM_TEMPLATES.some((t) => t.id === parsed.id)) {
    parsed.id = `custom-${parsed.id}-${Date.now()}`;
  }
  return parsed as TeamTemplate;
}

// ── Team History ─────────────────────────────────────────────────────────────

export interface TeamHistoryEntry {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  agentCount: number;
  taskCount?: number;
}

/** Load team history. */
export async function loadTeamHistory(): Promise<TeamHistoryEntry[]> {
  try {
    const saved = await storeGet<TeamHistoryEntry[]>(TEAM_HISTORY_KEY);
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Record a completed team session to history. */
export async function recordTeamCompletion(entry: TeamHistoryEntry): Promise<void> {
  const history = await loadTeamHistory();
  history.unshift(entry);
  // Keep last 50 entries
  if (history.length > 50) history.length = 50;
  await storeSet(TEAM_HISTORY_KEY, history);
}
