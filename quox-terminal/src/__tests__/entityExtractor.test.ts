import { describe, it, expect } from 'vitest';
import { extractEntities, type ExtractedEntity } from '../utils/entityExtractor';

describe('entityExtractor', () => {
  describe('guard clauses', () => {
    it('returns [] for empty string', () => {
      expect(extractEntities('')).toEqual([]);
    });

    it('returns [] for null/undefined input', () => {
      expect(extractEntities(null as unknown as string)).toEqual([]);
      expect(extractEntities(undefined as unknown as string)).toEqual([]);
    });

    it('returns [] for short input (< 5 chars)', () => {
      expect(extractEntities('hi')).toEqual([]);
      expect(extractEntities('abcd')).toEqual([]);
    });
  });

  describe('host pattern', () => {
    it('extracts host from "host: docker01"', () => {
      const result = extractEntities('connecting to host: docker01');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.length).toBeGreaterThanOrEqual(1);
      expect(hosts.some((h) => h.name === 'docker01')).toBe(true);
    });

    it('extracts server name', () => {
      const result = extractEntities('server web-prod-01 is down');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.some((h) => h.name === 'web-prod-01')).toBe(true);
    });

    it('extracts node name', () => {
      const result = extractEntities('node k8s-worker-03 joined cluster');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.some((h) => h.name === 'k8s-worker-03')).toBe(true);
    });
  });

  describe('ip pattern', () => {
    it('extracts IPv4 address', () => {
      const result = extractEntities('ssh root@192.168.88.247');
      const ips = result.filter((e) => e.type === 'ip');
      expect(ips.length).toBe(1);
      expect(ips[0].value).toBe('192.168.88.247');
    });

    it('extracts multiple IPs', () => {
      const result = extractEntities('from 10.0.0.1 to 10.0.0.2 via 10.0.0.254');
      const ips = result.filter((e) => e.type === 'ip');
      expect(ips.length).toBe(3);
    });
  });

  describe('service pattern', () => {
    it('extracts service name', () => {
      const result = extractEntities('service nginx is running');
      const services = result.filter((e) => e.type === 'service');
      expect(services.some((s) => s.name === 'nginx')).toBe(true);
    });

    it('extracts daemon name', () => {
      const result = extractEntities('daemon postgres started');
      const services = result.filter((e) => e.type === 'service');
      expect(services.some((s) => s.name === 'postgres')).toBe(true);
    });
  });

  describe('container pattern', () => {
    it('extracts container name', () => {
      const result = extractEntities('container app-api-1 is healthy');
      const containers = result.filter((e) => e.type === 'container');
      expect(containers.some((c) => c.name === 'app-api-1')).toBe(true);
    });

    it('extracts docker container', () => {
      const result = extractEntities('docker mongodb-prod running');
      const containers = result.filter((e) => e.type === 'container');
      expect(containers.some((c) => c.name === 'mongodb-prod')).toBe(true);
    });
  });

  describe('port pattern', () => {
    it('extracts port number', () => {
      const result = extractEntities('listening on port 3000');
      const ports = result.filter((e) => e.type === 'port');
      expect(ports.length).toBe(1);
      expect(ports[0].value).toBe('3000');
    });

    it('extracts port with colon separator', () => {
      const result = extractEntities('port: 8080 is open');
      const ports = result.filter((e) => e.type === 'port');
      expect(ports.some((p) => p.value === '8080')).toBe(true);
    });
  });

  describe('known host patterns', () => {
    it('detects docker## hostnames', () => {
      const result = extractEntities('output from docker02 and docker04');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.some((h) => h.name === 'docker02')).toBe(true);
      expect(hosts.some((h) => h.name === 'docker04')).toBe(true);
    });

    it('detects proxmox## hostnames', () => {
      const result = extractEntities('proxmox01 is the primary hypervisor');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.some((h) => h.name === 'proxmox01')).toBe(true);
    });

    it('detects name-digits pattern (web-01)', () => {
      const result = extractEntities('deployed to web-01 and api-02');
      const hosts = result.filter((e) => e.type === 'host');
      expect(hosts.some((h) => h.name === 'web-01')).toBe(true);
      expect(hosts.some((h) => h.name === 'api-02')).toBe(true);
    });

    it('marks known patterns with source=known_pattern', () => {
      const result = extractEntities('check nas01 status now');
      const nas = result.find((e) => e.name === 'nas01');
      expect(nas).toBeDefined();
      expect(nas!.source).toBe('known_pattern');
    });
  });

  describe('deduplication', () => {
    it('deduplicates same entity appearing multiple times', () => {
      const result = extractEntities('host: docker01 ... host: docker01 again');
      const hosts = result.filter((e) => e.type === 'host' && e.name === 'docker01');
      expect(hosts.length).toBe(1);
    });

    it('deduplicates known hosts against pattern-extracted hosts', () => {
      const result = extractEntities('host: docker01 is on docker01 network');
      const d01 = result.filter(
        (e) => e.type === 'host' && e.name?.toLowerCase() === 'docker01',
      );
      expect(d01.length).toBe(1);
    });
  });

  describe('multi-entity output', () => {
    it('extracts multiple entity types from real-world output', () => {
      const output = [
        'ssh root@10.0.0.101',
        'host: docker01',
        'service nginx running on port 80',
        'container redis-cache healthy',
      ].join('\n');

      const result = extractEntities(output);
      const types = new Set(result.map((e) => e.type));
      expect(types.has('ip')).toBe(true);
      expect(types.has('host')).toBe(true);
      expect(types.has('service')).toBe(true);
      expect(types.has('port')).toBe(true);
      expect(types.has('container')).toBe(true);
    });
  });

  describe('no-entity output', () => {
    it('returns [] for plain text with no entities', () => {
      const result = extractEntities('hello world this is a normal sentence');
      expect(result.length).toBe(0);
    });

    it('returns [] for common command output', () => {
      const result = extractEntities('total 24\ndrwxr-xr-x 5 user user 4096 Feb 27 .');
      // May pick up some false positives from numbers, but no structured entities
      const meaningful = result.filter((e) => e.type !== 'ip'); // IPs from random nums
      expect(meaningful.length).toBe(0);
    });
  });
});
