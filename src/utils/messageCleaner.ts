import type { ChatMessage } from '../llm/providers/BaseProvider';

export function cleanMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  const usedToolCallIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const expectedIds = m.toolCalls.map(tc => tc.id);
      let j = i + 1;
      const foundIds: string[] = [];

      while (j < messages.length && messages[j].role === 'tool') {
        foundIds.push(messages[j].toolCallId || '');
        j++;
      }

      const missingOrReused = expectedIds.filter(id =>
        !foundIds.includes(id) || usedToolCallIds.has(id)
      );

      if (missingOrReused.length === 0) {
        result.push({ role: 'assistant', content: m.content || '', toolCalls: m.toolCalls });
        for (let k = i + 1; k < j; k++) {
          result.push(messages[k]);
          usedToolCallIds.add(messages[k].toolCallId || '');
        }
      } else {
        result.push({ role: 'assistant', content: m.content || '' });
      }
      i = j - 1;
    } else if (m.role === 'tool') {
      continue;
    } else {
      result.push({ role: m.role, content: m.content || '' });
    }
  }

  return result;
}
