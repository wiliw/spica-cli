import type { Event, ConversationTurn, ToolCall } from '../types';

function generateId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function associateEventsToTurns(flatEvents: Event[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentUserMessage = '';
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
      if (event.role === 'user') {
        currentUserMessage = event.content;
      } else if (event.role === 'assistant') {
        currentTools = currentTools.map(tool => {
          const result = pendingResults.get(tool.name);
          if (result) {
            return { ...tool, status: result.status, output: result.output };
          }
          return tool;
        });
        pendingResults.clear();

        if (currentUserMessage) {
          turns.push({
            id: generateId(),
            userMessage: currentUserMessage,
            assistantMessage: event.content,
            reasoning: currentReasoning,
            tools: currentTools,
            timestamp: event.timestamp,
          });
        }

        currentUserMessage = '';
        currentReasoning = '';
        currentTools = [];
      }
    }
  }

  return turns;
}

export function associateEvents(flatEvents: Event[]): any[] {
  return associateEventsToTurns(flatEvents);
}