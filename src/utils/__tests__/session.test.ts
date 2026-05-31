// Test session truncation
import { saveSession, loadSession } from '../../utils/session';
import type { ChatMessage } from '../../llm/providers/BaseProvider';
import fs from 'fs-extra';

describe('Session Truncation', () => {
  const testWorkspace = '/tmp/test-session';

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testWorkspace)) {
      fs.removeSync(testWorkspace);
    }
    fs.ensureDirSync(testWorkspace);
  });

  it('should truncate messages to max 50', () => {
    // Create 100 messages
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
      messages.push({ role: 'assistant', content: `Response ${i}` });
    }

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    // Should only have 50 messages (last 50)
    expect(loaded!.messages.length).toBe(50);
    // First message should be message 75 (index 150-150)
    expect(loaded!.messages[0].content).toContain('75');
  });

it('should truncate long messages to 2000 chars', () => {
    const longContent = 'A'.repeat(5000);
    const messages: ChatMessage[] = [
      { role: 'user', content: longContent },
      { role: 'assistant', content: 'short' }
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    // Long message should be truncated to ~2000 chars + "...[truncated]" suffix
    // "...[truncated]" is 14 chars, total = 2014 chars max
    expect(loaded!.messages[0].content.length).toBeLessThanOrEqual(2014);
    expect(loaded!.messages[0].content).toContain('[truncated]');
    expect(loaded!.messages[0].content.startsWith('A')).toBe(true);
  });

  it('should preserve tool_calls and tool messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'test' },
      {
        role: 'assistant',
        content: 'using tool',
        toolCalls: [
          { id: 'call_1', name: 'test_tool', arguments: { arg: 'value' } }
        ]
      },
      { role: 'tool', content: 'tool result', toolCallId: 'call_1' }
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    expect(loaded!.messages.length).toBe(3);
    expect(loaded!.messages[1].role).toBe('assistant');
    expect(loaded!.messages[1].toolCalls).toBeDefined();
    expect(loaded!.messages[1].toolCalls!.length).toBe(1);
    expect(loaded!.messages[1].toolCalls![0].id).toBe('call_1');
    expect(loaded!.messages[2].role).toBe('tool');
    expect(loaded!.messages[2].toolCallId).toBe('call_1');
  });

  it('should strip incomplete tool_calls pairs', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'test' },
      {
        role: 'assistant',
        content: 'using tool',
        toolCalls: [
          { id: 'call_1', name: 'test_tool', arguments: {} }
        ]
      }
      // Missing tool response!
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    expect(loaded!.messages.length).toBe(2);
    expect(loaded!.messages[1].role).toBe('assistant');
    expect(loaded!.messages[1].toolCalls).toBeUndefined();
    expect(loaded!.messages[1].content).toBe('using tool');
  });

  it('should handle multiple tool calls in sequence', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'test' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'tool1', arguments: {} },
          { id: 'call_2', name: 'tool2', arguments: {} }
        ]
      },
      { role: 'tool', content: 'result1', toolCallId: 'call_1' },
      { role: 'tool', content: 'result2', toolCallId: 'call_2' },
      { role: 'assistant', content: 'done' }
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    expect(loaded!.messages.length).toBe(5);
    expect(loaded!.messages[1].toolCalls!.length).toBe(2);
    expect(loaded!.messages[2].toolCallId).toBe('call_1');
    expect(loaded!.messages[3].toolCallId).toBe('call_2');
  });

  it('should remove orphaned tool messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'test' },
      { role: 'tool', content: 'orphaned', toolCallId: 'call_x' },
      { role: 'assistant', content: 'response' }
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    expect(loaded!.messages.length).toBe(2);
    expect(loaded!.messages[0].role).toBe('user');
    expect(loaded!.messages[1].role).toBe('assistant');
    expect(loaded!.messages[1].content).toBe('response');
  });
});