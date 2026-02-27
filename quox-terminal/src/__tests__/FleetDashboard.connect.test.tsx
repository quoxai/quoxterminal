import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FleetDashboard from '../components/hosts/FleetDashboard';
import type { FleetAgent } from '../services/fleetService';

// Mock useFleetStatus to return test data
const mockAgents: FleetAgent[] = [
  {
    host_id: 'docker01',
    ip: '10.0.0.101',
    status: 'connected',
    cpu_percent: 25,
    memory_percent: 40,
    os: 'Ubuntu 22.04',
    uptime: 86400,
    last_seen: Date.now(),
    group: 'Docker',
  },
  {
    host_id: 'pve01',
    ip: '10.0.0.1',
    status: 'connected',
    last_seen: Date.now(),
    group: 'Proxmox',
  },
];

vi.mock('../hooks/useFleetStatus', () => ({
  useFleetStatus: () => ({
    agentList: mockAgents,
    connected: 2,
    stale: 0,
    dead: 0,
    total: 2,
  }),
}));

describe('FleetDashboard connect', () => {
  it('passes full FleetAgent on host click', () => {
    const onConnectHost = vi.fn();
    render(
      <FleetDashboard
        onClose={() => {}}
        onConnectHost={onConnectHost}
      />
    );

    // Click docker01
    fireEvent.click(screen.getByTitle('Connect to docker01'));

    // Should receive the full agent object, not just hostId
    expect(onConnectHost).toHaveBeenCalledOnce();
    const agent = onConnectHost.mock.calls[0][0];
    expect(agent).toHaveProperty('host_id', 'docker01');
    expect(agent).toHaveProperty('ip', '10.0.0.101');
    expect(agent).toHaveProperty('status', 'connected');
    expect(agent).toHaveProperty('group', 'Docker');
  });

  it('renders all agents grouped', () => {
    render(
      <FleetDashboard
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Proxmox')).toBeInTheDocument();
    expect(screen.getByText('docker01')).toBeInTheDocument();
    expect(screen.getByText('pve01')).toBeInTheDocument();
  });

  it('shows correct summary counts', () => {
    render(
      <FleetDashboard
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText('2')).toHaveLength(2); // Total + Online
    expect(screen.getAllByText('0')).toHaveLength(2);   // Stale + Dead
  });
});
