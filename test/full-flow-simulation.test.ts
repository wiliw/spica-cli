import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event } from '../src/tui/types';

// Simulates the real useAgent flow:
// 1. User message added
// 2. tool_call added (running)
// 3. tool_result updates tool_call in place
// 4. stream events create assistant message
// 5. message event updates assistant (NOT creates new one)

describe('Full flow simulation', () => {
  test('simulates complete useAgent setState flow', () => {
    // Initial state
    let events: Event[] = [];

    // Step 1: User message - 不创建turn（等待assistant或tools）
    const userEvent: Event = {
      type: 'message',
      role: 'user',
      content: 'query',
      timestamp: new Date(),
    };
    events = [...events, userEvent];
    const turns1 = associateEvents(events);
    expect(turns1.length).toBe(0); // 只有user不创建turn

    // Step 2: tool_call added (running) - 现在创建turn
    const toolCallEvent: Event = {
      type: 'tool_call',
      toolName: 'bash',
      toolArguments: { cmd: 'ls' },
      toolStatus: 'running',
      content: '',
      timestamp: new Date(),
    };
    events = [...events, toolCallEvent];
    const turns2 = associateEvents(events);
    expect(turns2.length).toBe(1); // 有tools才创建turn
    expect(turns2[0].tools.length).toBe(1);
    expect(turns2[0].tools[0].status).toBe('running');

    // Step 3: tool_result updates tool_call in place
    events = events.map(e =>
      e.type === 'tool_call' && e.toolName === 'bash' && e.toolStatus === 'running'
        ? { ...e, toolStatus: 'success', content: 'output here' }
        : e
    );
    const turns3 = associateEvents(events);
    expect(turns3.length).toBe(1);
    expect(turns3[0].tools.length).toBe(1);
    expect(turns3[0].tools[0].status).toBe('success');

    // Step 4: stream creates assistant message
    const streamEvent: Event = {
      type: 'message',
      role: 'assistant',
      content: 'streaming...',
      timestamp: new Date(),
    };
    events = [...events, streamEvent];
    const turns4 = associateEvents(events);
    expect(turns4.length).toBe(1);
    expect(turns4[0].tools.length).toBe(1);

    // Step 5: message event updates assistant (NOT creates a new one)
    events = events.map(e =>
      e.type === 'message' && e.role === 'assistant' && e.content === 'streaming...'
        ? { ...e, content: 'done' }
        : e
    );
    const turns5 = associateEvents(events);

    // Verify: the latest turn should have 1 tool with success status
    const latestTurn = turns5[turns5.length - 1];
    expect(latestTurn.tools.length).toBe(1);
    expect(latestTurn.tools[0].status).toBe('success');
    expect(latestTurn.tools[0].output).toBe('output here');

    // Verify: only ONE assistant event (no duplicate)
    const assistantEvents = events.filter(e => e.type === 'message' && e.role === 'assistant');
    expect(assistantEvents.length).toBe(1);
  });
});