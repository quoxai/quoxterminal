import { describe, it, expect } from 'vitest';
import {
  validateForExec,
  extractCommands,
  looksLikeShellCommand,
} from '../services/terminalExecService';

describe('terminalExecService', () => {
  describe('validateForExec', () => {
    // RED — always blocked
    it('blocks rm -rf /', () => {
      const result = validateForExec('rm -rf /');
      expect(result.action).toBe('BLOCK');
      expect(result.allowed).toBe(false);
    });

    it('blocks rm -rf ~', () => {
      const result = validateForExec('rm -rf ~');
      expect(result.action).toBe('BLOCK');
    });

    it('blocks dd writes to disk', () => {
      const result = validateForExec('dd if=/dev/zero of=/dev/sda');
      expect(result.action).toBe('BLOCK');
    });

    it('blocks mkfs', () => {
      const result = validateForExec('mkfs.ext4 /dev/sda1');
      expect(result.action).toBe('BLOCK');
    });

    it('blocks fork bomb', () => {
      const result = validateForExec(':(){ :|:& };:');
      expect(result.action).toBe('BLOCK');
    });

    // RED with requiresAuth — maps to REQUIRE_OVERRIDE
    it('requires override for qm destroy', () => {
      const result = validateForExec('qm destroy 100');
      expect(result.action).toBe('REQUIRE_OVERRIDE');
    });

    it('requires override for iptables flush', () => {
      const result = validateForExec('iptables -F');
      expect(result.action).toBe('REQUIRE_OVERRIDE');
    });

    // ORANGE — requires approval
    it('requires approval for shutdown', () => {
      const result = validateForExec('shutdown -h now');
      expect(result.action).toBe('REQUIRE_APPROVAL');
    });

    it('requires approval for reboot', () => {
      const result = validateForExec('reboot');
      expect(result.action).toBe('REQUIRE_APPROVAL');
    });

    it('requires approval for chmod 777', () => {
      const result = validateForExec('chmod -R 777 /var/www');
      expect(result.action).toBe('REQUIRE_APPROVAL');
    });

    // AMBER — warning
    it('warns for systemctl stop', () => {
      const result = validateForExec('systemctl stop nginx');
      expect(result.action).toBe('WARN');
    });

    it('warns for docker rm', () => {
      const result = validateForExec('docker rm -f my-container');
      expect(result.action).toBe('WARN');
    });

    it('warns for apt remove', () => {
      const result = validateForExec('apt remove nginx');
      expect(result.action).toBe('WARN');
    });

    // Safe commands
    it('allows safe commands', () => {
      const result = validateForExec('ls -la');
      expect(result.action).toBe('ALLOW');
      expect(result.allowed).toBe(true);
    });

    it('allows docker ps', () => {
      const result = validateForExec('docker ps');
      expect(result.action).toBe('ALLOW');
    });

    it('allows git status', () => {
      const result = validateForExec('git status');
      expect(result.action).toBe('ALLOW');
    });

    // Mode interactions
    it('strict mode: warns become require approval', () => {
      const result = validateForExec('systemctl stop nginx', 'strict');
      expect(result.action).toBe('REQUIRE_APPROVAL');
    });

    it('audit mode: blocks run buttons', () => {
      const result = validateForExec('ls -la', 'audit');
      expect(result.showButton).toBe(false);
    });

    it('balanced mode: allows run buttons', () => {
      const result = validateForExec('ls -la', 'balanced');
      expect(result.showButton).toBe(true);
    });

    // Edge cases
    it('handles empty command', () => {
      const result = validateForExec('');
      expect(result.action).toBe('ALLOW');
    });

    it('handles whitespace command', () => {
      const result = validateForExec('   ');
      expect(result.action).toBe('ALLOW');
    });
  });

  describe('extractCommands', () => {
    it('extracts from bash fenced block', () => {
      const md = '```bash\nls -la\n```';
      const cmds = extractCommands(md);
      expect(cmds.length).toBe(1);
      expect(cmds[0].command).toBe('ls -la');
    });

    it('extracts from sh fenced block', () => {
      const md = '```sh\necho hello\n```';
      const cmds = extractCommands(md);
      expect(cmds.length).toBe(1);
    });

    it('strips $ prompts', () => {
      const md = '```bash\n$ ls -la\n$ pwd\n```';
      const cmds = extractCommands(md);
      expect(cmds.some((c) => c.command.includes('ls -la'))).toBe(true);
    });

    it('extracts multiple blocks', () => {
      const md = '```bash\nls\n```\ntext\n```sh\npwd\n```';
      const cmds = extractCommands(md);
      expect(cmds.length).toBe(2);
    });

    it('returns empty for no code blocks', () => {
      const cmds = extractCommands('just some text');
      expect(cmds).toEqual([]);
    });

    it('skips non-shell blocks', () => {
      const md = '```python\nprint("hello")\n```';
      const cmds = extractCommands(md);
      expect(cmds.length).toBe(0);
    });
  });

  describe('looksLikeShellCommand', () => {
    it('recognizes common commands', () => {
      expect(looksLikeShellCommand('docker ps')).toBe(true);
      expect(looksLikeShellCommand('git status')).toBe(true);
      expect(looksLikeShellCommand('npm install')).toBe(true);
      expect(looksLikeShellCommand('curl https://example.com')).toBe(true);
      expect(looksLikeShellCommand('sudo apt update')).toBe(true);
      expect(looksLikeShellCommand('ls -la')).toBe(true);
      expect(looksLikeShellCommand('ssh user@host')).toBe(true);
    });

    it('rejects non-commands', () => {
      expect(looksLikeShellCommand('hello world')).toBe(false);
      expect(looksLikeShellCommand('the quick brown fox')).toBe(false);
    });

    it('handles empty string', () => {
      expect(looksLikeShellCommand('')).toBe(false);
    });
  });
});
