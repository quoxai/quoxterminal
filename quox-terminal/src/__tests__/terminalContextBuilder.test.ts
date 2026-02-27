import { describe, it, expect } from 'vitest';
import { stripAnsi } from '../services/terminalContextBuilder';

describe('terminalContextBuilder', () => {
  describe('stripAnsi', () => {
    it('returns empty string for empty input', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('passes through clean text', () => {
      expect(stripAnsi('hello world')).toBe('hello world');
    });

    it('strips SGR color codes', () => {
      expect(stripAnsi('\x1B[32mgreen\x1B[0m')).toBe('green');
    });

    it('strips bold/underline', () => {
      expect(stripAnsi('\x1B[1mbold\x1B[22m')).toBe('bold');
    });

    it('strips multi-param SGR', () => {
      expect(stripAnsi('\x1B[1;31;42mcolored\x1B[0m')).toBe('colored');
    });

    it('strips CSI cursor movement', () => {
      expect(stripAnsi('\x1B[2Ahello')).toBe('hello');
    });

    it('strips bracketed paste mode', () => {
      expect(stripAnsi('\x1B[?2004hhello\x1B[?2004l')).toBe('hello');
    });

    it('strips OSC window title', () => {
      expect(stripAnsi('\x1B]0;my title\x07hello')).toBe('hello');
    });

    it('strips character set sequences', () => {
      expect(stripAnsi('\x1B(Bhello')).toBe('hello');
    });

    it('strips keypad mode sequences', () => {
      expect(stripAnsi('\x1B>hello\x1B=')).toBe('hello');
    });

    it('simulates backspace', () => {
      expect(stripAnsi('ab\x08c')).toBe('ac');
    });

    it('handles multiple backspaces', () => {
      expect(stripAnsi('abc\x08\x08d')).toBe('ad');
    });

    it('handles backspace at start', () => {
      const result = stripAnsi('\x08hello');
      expect(result).toBe('hello');
    });

    it('strips control characters but preserves newlines and tabs', () => {
      expect(stripAnsi('hello\nworld\ttab')).toBe('hello\nworld\ttab');
    });

    it('strips mixed sequences', () => {
      const input = '\x1B[32m$ \x1B[0mls -la\r\n\x1B[1mtotal 24\x1B[0m';
      const result = stripAnsi(input);
      expect(result).toContain('ls -la');
      expect(result).toContain('total 24');
      expect(result).not.toContain('\x1B');
    });
  });
});
