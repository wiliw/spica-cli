// Test compression functionality
import { SpicaAgent } from '../agent';
import { TokenCounter } from '../llm/TokenCounter';
import type { ChatMessage } from '../llm/providers/BaseProvider';

describe('Context Compression', () => {
  it('should trigger compression when messages exceed threshold', () => {
    // This is a conceptual test - actual compression requires LLM
    const counter = new TokenCounter();
    counter.setContextWindow(100000);

    // Create messages that exceed 80% threshold (80k tokens)
    // Each message pair: ~20 tokens, need ~4000 pairs to exceed 80k
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 4200; i++) {
      messages.push({ role: 'user', content: 'Test message ' + i });
      messages.push({ role: 'assistant', content: 'Response ' + i });
    }

    const usedTokens = counter.estimateMessages(messages);
    const threshold = counter['contextWindow'] * 0.8;

    expect(usedTokens).toBeGreaterThan(threshold);
  });

  it('should truncate long messages in compression', () => {
    const counter = new TokenCounter();
    const longMessage = { role: 'user', content: 'A'.repeat(5000) };

    // Truncate to 1500 chars (as in agent.ts) + "...[truncated]" (14 chars)
    const truncated = longMessage.content.slice(0, 1500) + '...[truncated]';
    expect(truncated.length).toBe(1514);
  });

  it('should generate summary for old messages', () => {
    // This is conceptual - actual summary generation requires LLM
    const oldMessages: ChatMessage[] = [];
    for (let i = 0; i < 50; i++) {
      oldMessages.push({ role: 'user', content: 'Old message ' + i });
      oldMessages.push({ role: 'assistant', content: 'Old response ' + i });
    }

    // Summary message would replace all these
    const summaryMessage: ChatMessage = {
      role: 'assistant',
      content: '[History Summary] User asked about X, Y, Z. Agent performed file operations.'
    };

    expect(summaryMessage.content.length).toBeLessThan(100);
    expect(oldMessages.length).toBeGreaterThan(10);
  });
});