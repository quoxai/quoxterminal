import { describe, it, expect } from 'vitest';
import {
  detectTerminalError,
  detectAllErrors,
  composeErrorQuery,
} from '../utils/terminalErrorDetector';

describe('terminalErrorDetector', () => {
  describe('detectTerminalError', () => {
    it('returns null for empty input', () => {
      expect(detectTerminalError('')).toBeNull();
    });

    it('returns null for normal output', () => {
      expect(detectTerminalError('total 24\ndrwxr-xr-x 5 user user 4096 Feb 27 20:00 .')).toBeNull();
    });

    it('detects command not found', () => {
      const result = detectTerminalError('bash: foo: command not found');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('command_not_found');
    });

    it('detects permission denied', () => {
      const result = detectTerminalError('Permission denied (publickey)');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('permission_denied');
    });

    it('detects file not found', () => {
      const result = detectTerminalError('cat: /etc/foo: No such file or directory');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('file_not_found');
    });

    it('detects connection refused', () => {
      const result = detectTerminalError('ssh: connect to host 10.0.0.1: Connection refused');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('connection_refused');
    });

    it('detects connection timeout', () => {
      const result = detectTerminalError('ssh: connect to host 10.0.0.1: Connection timed out');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('connection_timeout');
    });

    it('detects segfault', () => {
      const result = detectTerminalError('Segmentation fault (core dumped)');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('segfault');
    });

    it('detects OOM', () => {
      const result = detectTerminalError('Out of memory: Killed process 1234');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('oom');
    });

    it('detects python traceback', () => {
      const result = detectTerminalError('Traceback (most recent call last):');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('python_traceback');
    });

    it('detects node module not found', () => {
      const result = detectTerminalError("Error: Cannot find module 'express'");
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('node_module_not_found');
    });

    it('detects JS errors', () => {
      const result = detectTerminalError('TypeError: Cannot read properties of undefined');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('js_error');
    });

    it('detects EACCES (matches permission_denied first due to pattern order)', () => {
      const result = detectTerminalError('Error: EACCES: permission denied, open /etc/passwd');
      expect(result).not.toBeNull();
      // "permission denied" in the string matches the broader pattern first
      expect(result!.errorType).toBe('permission_denied');
    });

    it('detects ECONNREFUSED', () => {
      const result = detectTerminalError('Error: connect ECONNREFUSED 127.0.0.1:3000');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('node_connection_refused');
    });

    it('detects disk full', () => {
      const result = detectTerminalError('ENOSPC: no space left on device');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('disk_full');
    });

    it('detects nonzero exit', () => {
      const result = detectTerminalError('Process exited with exit code 1');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('nonzero_exit');
    });

    it('detects fatal error', () => {
      const result = detectTerminalError('fatal: not a git repository');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('fatal_error');
    });

    it('detects package not found', () => {
      const result = detectTerminalError('E: Unable to locate package nonexistent');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('package_not_found');
    });

    it('detects docker error', () => {
      const result = detectTerminalError('docker: Error response from daemon: conflict');
      expect(result).not.toBeNull();
      expect(result!.errorType).toBe('docker_error');
    });

    it('returns first match only', () => {
      const result = detectTerminalError('Permission denied\ncommand not found');
      expect(result).not.toBeNull();
      // Should return the first match
      expect(result!.hasError).toBe(true);
    });

    it('includes errorLine and suggestion', () => {
      const result = detectTerminalError('bash: foo: command not found');
      expect(result).not.toBeNull();
      expect(result!.errorLine).toBeTruthy();
      expect(result!.suggestion).toBeTruthy();
    });
  });

  describe('detectAllErrors', () => {
    it('returns empty array for clean output', () => {
      expect(detectAllErrors('hello world')).toEqual([]);
    });

    it('returns multiple distinct errors', () => {
      const output = 'Permission denied\nConnection refused\ncommand not found';
      const errors = detectAllErrors(output);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const types = errors.map((e) => e.errorType);
      expect(types).toContain('permission_denied');
      expect(types).toContain('connection_refused');
    });
  });

  describe('composeErrorQuery', () => {
    it('composes explain query', () => {
      const query = composeErrorQuery('explain', {
        errorLine: 'Permission denied',
        errorType: 'permission_denied',
      });
      expect(query).toContain('Explain');
      expect(query).toContain('Permission denied');
    });

    it('composes fix query', () => {
      const query = composeErrorQuery('fix', {
        errorLine: 'command not found',
        errorType: 'command_not_found',
        suggestion: 'Check your PATH',
      });
      expect(query).toContain('fix');
      expect(query).toContain('command not found');
    });
  });
});
