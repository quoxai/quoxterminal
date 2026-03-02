/**
 * TeamLauncherModal — Agent Teams launcher overlay
 *
 * Template gallery → customization panel → launch button.
 * Follows the QuoxSettings full-screen overlay pattern.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  TEAM_TEMPLATES,
  estimateTeamCostPerHour,
  type TeamTemplate,
  type AgentRole,
} from '../../config/teamConfig';
import { CLAUDE_MODELS, type ModelId } from '../../config/terminalModes';
import { storeGet, storeSet } from '../../lib/store';
import './TeamLauncherModal.css';

const ONBOARDING_KEY = 'quox-teams-onboarding-seen';

interface TeamLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (template: TeamTemplate, projectDir: string, workingOn: string) => void;
}

export default function TeamLauncherModal({
  isOpen,
  onClose,
  onLaunch,
}: TeamLauncherModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customAgents, setCustomAgents] = useState<AgentRole[] | null>(null);
  const [projectDir, setProjectDir] = useState('~');
  const [workingOn, setWorkingOn] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding state on mount
  useEffect(() => {
    if (isOpen) {
      storeGet<boolean>(ONBOARDING_KEY).then((seen) => {
        if (!seen) setShowOnboarding(true);
      });
    }
  }, [isOpen]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    storeSet(ONBOARDING_KEY, true).catch(() => {});
  }, []);

  const selectedTemplate = TEAM_TEMPLATES.find((t) => t.id === selectedId) ?? null;
  const displayAgents = customAgents ?? selectedTemplate?.agents ?? [];
  const costPerHour = displayAgents.length > 0 ? estimateTeamCostPerHour(displayAgents) : 0;

  const handleSelect = useCallback((tpl: TeamTemplate) => {
    setSelectedId(tpl.id);
    setCustomAgents([...tpl.agents]);
  }, []);

  const handleModelChange = useCallback(
    (agentIdx: number, newModel: ModelId) => {
      setCustomAgents((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[agentIdx] = { ...next[agentIdx], modelId: newModel };
        return next;
      });
    },
    [],
  );

  const cycleModel = useCallback(
    (agentIdx: number) => {
      const current = displayAgents[agentIdx]?.modelId;
      const modelIds = CLAUDE_MODELS.map((m) => m.id);
      const idx = modelIds.indexOf(current);
      const next = modelIds[(idx + 1) % modelIds.length];
      handleModelChange(agentIdx, next);
    },
    [displayAgents, handleModelChange],
  );

  const handleLaunch = useCallback(() => {
    if (!selectedTemplate) return;
    const finalTemplate: TeamTemplate = customAgents
      ? { ...selectedTemplate, agents: customAgents }
      : selectedTemplate;
    onLaunch(finalTemplate, projectDir, workingOn);
  }, [selectedTemplate, customAgents, projectDir, workingOn, onLaunch]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="team-launcher-overlay" onClick={onClose}>
      <div className="team-launcher" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="team-launcher__header">
          <div className="team-launcher__title">
            <svg
              className="team-launcher__title-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Agent Teams
            <span className="team-launcher__badge">Experimental</span>
          </div>
          <button className="team-launcher__close" onClick={onClose}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="team-launcher__body">
          {/* Onboarding */}
          {showOnboarding && (
            <div className="team-launcher__onboarding">
              <div className="team-launcher__onboarding-text">
                Agent Teams spawns multiple Claude Code instances that share a task list
                and work together. Each agent runs in its own terminal pane with a
                specific role and model. The team lead creates tasks, teammates pick
                them up.
              </div>
              <button
                className="team-launcher__onboarding-dismiss"
                onClick={dismissOnboarding}
              >
                Got it
              </button>
            </div>
          )}

          {/* Template Gallery */}
          <div className="team-launcher__gallery">
            {TEAM_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className={`team-launcher__card${selectedId === tpl.id ? ' team-launcher__card--selected' : ''}`}
                style={
                  selectedId === tpl.id
                    ? { borderColor: tpl.color }
                    : undefined
                }
                onClick={() => handleSelect(tpl)}
              >
                <div className="team-launcher__card-header">
                  <span
                    className="team-launcher__card-dot"
                    style={{ background: tpl.color }}
                  />
                  <span className="team-launcher__card-name">{tpl.name}</span>
                </div>
                <div className="team-launcher__card-desc">{tpl.description}</div>
                <div className="team-launcher__card-meta">
                  <div className="team-launcher__card-agents">
                    {tpl.agents.map((a) => (
                      <span
                        key={a.id}
                        className="team-launcher__card-agent-dot"
                        style={{ background: a.color }}
                        title={a.name}
                      />
                    ))}
                  </div>
                  <span>{tpl.agents.length} agents</span>
                  <span>~${estimateTeamCostPerHour(tpl.agents).toFixed(2)}/hr</span>
                </div>
              </div>
            ))}
          </div>

          {/* Customization Panel — shown when template selected */}
          {selectedTemplate && (
            <div className="team-launcher__config">
              <div className="team-launcher__config-title">Team Configuration</div>

              {/* Agent list */}
              <div className="team-launcher__agent-list">
                {displayAgents.map((agent, idx) => (
                  <div key={agent.id} className="team-launcher__agent-row">
                    <span
                      className="team-launcher__agent-dot"
                      style={{ background: agent.color }}
                    />
                    <div className="team-launcher__agent-info">
                      <div className="team-launcher__agent-name">{agent.name}</div>
                      <div className="team-launcher__agent-desc">
                        {agent.description}
                      </div>
                    </div>
                    {agent.isLead && (
                      <span className="team-launcher__agent-lead-badge">LEAD</span>
                    )}
                    <button
                      className="team-launcher__agent-model"
                      onClick={() => cycleModel(idx)}
                      title="Click to cycle model"
                      style={{
                        borderColor: CLAUDE_MODELS.find((m) => m.id === agent.modelId)
                          ?.color,
                      }}
                    >
                      {CLAUDE_MODELS.find((m) => m.id === agent.modelId)?.label ??
                        agent.modelId}
                    </button>
                  </div>
                ))}
              </div>

              {/* Project directory */}
              <div className="team-launcher__field">
                <label className="team-launcher__field-label">Project Directory</label>
                <input
                  className="team-launcher__input"
                  value={projectDir}
                  onChange={(e) => setProjectDir(e.target.value)}
                  placeholder="~/projects/my-app"
                />
              </div>

              {/* Working on */}
              <div className="team-launcher__field">
                <label className="team-launcher__field-label">
                  Working On (sent to team lead)
                </label>
                <input
                  className="team-launcher__input"
                  value={workingOn}
                  onChange={(e) => setWorkingOn(e.target.value)}
                  placeholder="Add user authentication with OAuth"
                />
              </div>

              {/* Cost estimate */}
              <div className="team-launcher__cost">
                <span className="team-launcher__cost-label">
                  Estimated cost
                </span>
                <span className="team-launcher__cost-value">
                  ~${costPerHour.toFixed(2)}/hr
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="team-launcher__footer">
          <span className="team-launcher__footer-hint">
            {selectedTemplate
              ? `${selectedTemplate.layout} layout · ${displayAgents.length} agents`
              : 'Select a team template'}
          </span>
          <button
            className="team-launcher__launch-btn"
            disabled={!selectedTemplate}
            onClick={handleLaunch}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Launch Team
          </button>
        </div>
      </div>
    </div>
  );
}
