import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event, MessageWithContext } from '../src/tui/types';

describe('associateEvents', () => {
  test('groups events into messages', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'hello', timestamp: new Date(1000) },
      { type: 'reasoning', content: 'thinking...', timestamp: new Date(2000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'ok', timestamp: new Date(4000) },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date(5000) },
    ];

    const messages = associateEvents(events);
    expect(messages.length).toBe(2);
    expect(messages[1].reasoning).toBe('thinking...');
    expect(messages[1].tools.length).toBe(1);
  });

  test('handles multiple tools', () => {
    const events: Event[] = [
      { type: 'reasoning', content: 'think', timestamp: new Date(1000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(2000) },
      { type: 'tool_call', toolName: 'read', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'ok', timestamp: new Date(4000) },
      { type: 'tool_result', toolName: 'read', toolStatus: 'success', content: 'file', timestamp: new Date(5000) },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date(6000) },
    ];

    const messages = associateEvents(events);
    expect(messages[0].tools.length).toBe(2);
    expect(messages[0].tools[0].status).toBe('success');
  });
});