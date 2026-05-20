// Test edge cases for session, token counter, and diff
import { saveSession, loadSession } from '../utils/session';
import { TokenCounter } from '../llm/TokenCounter';
import { computeDiff, formatDiff } from '../cli/ui/diff';
import fs from 'fs-extra';

describe('Edge Cases', () => {
  describe('Session Edge Cases', () => {
    const testWorkspace = '/tmp/test-edge-session';

    beforeEach(() => {
      if (fs.existsSync(testWorkspace)) {
        fs.removeSync(testWorkspace);
      }
      fs.ensureDirSync(testWorkspace);
    });

    it('should handle empty messages array', () => {
      saveSession(testWorkspace, []);
      const loaded = loadSession(testWorkspace);
      expect(loaded!.messages).toEqual([]);
    });

    it('should handle messages with empty content', () => {
      const messages = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '', toolCalls: [] },
        { role: 'tool', content: '', toolCallId: 'tc-1' }
      ];
      saveSession(testWorkspace, messages);
      const loaded = loadSession(testWorkspace);
      expect(loaded!.messages.length).toBe(3);
    });

    it('should handle messages with only toolCalls (no content)', () => {
      const messages = [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'bash', arguments: { command: 'ls -la' } }]
        },
        { role: 'tool', content: 'file1\nfile2\nfile3', toolCallId: 'tc-1' }
      ];
      saveSession(testWorkspace, messages);
      const loaded = loadSession(testWorkspace);
      expect(loaded!.messages[0].toolCalls).toBeDefined();
    });

    it('should handle unicode and special characters', () => {
      const messages = [
        { role: 'user', content: '你好世界 🎉 \n\t\r\\特殊字符' },
        { role: 'assistant', content: '回复: <script>alert("xss")</script>' }
      ];
      saveSession(testWorkspace, messages);
      const loaded = loadSession(testWorkspace);
      expect(loaded!.messages[0].content).toContain('你好世界');
      expect(loaded!.messages[1].content).toContain('<script>');
    });

    it('should handle very long tool call arguments', () => {
      const longArgs = { content: 'A'.repeat(10000), path: '/very/long/path/...' };
      const messages = [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'file_write', arguments: longArgs }]
        }
      ];
      saveSession(testWorkspace, messages);
      const loaded = loadSession(testWorkspace);
      // Arguments should be preserved or truncated properly
      expect(loaded!.messages[0].toolCalls).toBeDefined();
    });
  });

  describe('TokenCounter Edge Cases', () => {
    let counter: TokenCounter;

    beforeEach(() => {
      counter = new TokenCounter();
      counter.setContextWindow(100000);
    });

    it('should handle empty text', () => {
      expect(counter.estimateTokens('')).toBe(0);
    });

    it('should handle very long single message', () => {
      const msg = { role: 'user', content: 'A'.repeat(50000) };
      const tokens = counter.estimateMessage(msg);
      expect(tokens).toBeGreaterThan(10000);
    });

    it('should handle message with many tool calls', () => {
      const msg = {
        role: 'assistant',
        content: '',
        toolCalls: Array(50).fill(null).map((_, i) => ({
          id: `tc-${i}`,
          name: 'file_read',
          arguments: { path: `file${i}` }
        }))
      };
      const tokens = counter.estimateMessage(msg);
      expect(tokens).toBeGreaterThan(500);
    });

    it('should handle messages array with mixed types', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'tc-1', name: 'bash', arguments: {} }] },
        { role: 'tool', content: 'result', toolCallId: 'tc-1' },
        { role: 'assistant', content: 'Final response' }
      ];
      const total = counter.estimateMessages(messages);
      expect(total).toBeGreaterThan(30);
    });
  });

  describe('Diff Edge Cases', () => {
    it('should handle empty old content (new file)', () => {
      const diff = computeDiff('', 'line1\nline2\nline3');
      expect(diff.length).toBe(3);
      expect(diff[0].type).toBe('add');
    });

    it('should handle empty new content (delete all)', () => {
      const diff = computeDiff('line1\nline2', '');
      expect(diff.length).toBe(2);
      expect(diff[0].type).toBe('remove');
    });

    it('should handle both empty', () => {
      const diff = computeDiff('', '');
      expect(diff.length).toBe(0);
    });

    it('should handle identical content', () => {
      const diff = computeDiff('same\ncontent', 'same\ncontent');
      expect(diff.length).toBe(2);
      expect(diff.every(d => d.type === 'context')).toBe(true);
    });

    it('should handle single line changes', () => {
      const diff = computeDiff('old', 'new');
      // Diff shows both remove and add for changed line
      expect(diff.length).toBe(2);
      expect(diff[0].type).toBe('remove');
      expect(diff[1].type).toBe('add');
    });

    it('should format diff correctly', () => {
      const diff = computeDiff('a\nb\nc', 'a\nx\nc');
      const formatted = formatDiff(diff, 2);
      expect(formatted).toContain('a');
      expect(formatted).toContain('x');
      expect(formatted).toContain('c');
    });
  });
});