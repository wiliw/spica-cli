import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event } from '../src/tui/types';

describe('TUI Integration Tests', () => {
  test('reasoning is preserved in turn after task ends', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'hello', timestamp: new Date(1000) },
      { type: 'reasoning', content: 'thinking step 1...', timestamp: new Date(2000) },
      { type: 'reasoning', content: 'thinking step 2...', timestamp: new Date(2500) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'ok', timestamp: new Date(4000) },
      { type: 'reasoning', content: 'final thought...', timestamp: new Date(4500) },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date(5000) },
    ];

    const turns = associateEvents(events);
    expect(turns.length).toBe(1);
    expect(turns[0].reasoning).toContain('thinking step 1');
    expect(turns[0].reasoning).toContain('thinking step 2');
    expect(turns[0].reasoning).toContain('final thought');
  });

  test('multiple rounds preserve各自的reasoning', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'round1', timestamp: new Date(1000) },
      { type: 'reasoning', content: 'r1 think', timestamp: new Date(2000) },
      { type: 'message', role: 'assistant', content: 'r1 answer', timestamp: new Date(3000) },
      { type: 'message', role: 'user', content: 'round2', timestamp: new Date(4000) },
      { type: 'reasoning', content: 'r2 think', timestamp: new Date(5000) },
      { type: 'message', role: 'assistant', content: 'r2 answer', timestamp: new Date(6000) },
    ];

    const turns = associateEvents(events);
    expect(turns.length).toBe(2);
    expect(turns[0].reasoning).toBe('r1 think');
    expect(turns[1].reasoning).toBe('r2 think');
  });

  test('multiple rounds preserve各自的tools', () => {
    // Round 1: bash + file_read
    // Round 2: new query, no tools yet
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'round1 query', timestamp: new Date(1000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(2000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'bash output', timestamp: new Date(2500) },
      { type: 'tool_call', toolName: 'file_read', toolStatus: 'running', content: '', timestamp: new Date(3000) },
      { type: 'tool_result', toolName: 'file_read', toolStatus: 'success', content: 'file content', timestamp: new Date(3500) },
      { type: 'message', role: 'assistant', content: 'round1 done', timestamp: new Date(4000) },
      // Round 2 starts
      { type: 'message', role: 'user', content: 'round2 query', timestamp: new Date(5000) },
      { type: 'tool_call', toolName: 'bash', toolStatus: 'running', content: '', timestamp: new Date(6000) },
      { type: 'tool_result', toolName: 'bash', toolStatus: 'success', content: 'r2 bash output', timestamp: new Date(6500) },
      { type: 'message', role: 'assistant', content: 'round2 done', timestamp: new Date(7000) },
    ];

    const turns = associateEvents(events);
    console.log('Multiple rounds tools test:', JSON.stringify(turns, null, 2));

    expect(turns.length).toBe(2);
    // Round 1: 2 tools
    expect(turns[0].tools.length).toBe(2);
    expect(turns[0].tools[0].name).toBe('bash');
    expect(turns[0].tools[0].status).toBe('success');
    expect(turns[0].tools[0].output).toBe('bash output');
    expect(turns[0].tools[1].name).toBe('file_read');
    expect(turns[0].tools[1].output).toBe('file content');
    // Round 2: 1 tool
    expect(turns[1].tools.length).toBe(1);
    expect(turns[1].tools[0].name).toBe('bash');
    expect(turns[1].tools[0].output).toBe('r2 bash output');
  });
});