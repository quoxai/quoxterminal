import { describe, it, expect } from 'vitest';
import {
  computeDiff,
  parseFileBlock,
  validateFilePath,
  getFilePolicy,
  type DiffResult,
  type FileBlock,
  type PathValidation,
  type FilePolicy,
} from '../services/terminalFileService';

describe('terminalFileService', () => {
  // ============================================================================
  // computeDiff tests
  // ============================================================================
  describe('computeDiff', () => {
    describe('identical content', () => {
      it('returns all context lines for identical strings', () => {
        const content = 'line 1\nline 2\nline 3';
        const result = computeDiff(content, content);

        expect(result.lines).toHaveLength(3);
        expect(result.lines.every((l) => l.type === 'context')).toBe(true);
        expect(result.stats).toEqual({ added: 0, removed: 0, context: 3 });
      });

      it('handles identical single-line content', () => {
        const result = computeDiff('hello', 'hello');

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'hello' });
        expect(result.stats).toEqual({ added: 0, removed: 0, context: 1 });
      });

      it('handles identical empty strings', () => {
        const result = computeDiff('', '');

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0]).toEqual({ type: 'context', content: '' });
        expect(result.stats).toEqual({ added: 0, removed: 0, context: 1 });
      });
    });

    describe('additions', () => {
      it('detects added lines at the end', () => {
        const original = 'line 1\nline 2';
        const modified = 'line 1\nline 2\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'context', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'added', content: 'line 3' });
        expect(result.stats).toEqual({ added: 1, removed: 0, context: 2 });
      });

      it('detects added lines at the beginning', () => {
        const original = 'line 2\nline 3';
        const modified = 'line 1\nline 2\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'added', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'context', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'context', content: 'line 3' });
        expect(result.stats).toEqual({ added: 1, removed: 0, context: 2 });
      });

      it('detects added lines in the middle', () => {
        const original = 'line 1\nline 3';
        const modified = 'line 1\nline 2\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'added', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'context', content: 'line 3' });
        expect(result.stats).toEqual({ added: 1, removed: 0, context: 2 });
      });

      it('handles adding content to empty original', () => {
        const result = computeDiff('', 'new content');

        expect(result.lines).toHaveLength(2);
        expect(result.lines[0]).toEqual({ type: 'removed', content: '' });
        expect(result.lines[1]).toEqual({ type: 'added', content: 'new content' });
        expect(result.stats).toEqual({ added: 1, removed: 1, context: 0 });
      });

      it('handles adding multiple lines to empty original', () => {
        const result = computeDiff('', 'line 1\nline 2\nline 3');

        expect(result.stats.added).toBe(3);
        expect(result.stats.removed).toBe(1); // empty string splits to ['']
      });
    });

    describe('removals', () => {
      it('detects removed lines at the end', () => {
        const original = 'line 1\nline 2\nline 3';
        const modified = 'line 1\nline 2';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'context', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'removed', content: 'line 3' });
        expect(result.stats).toEqual({ added: 0, removed: 1, context: 2 });
      });

      it('detects removed lines at the beginning', () => {
        const original = 'line 1\nline 2\nline 3';
        const modified = 'line 2\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'removed', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'context', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'context', content: 'line 3' });
        expect(result.stats).toEqual({ added: 0, removed: 1, context: 2 });
      });

      it('detects removed lines in the middle', () => {
        const original = 'line 1\nline 2\nline 3';
        const modified = 'line 1\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'removed', content: 'line 2' });
        expect(result.lines[2]).toEqual({ type: 'context', content: 'line 3' });
        expect(result.stats).toEqual({ added: 0, removed: 1, context: 2 });
      });

      it('handles removing all content', () => {
        const result = computeDiff('content', '');

        expect(result.lines).toHaveLength(2);
        expect(result.lines[0]).toEqual({ type: 'removed', content: 'content' });
        expect(result.lines[1]).toEqual({ type: 'added', content: '' });
        expect(result.stats).toEqual({ added: 1, removed: 1, context: 0 });
      });
    });

    describe('modifications', () => {
      it('detects modified lines as remove + add', () => {
        const original = 'line 1\nold line\nline 3';
        const modified = 'line 1\nnew line\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(4);
        expect(result.lines[0]).toEqual({ type: 'context', content: 'line 1' });
        expect(result.lines[1]).toEqual({ type: 'removed', content: 'old line' });
        expect(result.lines[2]).toEqual({ type: 'added', content: 'new line' });
        expect(result.lines[3]).toEqual({ type: 'context', content: 'line 3' });
        expect(result.stats).toEqual({ added: 1, removed: 1, context: 2 });
      });

      it('handles complete replacement of content', () => {
        const original = 'old 1\nold 2';
        const modified = 'new 1\nnew 2\nnew 3';
        const result = computeDiff(original, modified);

        expect(result.stats.removed).toBe(2);
        expect(result.stats.added).toBe(3);
        expect(result.stats.context).toBe(0);
      });
    });

    describe('complex diffs', () => {
      it('handles interleaved additions and removals', () => {
        const original = 'a\nb\nc\nd';
        const modified = 'a\nx\nc\ny';
        const result = computeDiff(original, modified);

        // a (context), b->x (remove/add), c (context), d->y (remove/add)
        expect(result.stats.context).toBe(2);
        expect(result.stats.added).toBe(2);
        expect(result.stats.removed).toBe(2);
      });

      it('handles reordering lines', () => {
        const original = 'a\nb\nc';
        const modified = 'c\nb\na';
        const result = computeDiff(original, modified);

        // LCS is 'b', so we expect context for b and changes for a,c
        const contextLines = result.lines.filter((l) => l.type === 'context');
        expect(contextLines.length).toBeGreaterThanOrEqual(1);
      });

      it('handles duplicate lines correctly', () => {
        const original = 'a\na\na';
        const modified = 'a\na';
        const result = computeDiff(original, modified);

        expect(result.stats.context).toBe(2);
        expect(result.stats.removed).toBe(1);
        expect(result.stats.added).toBe(0);
      });

      it('handles whitespace-only differences', () => {
        const original = 'line 1\n  indented\nline 3';
        const modified = 'line 1\n    indented\nline 3';
        const result = computeDiff(original, modified);

        expect(result.stats.context).toBe(2);
        expect(result.stats.removed).toBe(1);
        expect(result.stats.added).toBe(1);
      });

      it('handles empty lines in the middle', () => {
        const original = 'line 1\n\nline 3';
        const modified = 'line 1\n\nline 3';
        const result = computeDiff(original, modified);

        expect(result.lines).toHaveLength(3);
        expect(result.lines[1]).toEqual({ type: 'context', content: '' });
        expect(result.stats).toEqual({ added: 0, removed: 0, context: 3 });
      });
    });

    describe('edge cases', () => {
      it('handles very long identical lines', () => {
        const longLine = 'x'.repeat(10000);
        const result = computeDiff(longLine, longLine);

        expect(result.lines).toHaveLength(1);
        expect(result.stats).toEqual({ added: 0, removed: 0, context: 1 });
      });

      it('handles lines with special characters', () => {
        const original = 'line with "quotes"\nline with \\backslash';
        const modified = 'line with "quotes"\nline with /forward';
        const result = computeDiff(original, modified);

        expect(result.stats.context).toBe(1);
        expect(result.stats.removed).toBe(1);
        expect(result.stats.added).toBe(1);
      });

      it('handles unicode content', () => {
        const original = 'Hello 世界\n🚀 rocket';
        const modified = 'Hello 世界\n🎉 party';
        const result = computeDiff(original, modified);

        expect(result.lines[0]).toEqual({ type: 'context', content: 'Hello 世界' });
        expect(result.stats.context).toBe(1);
        expect(result.stats.removed).toBe(1);
        expect(result.stats.added).toBe(1);
      });

      it('returns correct structure for DiffResult', () => {
        const result = computeDiff('a', 'b');

        expect(result).toHaveProperty('lines');
        expect(result).toHaveProperty('stats');
        expect(Array.isArray(result.lines)).toBe(true);
        expect(result.stats).toHaveProperty('added');
        expect(result.stats).toHaveProperty('removed');
        expect(result.stats).toHaveProperty('context');
      });
    });
  });

  // ============================================================================
  // parseFileBlock tests
  // ============================================================================
  describe('parseFileBlock', () => {
    describe('valid file:create blocks', () => {
      it('parses a basic create block', () => {
        const result = parseFileBlock('file:create:/tmp/test.txt', 'hello world');

        expect(result).not.toBeNull();
        expect(result!.action).toBe('create');
        expect(result!.filePath).toBe('/tmp/test.txt');
        expect(result!.content).toBe('hello world');
        expect(result!.meta).toBeNull();
      });

      it('parses create block with multi-line content', () => {
        const result = parseFileBlock('file:create:/app/config.json', '{\n  "port": 3000\n}\n');

        expect(result).not.toBeNull();
        expect(result!.content).toBe('{\n  "port": 3000\n}');
      });

      it('parses create block with nested path', () => {
        const result = parseFileBlock('file:create:/home/user/project/src/index.ts', 'code');

        expect(result!.filePath).toBe('/home/user/project/src/index.ts');
      });
    });

    describe('valid file:edit blocks', () => {
      it('parses a basic edit block', () => {
        const result = parseFileBlock('file:edit:/etc/nginx.conf', 'server {}');

        expect(result).not.toBeNull();
        expect(result!.action).toBe('edit');
        expect(result!.filePath).toBe('/etc/nginx.conf');
        expect(result!.content).toBe('server {}');
      });
    });

    describe('valid file:delete blocks', () => {
      it('parses a delete block with reason', () => {
        const result = parseFileBlock('file:delete:/tmp/old.log', 'No longer needed');

        expect(result).not.toBeNull();
        expect(result!.action).toBe('delete');
        expect(result!.filePath).toBe('/tmp/old.log');
        expect(result!.content).toBe('No longer needed');
      });

      it('parses a delete block with empty content', () => {
        const result = parseFileBlock('file:delete:/tmp/file.txt', '\n');

        expect(result).not.toBeNull();
        expect(result!.action).toBe('delete');
        expect(result!.content).toBe('');
      });
    });

    describe('valid file:rename blocks', () => {
      it('parses a rename block with colon separator', () => {
        const result = parseFileBlock('file:rename:/old/path.txt:/new/path.txt', 'reason');

        expect(result).not.toBeNull();
        expect(result!.action).toBe('rename');
        expect(result!.filePath).toBe('/old/path.txt');
        expect(result!.targetPath).toBe('/new/path.txt');
      });

      it('parses rename with deeply nested paths', () => {
        const result = parseFileBlock(
          'file:rename:/home/user/old/file.ts:/home/user/new/file.ts',
          'reason\n'
        );

        expect(result!.filePath).toBe('/home/user/old/file.ts');
        expect(result!.targetPath).toBe('/home/user/new/file.ts');
      });
    });

    describe('meta parsing', () => {
      it('parses #quox-meta JSON on first line', () => {
        const content = '#quox-meta:{"language":"typescript","version":1}\nconst x = 1;';
        const result = parseFileBlock('file:create:/app/index.ts', content);

        expect(result).not.toBeNull();
        expect(result!.meta).toEqual({ language: 'typescript', version: 1 });
        expect(result!.content).toBe('const x = 1;');
      });

      it('handles invalid meta JSON gracefully', () => {
        const content = '#quox-meta:{invalid json}\nactual content';
        const result = parseFileBlock('file:create:/tmp/test.txt', content);

        expect(result).not.toBeNull();
        expect(result!.meta).toBeNull();
        expect(result!.content).toBe('#quox-meta:{invalid json}\nactual content');
      });

      it('handles empty meta object', () => {
        const content = '#quox-meta:{}\ncontent';
        const result = parseFileBlock('file:create:/tmp/test.txt', content);

        expect(result!.meta).toEqual({});
        expect(result!.content).toBe('content');
      });
    });

    describe('invalid inputs', () => {
      it('returns null for empty language', () => {
        expect(parseFileBlock('', 'content')).toBeNull();
      });

      it('returns null for empty code text', () => {
        expect(parseFileBlock('file:create:/tmp/test.txt', '')).toBeNull();
      });

      it('returns null for non-file language', () => {
        expect(parseFileBlock('typescript', 'const x = 1;')).toBeNull();
        expect(parseFileBlock('bash', 'echo hello')).toBeNull();
        expect(parseFileBlock('json', '{}')).toBeNull();
      });

      it('returns null for invalid file action', () => {
        expect(parseFileBlock('file:invalid:/tmp/test.txt', 'content')).toBeNull();
        expect(parseFileBlock('file:copy:/tmp/test.txt', 'content')).toBeNull();
      });

      it('returns null for relative paths', () => {
        expect(parseFileBlock('file:create:relative/path.txt', 'content')).toBeNull();
        expect(parseFileBlock('file:create:./relative/path.txt', 'content')).toBeNull();
      });

      it('returns null for rename without target path', () => {
        expect(parseFileBlock('file:rename:/only/one/path', 'content')).toBeNull();
      });

      it('returns null for rename with non-absolute target', () => {
        expect(parseFileBlock('file:rename:/old/path:relative/new', 'content')).toBeNull();
      });
    });

    describe('trailing newline handling', () => {
      it('strips trailing newline from content', () => {
        const result = parseFileBlock('file:create:/tmp/test.txt', 'content\n');

        expect(result!.content).toBe('content');
      });

      it('strips only one trailing newline', () => {
        const result = parseFileBlock('file:create:/tmp/test.txt', 'line1\nline2\n\n');

        expect(result!.content).toBe('line1\nline2\n');
      });
    });
  });

  // ============================================================================
  // validateFilePath tests
  // ============================================================================
  describe('validateFilePath', () => {
    describe('valid GREEN paths', () => {
      it('validates normal absolute paths as GREEN', () => {
        const result = validateFilePath('/home/user/project/file.txt');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
        expect(result.reason).toBeUndefined();
      });

      it('validates paths in /tmp as GREEN', () => {
        const result = validateFilePath('/tmp/test.txt');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });

      it('validates paths in /usr as GREEN', () => {
        const result = validateFilePath('/usr/local/bin/script');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });
    });

    describe('AMBER severity paths', () => {
      it('marks /etc paths as AMBER', () => {
        const result = validateFilePath('/etc/nginx/nginx.conf');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('AMBER');
        expect(result.reason).toContain('Sensitive');
      });

      it('marks /opt paths as AMBER', () => {
        const result = validateFilePath('/opt/app/config.json');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('AMBER');
      });

      it('marks /var paths as AMBER', () => {
        const result = validateFilePath('/var/log/app.log');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('AMBER');
      });
    });

    describe('RED severity paths', () => {
      it('marks /dev paths as RED', () => {
        const result = validateFilePath('/dev/null');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('RED');
        expect(result.reason).toContain('System');
      });

      it('marks /proc paths as RED', () => {
        const result = validateFilePath('/proc/1/status');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('RED');
      });

      it('marks /sys paths as RED', () => {
        const result = validateFilePath('/sys/class/net/eth0');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('RED');
      });

      it('marks /boot paths as RED', () => {
        const result = validateFilePath('/boot/vmlinuz');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('RED');
      });
    });

    describe('BLOCKED paths', () => {
      it('blocks empty paths', () => {
        const result = validateFilePath('');

        expect(result.valid).toBe(false);
        expect(result.severity).toBe('BLOCKED');
        expect(result.reason).toContain('Empty');
      });

      it('blocks null-like inputs', () => {
        expect(validateFilePath(null as unknown as string).valid).toBe(false);
        expect(validateFilePath(undefined as unknown as string).valid).toBe(false);
      });

      it('blocks non-string inputs', () => {
        expect(validateFilePath(123 as unknown as string).valid).toBe(false);
        expect(validateFilePath({} as unknown as string).valid).toBe(false);
      });

      it('blocks relative paths', () => {
        const result = validateFilePath('relative/path.txt');

        expect(result.valid).toBe(false);
        expect(result.severity).toBe('BLOCKED');
        expect(result.reason).toContain('absolute');
      });

      it('blocks paths with directory traversal', () => {
        const result = validateFilePath('/home/user/../../../etc/passwd');

        expect(result.valid).toBe(false);
        expect(result.severity).toBe('BLOCKED');
        expect(result.reason).toContain('blocked pattern');
      });

      it('blocks paths with null bytes', () => {
        const result = validateFilePath('/tmp/file\x00.txt');

        expect(result.valid).toBe(false);
        expect(result.severity).toBe('BLOCKED');
      });
    });

    describe('edge cases', () => {
      it('handles root path', () => {
        const result = validateFilePath('/');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });

      it('handles paths with spaces', () => {
        const result = validateFilePath('/home/user/my documents/file.txt');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });

      it('handles paths with special characters', () => {
        const result = validateFilePath('/home/user/file-name_v2.0.txt');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });

      it('handles unicode in paths', () => {
        const result = validateFilePath('/home/用户/文件.txt');

        expect(result.valid).toBe(true);
        expect(result.severity).toBe('GREEN');
      });
    });
  });

  // ============================================================================
  // getFilePolicy tests
  // ============================================================================
  describe('getFilePolicy', () => {
    describe('known modes', () => {
      it('returns strict policy for strict mode', () => {
        const policy = getFilePolicy('strict');

        expect(policy.showApplyButtons).toBe(true);
        expect(policy.requireConfirmModal).toBe(true);
      });

      it('returns balanced policy for balanced mode', () => {
        const policy = getFilePolicy('balanced');

        expect(policy.showApplyButtons).toBe(true);
        expect(policy.requireConfirmModal).toBe(false);
      });

      it('returns builder policy for builder mode', () => {
        const policy = getFilePolicy('builder');

        expect(policy.showApplyButtons).toBe(true);
        expect(policy.requireConfirmModal).toBe(false);
      });

      it('returns audit policy for audit mode', () => {
        const policy = getFilePolicy('audit');

        expect(policy.showApplyButtons).toBe(false);
        expect(policy.requireConfirmModal).toBe(false);
      });
    });

    describe('unknown modes', () => {
      it('defaults to balanced for unknown mode', () => {
        const policy = getFilePolicy('unknown');

        expect(policy.showApplyButtons).toBe(true);
        expect(policy.requireConfirmModal).toBe(false);
      });

      it('defaults to balanced for empty string', () => {
        const policy = getFilePolicy('');

        expect(policy.showApplyButtons).toBe(true);
        expect(policy.requireConfirmModal).toBe(false);
      });
    });

    describe('return type', () => {
      it('returns a valid FilePolicy object', () => {
        const policy = getFilePolicy('strict');

        expect(policy).toHaveProperty('showApplyButtons');
        expect(policy).toHaveProperty('requireConfirmModal');
        expect(typeof policy.showApplyButtons).toBe('boolean');
        expect(typeof policy.requireConfirmModal).toBe('boolean');
      });
    });
  });
});
