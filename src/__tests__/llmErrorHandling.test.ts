// LLM error handling tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpicaAgent } from '../agent';
import type { ChatMessage } from '../llm/providers/BaseProvider';

// Partial mock of tools module
vi.mock('../tools/index', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    executeTool: vi.fn().mockResolvedValue({ success: true, output: 'mock output' }),
    getAllToolDefinitions: vi.fn().mockReturnValue([])
  };
});

describe('LLM Error Handling', () => {
  let agent: SpicaAgent;
  let mockLLM: any;
  let testMessages: ChatMessage[];

  beforeEach(() => {
    agent = new SpicaAgent('test', '/tmp/spica-test-error');

    testMessages = [];

    mockLLM = {
      getMessages: vi.fn(() => testMessages),
      setMessages: vi.fn((msgs: ChatMessage[]) => { testMessages = msgs; }),
      getProvider: vi.fn(() => ({
        getContextWindow: () => 10000
      })),
      generate: vi.fn().mockResolvedValue({ content: 'Mock response', finished: true }),
      continueWithAllToolResults: vi.fn().mockResolvedValue({ content: 'Mock continuation', finished: true })
    };

    Object.defineProperty(agent, 'llm', { value: mockLLM, writable: true });
  });

  describe('Initial generate failure', () => {
    it('should handle LLM generate failure gracefully', async () => {
      mockLLM.generate = vi.fn().mockRejectedValue(new Error('OpenAI API error: Connection error'));

      const result = await agent.runLoop('test prompt');

      expect(result).toContain('LLM请求失败');
      expect(result).toContain('Connection error');
    });

    it('should emit error_suggestion event on generate failure', async () => {
      mockLLM.generate = vi.fn().mockRejectedValue(new Error('API timeout'));

      const errorListener = vi.fn();
      agent.on('error_suggestion', errorListener);

      await agent.runLoop('test prompt');

      expect(errorListener).toHaveBeenCalled();
      expect(errorListener.mock.calls[0][0].error).toContain('API timeout');
    });
  });

  describe('Continue after tool results failure', () => {
    it('should handle continueWithAllToolResults failure gracefully', async () => {
      // First call succeeds with tool calls
      mockLLM.generate = vi.fn().mockResolvedValue({
        toolCalls: [{ id: 'tc1', name: 'file_read', arguments: { path: '/test.txt' } }],
        finished: false
      });

      // Continue fails
      mockLLM.continueWithAllToolResults = vi.fn().mockRejectedValue(new Error('Network interrupted'));

      const result = await agent.runLoop('read a file');

      expect(result).toContain('工具执行完成');
      expect(result).toContain('Network interrupted');
    });

    it('should emit error_suggestion on continue failure', async () => {
      mockLLM.generate = vi.fn().mockResolvedValue({
        toolCalls: [{ id: 'tc1', name: 'bash', arguments: { command: 'ls' } }],
        finished: false
      });

      mockLLM.continueWithAllToolResults = vi.fn().mockRejectedValue(new Error('Stream interrupted'));

      const errorListener = vi.fn();
      agent.on('error_suggestion', errorListener);

      await agent.runLoop('run a command');

      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('Network resilience', () => {
    it('should not crash on transient network errors', async () => {
      mockLLM.generate = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET'));

      const result = await agent.runLoop('test');

      expect(result).toContain('LLM请求失败');
      // Agent handles gracefully, doesn't crash
    });
  });
});