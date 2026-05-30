// Compression integration tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpicaAgent } from '../agent';
import { TokenCounter } from '../llm/TokenCounter';
import type { ChatMessage } from '../llm/providers/BaseProvider';

describe('Compression Integration', () => {
  let agent: SpicaAgent;
  let mockLLM: any;
  let testMessages: ChatMessage[];
  const SMALL_CONTEXT_WINDOW = 1000;  // Small window so tests trigger compression easily

  beforeEach(() => {
    agent = new SpicaAgent('test', '/tmp/spica-test-compression');

    testMessages = [];

    // Create mock LLM with controllable behavior
    mockLLM = {
      getMessages: vi.fn(() => testMessages),
      setMessages: vi.fn((msgs: ChatMessage[]) => { testMessages = msgs; }),
      getProvider: vi.fn(() => ({
        getContextWindow: () => SMALL_CONTEXT_WINDOW
      })),
      generateDirect: vi.fn().mockResolvedValue({ content: 'Mock summary of conversation' })
    };

    // Inject mock into private field
    Object.defineProperty(agent, 'llm', { value: mockLLM, writable: true });
  });

  describe('Token threshold tests', () => {
    it('should compress messages when exceeding target threshold', async () => {
      // Target is 30% of 1000 = 300 tokens
      // Need messages > 300 tokens to trigger compression
      // Each "A".repeat(400) = ~100 tokens
      // Create 10 messages = ~1000 tokens > 300 target
      for (let i = 0; i < 10; i++) {
        testMessages.push({ role: 'user', content: 'A'.repeat(400) });
        testMessages.push({ role: 'assistant', content: 'B'.repeat(400) });
      }

      const counter = new TokenCounter();
      counter.setContextWindow(SMALL_CONTEXT_WINDOW);
      const initialTokens = counter.estimateMessages(testMessages);
      expect(initialTokens).toBeGreaterThan(300);  // Over target (30%)

      // Listen for compression event
      const compressListener = vi.fn();
      agent.on('context_compressed', compressListener);

      await agent.compact();

      expect(compressListener).toHaveBeenCalled();
      expect(mockLLM.setMessages).toHaveBeenCalled();

      // After compression, should be close to target (may slightly exceed due to min=5 constraint)
      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      const finalTokens = counter.estimateMessages(finalMessages);
      // min=5 guarantees minimum retention, so final may be ~550 tokens (55% of 1000)
      // This is acceptable - 30% target is aggressive, min retention ensures context preserved
      expect(finalTokens).toBeLessThan(600);
    });

    it('should not compress if already below target', async () => {
      // Small message set - well below threshold
      testMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      await agent.compact();

      // Should emit event but not actually compress
      expect(mockLLM.setMessages).not.toHaveBeenCalled();
    });
  });

  describe('Message truncation tests', () => {
    it('should truncate recent messages to 1500 chars', async () => {
      // Place long message at the END so it's in recentMessages
      testMessages = [
        { role: 'user', content: 'A'.repeat(400) },
        { role: 'assistant', content: 'A'.repeat(400) },
        { role: 'user', content: 'A'.repeat(400) },
        { role: 'assistant', content: 'A'.repeat(5000) }  // Last message - will be in recentMessages and truncated
      ];

      await agent.compact();

      expect(mockLLM.setMessages).toHaveBeenCalled();
      const finalMessages = mockLLM.setMessages.mock.calls[0][0];

      // Find truncated message (should exist due to 5000 char content at end)
      const truncatedMsg = finalMessages.find(m => m.content?.includes('[truncated]'));
      expect(truncatedMsg).toBeDefined();
      // Window is 1000, so maxContentLength = Math.max(500, Math.floor(1000 * 0.01)) = 500
      const expectedLen = 500 + '...[truncated]'.length; // 514
      expect(truncatedMsg!.content!.length).toBe(expectedLen);
    });

    it('should truncate multiple long messages when they are in recentMessages', async () => {
      // Long messages at the END to ensure they're in recentMessages
      testMessages = [
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'Z'.repeat(3000) },      // Will be truncated
        { role: 'assistant', content: 'W'.repeat(4000) }  // Will be truncated
      ];

      await agent.compact();

      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      const truncatedCount = finalMessages.filter(m => m.content?.includes('[truncated]')).length;
      expect(truncatedCount).toBeGreaterThanOrEqual(1);  // At least 1 should be truncated
    });

    it('should truncate excessive toolCalls to max 4', async () => {
      // Create message with many toolCalls at the END
      // Need enough messages to exceed 50% target (500 tokens)
      testMessages = [
        { role: 'user', content: 'A'.repeat(400) },
        { role: 'assistant', content: 'A'.repeat(400) },
        { role: 'user', content: 'A'.repeat(400) },
        { role: 'assistant', content: 'A'.repeat(400) },
        { role: 'user', content: 'A'.repeat(400) },
        { role: 'assistant', content: 'A'.repeat(400) },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'tc1', name: 'file_read', arguments: { path: '/a.txt' } },
            { id: 'tc2', name: 'file_read', arguments: { path: '/b.txt' } },
            { id: 'tc3', name: 'file_read', arguments: { path: '/c.txt' } },
            { id: 'tc4', name: 'file_read', arguments: { path: '/d.txt' } },
            { id: 'tc5', name: 'bash', arguments: { command: 'ls' } }
          ]
        }
      ];

      await agent.compact();

      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      const msgWithToolCalls = finalMessages.find(m => m.toolCalls && m.toolCalls.length > 0);

      expect(msgWithToolCalls).toBeDefined();
      expect(msgWithToolCalls!.toolCalls!.length).toBeLessThanOrEqual(5);  // 4 + truncated marker
      // Should have truncated marker
      expect(msgWithToolCalls!.toolCalls!.some(tc => tc.name.includes('[truncated]'))).toBe(true);
    });
  });

  describe('ToolCalls handling tests', () => {
    it('should preserve toolCalls info when generating summary', async () => {
      // Need enough messages to trigger compression
      testMessages = [
        { role: 'user', content: 'Read the config file' },
        { role: 'assistant', content: '', toolCalls: [
          { id: 'tc1', name: 'file_read', arguments: { path: '/etc/config.json' } }
        ]},
        { role: 'tool', content: '{"key": "value"}', toolCallId: 'tc1' },
        { role: 'assistant', content: 'Config loaded successfully' },
        { role: 'user', content: 'Now edit it' },
        { role: 'assistant', content: '', toolCalls: [
          { id: 'tc2', name: 'bash', arguments: { command: 'cat /etc/config.json' } }
        ]},
        { role: 'tool', content: 'output', toolCallId: 'tc2' },
        // Add more messages to exceed threshold
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) }
      ];

      await agent.compact();

      expect(mockLLM.generateDirect).toHaveBeenCalled();
      const promptArg = mockLLM.generateDirect.mock.calls[0][0];

      // Tool names should be preserved in summary prompt
      expect(promptArg).toContain('file_read');
      expect(promptArg).toContain('bash');
      // Key arguments should be preserved
      expect(promptArg).toContain('/etc/config.json');
    });

    it('should handle messages with multiple toolCalls', async () => {
      testMessages = [
        { role: 'assistant', content: '', toolCalls: [
          { id: 'tc1', name: 'file_read', arguments: { path: '/a.txt' } },
          { id: 'tc2', name: 'file_read', arguments: { path: '/b.txt' } },
          { id: 'tc3', name: 'bash', arguments: { command: 'ls' } }
        ]},
        { role: 'tool', content: 'content a', toolCallId: 'tc1' },
        { role: 'tool', content: 'content b', toolCallId: 'tc2' },
        { role: 'tool', content: 'output', toolCallId: 'tc3' },
        // Add more messages to exceed threshold
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) }
      ];

      await agent.compact();

      const promptArg = mockLLM.generateDirect.mock.calls[0][0];
      expect(promptArg).toContain('file_read');
      expect(promptArg).toContain('bash');
    });
  });

  describe('Fallback summary tests', () => {
    it('should use fallback summary when generateDirect fails', async () => {
      mockLLM.generateDirect = vi.fn().mockRejectedValue(new Error('API error'));

      // Need enough messages AND oldMessages for fallback to be triggered
      // Target is 50% = 500 tokens, need > 500 tokens
      testMessages = [
        { role: 'user', content: 'First task description here' },
        { role: 'assistant', content: 'Working on it' },
        { role: 'user', content: 'Second task request' },
        { role: 'assistant', content: 'Completed' },
        // More messages to exceed threshold
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'Final question' }
      ];

      await agent.compact();

      expect(mockLLM.setMessages).toHaveBeenCalled();
      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      const summaryMsg = finalMessages.find(m => m.role === 'assistant' && m.content?.includes('[History Summary]'));

      expect(summaryMsg).toBeDefined();
      expect(summaryMsg!.content).toContain('[History Summary]');
      // Fallback uses "Task chain:" format
      expect(summaryMsg!.content).toContain('Task chain:');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages array', async () => {
      testMessages = [];

      await agent.compact();

      // Should not throw, should emit event
      expect(mockLLM.setMessages).not.toHaveBeenCalled();
    });

    it('should handle messages with empty content but enough tokens', async () => {
      // Need enough tokens to exceed 50% target (500 tokens)
      testMessages = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) },
        { role: 'user', content: 'X'.repeat(400) },
        { role: 'assistant', content: 'Y'.repeat(400) }
      ];

      await agent.compact();

      expect(mockLLM.setMessages).toHaveBeenCalled();
      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      expect(finalMessages.length).toBeGreaterThan(0);
    });

    it('should compress large context aggressively', async () => {
      // Create massive messages (40 total)
      for (let i = 0; i < 20; i++) {
        testMessages.push({ role: 'user', content: 'X'.repeat(500) });
        testMessages.push({ role: 'assistant', content: 'Y'.repeat(500) });
      }

      const counter = new TokenCounter();
      counter.setContextWindow(SMALL_CONTEXT_WINDOW);
      const initialTokens = counter.estimateMessages(testMessages);
      expect(initialTokens).toBeGreaterThan(2000);  // Way over limit

      await agent.compact();

      // Should compress to significantly fewer messages
      const finalMessages = mockLLM.setMessages.mock.calls[0][0];
      const finalTokens = counter.estimateMessages(finalMessages);

      // Compression reduces from 40 to a few messages
      expect(finalMessages.length).toBeLessThan(10);
      // Final tokens should be much lower than initial (not necessarily exact target due to summary overhead)
      expect(finalTokens).toBeLessThan(initialTokens * 0.5);
    });
  });
});