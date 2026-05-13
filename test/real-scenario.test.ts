import { associateEvents } from '../src/tui/utils/associateEvents';
import type { Event } from '../src/tui/types';

// 模拟真实的多轮对话场景
describe('Real scenario simulation', () => {
  test('multiple tool calls in one turn', () => {
    const events: Event[] = [
      { type: 'message', role: 'user', content: '列出文件', timestamp: new Date('2026-01-01T10:00:00') },
      { type: 'tool_call', toolName: 'bash', toolArguments: { cmd: 'ls' }, toolStatus: 'running', content: '', timestamp: new Date('2026-01-01T10:00:01') },
      { type: 'tool_call', toolName: 'bash', toolArguments: { cmd: 'ls' }, toolStatus: 'success', content: 'file1\nfile2\nfile3', timestamp: new Date('2026-01-01T10:00:02') },
      { type: 'tool_call', toolName: 'file_read', toolArguments: { path: 'README.md' }, toolStatus: 'running', content: '', timestamp: new Date('2026-01-01T10:00:03') },
      { type: 'tool_call', toolName: 'file_read', toolArguments: { path: 'README.md' }, toolStatus: 'success', content: 'README content here', timestamp: new Date('2026-01-01T10:00:04') },
      { type: 'message', role: 'assistant', content: '文件列表和README内容已获取', timestamp: new Date('2026-01-01T10:00:05') },
    ];

    const turns = associateEvents(events);

    console.log('Events:', events.length);
    console.log('Tool events:', events.filter(e => e.type === 'tool_call').map(e => `${e.toolName}:${e.toolStatus}`));
    console.log('Turns:', turns.length);
    console.log('Turn 0 tools:', turns[0]?.tools?.length);
    turns[0]?.tools?.forEach(t => console.log(`  - ${t.name}: ${t.status}, output: ${t.output?.slice(0, 20)}`));

    expect(turns.length).toBe(1);
    // 每个工具应该有两条记录（running + success），但最终只保留 success 状态的
    expect(turns[0].tools.length).toBeGreaterThan(0);
    expect(turns[0].tools.some(t => t.name === 'bash' && t.status === 'success')).toBe(true);
    expect(turns[0].tools.some(t => t.name === 'file_read' && t.status === 'success')).toBe(true);
  });

  test('tools reset between turns', () => {
    // 第一轮有工具，第二轮没有
    const events: Event[] = [
      { type: 'message', role: 'user', content: 'query1', timestamp: new Date('2026-01-01T10:00:00') },
      { type: 'tool_call', toolName: 'bash', toolArguments: {}, toolStatus: 'success', content: 'output1', timestamp: new Date('2026-01-01T10:00:01') },
      { type: 'message', role: 'assistant', content: 'response1', timestamp: new Date('2026-01-01T10:00:02') },
      { type: 'message', role: 'user', content: 'query2', timestamp: new Date('2026-01-01T10:01:00') },
      { type: 'message', role: 'assistant', content: 'response2', timestamp: new Date('2026-01-01T10:01:01') },
    ];

    const turns = associateEvents(events);

    console.log('Turns:', turns.length);
    turns.forEach((t, i) => console.log(`Turn ${i}: tools=${t.tools.length}`));

    expect(turns.length).toBe(2);
    expect(turns[0].tools.length).toBe(1);
    expect(turns[1].tools.length).toBe(0);
  });
});