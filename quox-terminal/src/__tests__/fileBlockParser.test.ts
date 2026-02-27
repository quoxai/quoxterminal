import { describe, it, expect } from 'vitest';
import { parseFileBlocks, hasFileBlocks, type FileSegment } from '../utils/fileBlockParser';

describe('fileBlockParser', () => {
  describe('hasFileBlocks', () => {
    it('returns true when file fences are present', () => {
      expect(hasFileBlocks('```file:create:/tmp/test.txt\nhello\n```')).toBe(true);
      expect(hasFileBlocks('```file:edit:/etc/nginx.conf\nserver {}\n```')).toBe(true);
      expect(hasFileBlocks('```file:delete:/tmp/old.log\nreason\n```')).toBe(true);
      expect(hasFileBlocks('```file:rename:/old -> /new\n```')).toBe(true);
    });

    it('returns false for regular code blocks', () => {
      expect(hasFileBlocks('```bash\necho hello\n```')).toBe(false);
      expect(hasFileBlocks('just text')).toBe(false);
      expect(hasFileBlocks('')).toBe(false);
    });
  });

  describe('parseFileBlocks', () => {
    it('returns single markdown segment for plain text', () => {
      const result = parseFileBlocks('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('markdown');
      expect((result[0] as { text: string }).text).toBe('Hello world');
    });

    it('returns single markdown segment for empty string', () => {
      const result = parseFileBlocks('');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('markdown');
    });

    it('returns single markdown segment for regular code blocks', () => {
      const input = 'Here is code:\n```bash\necho hello\n```\nDone.';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('markdown');
    });

    it('parses a file:create block', () => {
      const input = 'I will create this file:\n```file:create:/tmp/hello.txt\nHello, world!\nLine 2\n```\nDone.';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(3);

      expect(result[0].type).toBe('markdown');
      expect((result[0] as { text: string }).text).toBe('I will create this file:');

      const fileBlock = result[1] as FileSegment;
      expect(fileBlock.type).toBe('file');
      expect(fileBlock.action).toBe('create');
      expect(fileBlock.filePath).toBe('/tmp/hello.txt');
      expect(fileBlock.content).toBe('Hello, world!\nLine 2');

      expect(result[2].type).toBe('markdown');
      expect((result[2] as { text: string }).text).toBe('Done.');
    });

    it('parses a file:edit block', () => {
      const input = '```file:edit:/etc/nginx/nginx.conf\nserver { listen 80; }\n```';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.type).toBe('file');
      expect(fileBlock.action).toBe('edit');
      expect(fileBlock.filePath).toBe('/etc/nginx/nginx.conf');
    });

    it('parses a file:delete block', () => {
      const input = '```file:delete:/tmp/old.log\nNo longer needed\n```';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.type).toBe('file');
      expect(fileBlock.action).toBe('delete');
      expect(fileBlock.filePath).toBe('/tmp/old.log');
      expect(fileBlock.content).toBe('No longer needed');
    });

    it('parses a file:rename block with -> syntax', () => {
      const input = '```file:rename:/old/path.txt -> /new/path.txt\nRenaming for clarity\n```';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.type).toBe('file');
      expect(fileBlock.action).toBe('rename');
      expect(fileBlock.filePath).toBe('/old/path.txt');
      expect(fileBlock.targetPath).toBe('/new/path.txt');
    });

    it('parses meta JSON on the fence line', () => {
      const input = '```file:create:/tmp/test.js {"language":"javascript"}\nconsole.log("hi");\n```';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.meta).toEqual({ language: 'javascript' });
    });

    it('handles invalid meta JSON gracefully', () => {
      const input = '```file:create:/tmp/test.txt {invalid json}\nhello\n```';
      const result = parseFileBlocks(input);
      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.meta).toBeNull();
    });

    it('handles multiple file blocks with markdown between', () => {
      const input = [
        'First, create the config:',
        '```file:create:/app/config.json',
        '{"port": 3000}',
        '```',
        'Then update the server:',
        '```file:edit:/app/server.js',
        'const port = config.port;',
        '```',
        'All done!',
      ].join('\n');

      const result = parseFileBlocks(input);
      expect(result).toHaveLength(5);
      expect(result[0].type).toBe('markdown');
      expect(result[1].type).toBe('file');
      expect((result[1] as FileSegment).action).toBe('create');
      expect(result[2].type).toBe('markdown');
      expect(result[3].type).toBe('file');
      expect((result[3] as FileSegment).action).toBe('edit');
      expect(result[4].type).toBe('markdown');
    });

    it('does not confuse regular code blocks with file blocks', () => {
      const input = [
        'Run this command:',
        '```bash',
        'npm install',
        '```',
        'Then create:',
        '```file:create:/app/index.js',
        'console.log("hello");',
        '```',
      ].join('\n');

      const result = parseFileBlocks(input);
      expect(result).toHaveLength(2);
      // The bash block stays in markdown
      expect(result[0].type).toBe('markdown');
      expect((result[0] as { text: string }).text).toContain('```bash');
      // The file block is extracted
      expect(result[1].type).toBe('file');
    });

    it('handles unclosed file block at EOF', () => {
      const input = '```file:create:/tmp/test.txt\nhello world';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.type).toBe('file');
      expect(fileBlock.content).toBe('hello world');
    });

    it('handles empty file content', () => {
      const input = '```file:create:/tmp/empty.txt\n```';
      const result = parseFileBlocks(input);
      expect(result).toHaveLength(1);

      const fileBlock = result[0] as FileSegment;
      expect(fileBlock.content).toBe('');
    });
  });
});
