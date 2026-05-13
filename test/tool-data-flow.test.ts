import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event } from '../src/tui/types';

describe('associateEvents - tool data flow', () => {
  test('tool_call with tool_result creates complete tool in turn', () => {
    // 同工具名只保留最新状态（替换旧的 running）
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'test query', timestamp: new Date() },
      { type: 'tool_call', toolName: 'file_read', toolArguments: { path: '/test' }, toolStatus: 'running', content: '', timestamp: new Date() },
      { type: 'tool_call', toolName: 'file_read', toolArguments: { path: '/test' }, toolStatus: 'success', content: 'file content here', timestamp: new Date() },
      { type: 'message', role: 'assistant', content: 'done', timestamp: new Date() },
    ];

    const turns = associateEvents(events);

    expect(turns.length).toBe(1);
    // 只保留最新状态的工具（success），所以只有1个
    expect(turns[0].tools.length).toBe(1);
    expect(turns[0].tools[0].status).toBe('success');
    expect(turns[0].tools[0].output).toBe('file content here');
  });

  test('tool_result updates existing tool_call', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'test', timestamp: new Date() },
      { type: 'tool_call', toolName: 'bash', toolArguments: { cmd: 'ls' }, toolStatus: 'success', content: 'file1\nfile2', timestamp: new Date() },
      { type: 'message', role: 'assistant', content: 'result', timestamp: new Date() },
    ];

    const turns = associateEvents(events);

    console.log('Turns (single updated tool_call):', JSON.stringify(turns, null, 2));

    expect(turns.length).toBe(1);
    expect(turns[0].tools.length).toBe(1);
    expect(turns[0].tools[0].status).toBe('success');
    expect(turns[0].tools[0].output).toBe('file1\nfile2');
  });

  test('real useAgent flow simulation', () => {
    // 模拟真实的事件顺序：
    // 1. tool_call 添加（running）
    // 2. tool_result 更新（修改同一个事件的属性）
    // 3. assistant message

    // 这对应 useAgent.ts 中:
    // tool_call: newEvents = [...prev.events, newEvent]  // 添加新事件
    // tool_result: newEvents = prev.events.map(e => ...) // 修改现有事件

    // 所以最终只有一个 tool_call 事件（已更新为 success）
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'query', timestamp: new Date() },
      { type: 'tool_call', toolName: 'bash', toolArguments: { cmd: 'ls' }, toolStatus: 'success', content: 'output here', timestamp: new Date() },
      { type: 'message', role: 'assistant', content: 'response', timestamp: new Date() },
    ];

    const turns = associateEvents(events);

    expect(turns.length).toBe(1);
    expect(turns[0].tools.length).toBe(1);
    expect(turns[0].tools[0].name).toBe('bash');
    expect(turns[0].tools[0].status).toBe('success');
    expect(turns[0].tools[0].output).toBe('output here');
  });
});