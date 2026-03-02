/**
 * useTeamSession — Manages Agent Teams session lifecycle
 *
 * Tracks the active team session, generates env vars for agents,
 * and coordinates team start/stop operations.
 */

import { useState, useCallback } from 'react';
import {
  type TeamTemplate,
  type TeamSession,
  type TeamAgentInstance,
  generateTaskListId,
  getAgentEnv,
} from '../config/teamConfig';

export default function useTeamSession() {
  const [teamSession, setTeamSession] = useState<TeamSession | null>(null);

  /** Start a new team session from a template. */
  const startTeam = useCallback(
    (
      template: TeamTemplate,
      workspaceId: string,
      projectDir: string,
      workingOn: string = '',
    ): TeamSession => {
      const taskListId = generateTaskListId();
      const session: TeamSession = {
        id: `ts-${Date.now().toString(36)}`,
        templateId: template.id,
        templateName: template.name,
        taskListId,
        workspaceId,
        agents: template.agents.map((role, i) => ({
          paneId: `pane-${i}`,
          role,
          sessionId: null,
          status: 'pending' as const,
        })),
        status: 'setting-up',
        startedAt: Date.now(),
        projectDir,
        workingOn,
      };
      setTeamSession(session);
      return session;
    },
    [],
  );

  /** Get the env vars for any agent in the current team. */
  const getTeamEnv = useCallback((): Record<string, string> | undefined => {
    if (!teamSession) return undefined;
    return getAgentEnv(teamSession.taskListId);
  }, [teamSession]);

  /** Update an agent's status by pane ID. */
  const updateAgentStatus = useCallback(
    (paneId: string, status: TeamAgentInstance['status'], sessionId?: string) => {
      setTeamSession((prev) => {
        if (!prev) return prev;
        const agents = prev.agents.map((a) =>
          a.paneId === paneId
            ? { ...a, status, sessionId: sessionId ?? a.sessionId }
            : a,
        );
        // Auto-transition team status based on agent states
        const allRunning = agents.every((a) => a.status === 'running' || a.status === 'idle');
        const allExited = agents.every((a) => a.status === 'exited');
        let teamStatus = prev.status;
        if (allRunning && prev.status === 'setting-up') teamStatus = 'running';
        if (allExited) teamStatus = 'completed';

        return { ...prev, agents, status: teamStatus };
      });
    },
    [],
  );

  /** Set overall team status. */
  const setTeamStatus = useCallback(
    (status: TeamSession['status']) => {
      setTeamSession((prev) => (prev ? { ...prev, status } : prev));
    },
    [],
  );

  /** Stop the team — marks session as completed. */
  const stopTeam = useCallback(() => {
    setTeamSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'completed',
        agents: prev.agents.map((a) => ({ ...a, status: 'exited' as const })),
      };
    });
  }, []);

  /** Clear the team session entirely. */
  const clearTeam = useCallback(() => {
    setTeamSession(null);
  }, []);

  /** Check if a pane is part of the active team. */
  const isTeamPane = useCallback(
    (paneId: string): boolean => {
      if (!teamSession) return false;
      return teamSession.agents.some((a) => a.paneId === paneId);
    },
    [teamSession],
  );

  return {
    teamSession,
    startTeam,
    getTeamEnv,
    updateAgentStatus,
    setTeamStatus,
    stopTeam,
    clearTeam,
    isTeamPane,
    isTeamActive: teamSession !== null && teamSession.status !== 'completed',
  };
}
