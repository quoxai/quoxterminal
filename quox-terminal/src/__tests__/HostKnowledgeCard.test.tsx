import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HostKnowledgeCard from '../components/terminal/HostKnowledgeCard';
import type { SessionInfo } from '../services/terminalMemoryBridge';

describe('HostKnowledgeCard', () => {
  const baseSessions: SessionInfo[] = [
    {
      sessionId: 's1',
      hostId: 'root@docker01',
      mode: 'ssh',
      status: 'disconnected',
      connectedAt: new Date(Date.now() - 86400000).toISOString(),
      disconnectedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      sessionId: 's2',
      hostId: 'root@docker01',
      mode: 'ssh',
      status: 'disconnected',
      connectedAt: new Date(Date.now() - 172800000).toISOString(),
      disconnectedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      sessionId: 's3',
      hostId: 'root@pve01',
      mode: 'ssh',
      status: 'active',
      connectedAt: new Date().toISOString(),
    },
  ];

  it('renders session count for matching host', () => {
    render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={baseSessions}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('sessions')).toBeInTheDocument();
  });

  it('shows "Known host" header', () => {
    render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={baseSessions}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('Known host')).toBeInTheDocument();
  });

  it('renders nothing for unknown host', () => {
    const { container } = render(
      <HostKnowledgeCard
        hostId="unknown-host"
        sessions={baseSessions}
        onDismiss={() => {}}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no sessions', () => {
    const { container } = render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={[]}
        onDismiss={() => {}}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows last error when provided', () => {
    render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={baseSessions}
        lastError={{
          errorType: 'permission_denied',
          errorLine: 'Permission denied (publickey)',
        }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('permission_denied')).toBeInTheDocument();
    expect(screen.getByText('Permission denied (publickey)')).toBeInTheDocument();
  });

  it('dismisses on close click', () => {
    const onDismiss = vi.fn();
    render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={baseSessions}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByTitle('Dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();

    // After dismiss, card should not render
    expect(screen.queryByText('Known host')).not.toBeInTheDocument();
  });

  it('shows last visit time', () => {
    render(
      <HostKnowledgeCard
        hostId="docker01"
        sessions={baseSessions}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('last visit')).toBeInTheDocument();
  });
});
