import { EventEmitter } from 'events';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
  finished: boolean;
  reasoning?: string;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  name?: string;
}

export abstract class BaseProvider extends EventEmitter {
  protected config: LLMProviderConfig;
  protected messages: ChatMessage[] = [];

  constructor(config: LLMProviderConfig) {
    super();
    this.config = config;
  }

  abstract generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract checkConnection(signal?: AbortSignal): Promise<{ success: boolean; type?: string; error?: string; hint?: string }>;

  setSystemPrompt(prompt: string) {
    // 移除旧的 system 消息，保留其他消息
    this.messages = this.messages.filter(m => m.role !== 'system');
    // 在开头添加新的 system 消息
    this.messages.unshift({ role: 'system', content: prompt });
  }

  addMessage(message: ChatMessage) {
    this.messages.push(message);
  }

  clearHistory() {
    this.messages = [];
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
  }
}