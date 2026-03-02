import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamLauncherModal from '../components/teams/TeamLauncherModal';
import { TEAM_TEMPLATES } from '../config/teamConfig';

// Mock store for onboarding check
vi.mock('../lib/store', () => ({
  storeGet: vi.fn().mockResolvedValue(true), // onboarding already seen
  storeSet: vi.fn().mockResolvedValue(undefined),
}));

describe('TeamLauncherModal', () => {
  const onClose = vi.fn();
  const onLaunch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not open', () => {
    const { container } = render(
      <TeamLauncherModal isOpen={false} onClose={onClose} onLaunch={onLaunch} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay when open', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    expect(screen.getByText('Agent Teams')).toBeInTheDocument();
    expect(screen.getByText('Experimental')).toBeInTheDocument();
  });

  it('renders all template cards', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    for (const tpl of TEAM_TEMPLATES) {
      expect(screen.getByText(tpl.name)).toBeInTheDocument();
    }
  });

  it('selecting a template shows the customization panel', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    // Click the first template
    fireEvent.click(screen.getByText(TEAM_TEMPLATES[0].name));

    // Customization panel should appear
    expect(screen.getByText('Team Configuration')).toBeInTheDocument();
    expect(screen.getByText('Project Directory')).toBeInTheDocument();
    expect(screen.getByText('Working On (sent to team lead)')).toBeInTheDocument();

    // Agent names should be listed
    for (const agent of TEAM_TEMPLATES[0].agents) {
      expect(screen.getByText(agent.name)).toBeInTheDocument();
    }
  });

  it('shows LEAD badge for team lead agents', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    fireEvent.click(screen.getByText(TEAM_TEMPLATES[0].name));
    expect(screen.getByText('LEAD')).toBeInTheDocument();
  });

  it('shows cost estimate in config panel', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    fireEvent.click(screen.getByText(TEAM_TEMPLATES[0].name));
    expect(screen.getByText('Estimated cost')).toBeInTheDocument();
    // Cost value element in the config panel
    const costEl = document.querySelector('.team-launcher__cost-value');
    expect(costEl).toBeTruthy();
    expect(costEl!.textContent).toMatch(/\$\d+\.\d+\/hr/);
  });

  it('launch button is disabled when no template selected', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    const launchBtn = screen.getByText('Launch Team');
    expect(launchBtn.closest('button')).toBeDisabled();
  });

  it('launch button fires onLaunch with template', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    fireEvent.click(screen.getByText(TEAM_TEMPLATES[0].name));
    fireEvent.click(screen.getByText('Launch Team'));
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEAM_TEMPLATES[0].id }),
      expect.any(String),
      expect.any(String),
    );
  });

  it('close button calls onClose', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    // The close button is the X button in the header
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find((b) =>
      b.classList.contains('team-launcher__close'),
    );
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows agent count on cards', () => {
    render(
      <TeamLauncherModal isOpen={true} onClose={onClose} onLaunch={onLaunch} />,
    );
    // Each card has agent dots and count text
    const cards = document.querySelectorAll('.team-launcher__card');
    expect(cards.length).toBe(TEAM_TEMPLATES.length);
    // Each card has agent dot elements
    cards.forEach((card, idx) => {
      const dots = card.querySelectorAll('.team-launcher__card-agent-dot');
      expect(dots.length).toBe(TEAM_TEMPLATES[idx].agents.length);
    });
  });
});
