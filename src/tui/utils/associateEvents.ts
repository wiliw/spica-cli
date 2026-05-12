import type { Event, ConversationTurn, ToolCall } from '../types';

function generateId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function associateEventsToTurns(flatEvents: Event[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentUserMessage = '';
  let currentAssistantMessage = '';
  let currentReasoning = '';
  let currentTools: ToolCall[] = [];

  for (const event of flatEvents) {
    if (event.type === 'reasoning') {
      currentReasoning += event.content;
    } else if (event.type === 'tool_call') {
      // tool_call可能已经包含result（如果tool_result已更新了它）
      // 或者是running状态（等待result）
      currentTools.push({
        name: event.toolName || 'unknown',
        arguments: event.toolArguments || {},
        status: event.toolStatus || 'running',
        output: event.content || '', // content存储output
        timestamp: event.timestamp,
      });
    } else if (event.type === 'tool_result') {
      // 如果有独立的tool_result事件，更新对应的tool
      const toolIndex = currentTools.findIndex(t => t.name === event.toolName);
      if (toolIndex >= 0) {
        currentTools[toolIndex] = {
          ...currentTools[toolIndex],
          status: event.toolStatus || 'success',
          output: event.content || '',
        };
      }
    } else if (event.type === 'message') {
      if (event.role === 'user') {
        // 保存当前turn（如果有）
        if (currentUserMessage && currentAssistantMessage) {
          turns.push({
            id: generateId(),
            userMessage: currentUserMessage,
            assistantMessage: currentAssistantMessage,
            reasoning: currentReasoning,
            tools: currentTools,
            timestamp: event.timestamp,
          });
          currentAssistantMessage = '';
          currentReasoning = '';
          currentTools = [];
        }
        currentUserMessage = event.content;
      } else if (event.role === 'assistant') {
        // assistant消息到达时，当前工具已经是最终状态
        currentAssistantMessage = event.content;

        if (currentUserMessage) {
          turns.push({
            id: generateId(),
            userMessage: currentUserMessage,
            assistantMessage: currentAssistantMessage,
            reasoning: currentReasoning,
            tools: currentTools,
            timestamp: event.timestamp,
          });
        }

        // 重置
        currentUserMessage = '';
        currentAssistantMessage = '';
        currentReasoning = '';
        currentTools = [];
      }
    }
  }

  // 未完成的turn（用户消息后没有assistant响应）
  if (currentUserMessage) {
    turns.push({
      id: generateId(),
      userMessage: currentUserMessage,
      assistantMessage: currentAssistantMessage || '...',
      reasoning: currentReasoning,
      tools: currentTools,
      timestamp: new Date(),
    });
  }

  return turns;
}

export function associateEvents(flatEvents: Event[]): ConversationTurn[] {
  return associateEventsToTurns(flatEvents);
}