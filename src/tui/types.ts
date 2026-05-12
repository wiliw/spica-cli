export interface ToolCall {
  name: string;
  arguments: object;
  status: 'running' | 'success' | 'error';
  output?: string;
  timestamp: Date;
}

export interface ConversationTurn {
  id: string;
  userMessage: string;
  assistantMessage: string;
  reasoning: string;
  tools: ToolCall[];
  timestamp: Date;
}

export interface Event {
  type: 'message' | 'tool_call' | 'tool_result' | 'reasoning' | 'stream_chunk';
  content: string;
  toolName?: string;
  toolArguments?: object;
  toolStatus?: 'running' | 'success' | 'error';
  role?: 'user' | 'assistant';
  timestamp: Date;
}

export interface MessageWithContext {
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolCall[];
  reasoning?: string;
  timestamp: Date;
}