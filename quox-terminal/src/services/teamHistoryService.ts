/**
 * teamHistoryService — Records and queries completed team sessions
 *
 * Wraps teamStorageService history functions with analytics helpers.
 */

import {
  loadTeamHistory,
  recordTeamCompletion,
  type TeamHistoryEntry,
} from './teamStorageService';
import type { TeamSession } from '../config/teamConfig';

/** Record a completed team session from the live session state. */
export async function recordSessionEnd(session: TeamSession): Promise<void> {
  const entry: TeamHistoryEntry = {
    id: session.id,
    templateId: session.templateId,
    templateName: session.templateName,
    startedAt: session.startedAt,
    endedAt: Date.now(),
    duration: Date.now() - session.startedAt,
    agentCount: session.agents.length,
  };
  await recordTeamCompletion(entry);
}

/** Get aggregate stats from team history. */
export async function getTeamStats(): Promise<{
  totalSessions: number;
  totalDuration: number;
  avgDuration: number;
  favoriteTemplate: string | null;
}> {
  const history = await loadTeamHistory();
  if (history.length === 0) {
    return { totalSessions: 0, totalDuration: 0, avgDuration: 0, favoriteTemplate: null };
  }

  const totalDuration = history.reduce((sum, e) => sum + e.duration, 0);

  // Find most-used template
  const templateCounts = new Map<string, number>();
  for (const entry of history) {
    templateCounts.set(entry.templateName, (templateCounts.get(entry.templateName) || 0) + 1);
  }
  let favoriteTemplate: string | null = null;
  let maxCount = 0;
  for (const [name, count] of templateCounts) {
    if (count > maxCount) {
      maxCount = count;
      favoriteTemplate = name;
    }
  }

  return {
    totalSessions: history.length,
    totalDuration,
    avgDuration: totalDuration / history.length,
    favoriteTemplate,
  };
}

export { loadTeamHistory, type TeamHistoryEntry };
