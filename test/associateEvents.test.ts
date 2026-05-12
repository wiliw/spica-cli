import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event, ConversationTurn } from '../src/tui/types';

describe('associateEvents', () => {
  test('groups events into turns', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'hello', timestamp: new Date(1000) },
      { type: 'reasoning', content: 'thinking...', timestamp: new Date(2000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'ok', timestamp: new Date(4000) },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date(5000) },
    ];

    const turns = associateEvents(events);
    expect(turns.length).toBe(1);
    expect(turns[0].userMessage).toBe('hello');
    expect(turns[0].assistantMessage).toBe('done');
    expect(turns[0].reasoning).toBe('thinking...');
    expect(turns[0].tools.length).toBe(1);
    expect(turns[0].tools[0].name).toBe('bash');
    expect(turns[0].tools[0].status).toBe('success');
  });

  test('handles multiple tools', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'test', timestamp: new Date(500) },
      { type: 'reasoning', content: 'think', timestamp: new Date(1000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(2000) },
      { type: 'tool_call', toolName: 'read', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'ok', timestamp: new Date(4000) },
      { type: 'tool_result', toolName: 'read', toolStatus: 'success', content: 'file', timestamp: new Date(5000) },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date(6000) },
    ];

    const turns = associateEvents(events);
    expect(turns.length).toBe(1);
    expect(turns[0].tools.length).toBe(2);
    expect(turns[0].tools[0].status).toBe('success');
    expect(turns[0].tools[1].status).toBe('success');
  });
});