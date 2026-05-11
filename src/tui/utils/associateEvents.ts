import type { Event, MessageWithContext, ToolCall } from '../types';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function associateEvents(flatEvents: Event[]): MessageWithContext[] {
  const messages: MessageWithContext[] = [];
  let currentReasoning = '';
  let currentTools: ToolCall[] = [];
  const pendingResults: Map<string, { status: string; output: string }> = new Map();

  for (const event of flatEvents) {
    if (event.type === 'reasoning') {
      currentReasoning += event.content;
    } else if (event.type === 'tool_call') {
      currentTools.push({
        name: event.toolName || 'unknown',
        arguments: event.toolArguments || {},
        status: event.toolStatus || 'running',
        output: '',
        timestamp: event.timestamp,
      });
    } else if (event.type === 'tool_result') {
      pendingResults.set(event.toolName || 'unknown', {
        status: event.toolStatus || 'success',
        output: event.content || '',
      });
    } else if (event.type === 'message') {
      currentTools = currentTools.map(tool => {
        const result = pendingResults.get(tool.name);
        if (result) {
          return { ...tool, status: result.status, output: result.output };
        }
        return tool;
      });
      pendingResults.clear();

      messages.push({
        id: generateId(),
        role: event.role || 'assistant',
        content: event.content,
        reasoning: event.role === 'assistant' ? currentReasoning : '',
        tools: event.role === 'assistant' ? currentTools : [],
        timestamp: event.timestamp,
      });

      if (event.role === 'assistant') {
        currentReasoning = '';
        currentTools = [];
      }
    }
  }

  return messages;
}