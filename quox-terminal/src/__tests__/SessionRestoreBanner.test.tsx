import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionRestoreBanner from '../components/terminal/SessionRestoreBanner';

const sshSessions = [
  { paneId: 'pane-0', mode: 'ssh', hostId: 'docker01', workspaceName: 'Workspace 1' },
  { paneId: 'pane-1', mode: 'ssh', hostId: 'pve01', workspaceName: 'Workspace 1' },
];

const localSessions = [
  { paneId: 'pane-2', mode: 'local', hostId: '', workspaceName: 'Workspace 2' },
];

describe('SessionRestoreBanner', () => {
  it('renders with SSH session summary', () => {
    render(
      <SessionRestoreBanner
        sessions={sshSessions}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 SSH sessions/)).toBeInTheDocument();
    expect(screen.getByText(/docker01/)).toBeInTheDocument();
    expect(screen.getByText(/pve01/)).toBeInTheDocument();
  });

  it('renders with local session summary', () => {
    render(
      <SessionRestoreBanner
        sessions={localSessions}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 local session/)).toBeInTheDocument();
  });

  it('renders with mixed sessions', () => {
    render(
      <SessionRestoreBanner
        sessions={[...sshSessions, ...localSessions]}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 SSH sessions.*and 1 local session/)).toBeInTheDocument();
  });

  it('shows Reconnect button when SSH sessions exist', () => {
    render(
      <SessionRestoreBanner
        sessions={sshSessions}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('hides Reconnect button when only local sessions', () => {
    render(
      <SessionRestoreBanner
        sessions={localSessions}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
  });

  it('calls onRestore when Reconnect clicked', () => {
    const onRestore = vi.fn();
    render(
      <SessionRestoreBanner
        sessions={sshSessions}
        onRestore={onRestore}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Reconnect'));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when Dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(
      <SessionRestoreBanner
        sessions={sshSessions}
        onRestore={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('deduplicates host names in summary', () => {
    const sessions = [
      { paneId: 'pane-0', mode: 'ssh', hostId: 'docker01', workspaceName: 'W1' },
      { paneId: 'pane-1', mode: 'ssh', hostId: 'docker01', workspaceName: 'W1' },
    ];
    render(
      <SessionRestoreBanner
        sessions={sessions}
        onRestore={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    // Should say "2 SSH sessions (docker01)" not "(docker01, docker01)"
    expect(screen.getByText(/2 SSH sessions \(docker01\)/)).toBeInTheDocument();
  });
});
