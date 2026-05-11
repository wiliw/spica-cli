import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
  finished: boolean;
}

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private messages: ChatCompletionMessageParam[] = [];

  constructor(apiKey: string, model: string = 'gpt-4', baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.openai.com/v1',
    });
    this.model = model;
  }

  setSystemPrompt(prompt: string) {
    this.messages = [{ role: 'system', content: prompt }];
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      tools: tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (message.content) {
      this.messages.push({ role: 'assistant', content: message.content });
      return { content: message.content, finished: true };
    }

    if (message.tool_calls) {
      const toolCalls: ToolCall[] = message.tool_calls.map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({ role: 'assistant', tool_calls: message.tool_calls });
      return { toolCalls, finished: false };
    }

    return { finished: true };
  }

  async continueWithToolResult(name: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    const lastMessage = this.messages[this.messages.length - 1];
    const toolCallId = (lastMessage as any).tool_calls?.[0]?.id || '';
    
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result,
    } as any);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      tools: tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (message.content) {
      this.messages.push({ role: 'assistant', content: message.content });
      return { content: message.content, finished: true };
    }

    if (message.tool_calls) {
      const toolCalls: ToolCall[] = message.tool_calls.map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({ role: 'assistant', tool_calls: message.tool_calls });
      return { toolCalls, finished: false };
    }

    return { finished: true };
  }

  clearHistory() {
    this.messages = [];
  }
}