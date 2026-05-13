import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig, ChatMessage, ToolCall } from './BaseProvider';

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    });
  }

  async checkConnection(signal?: AbortSignal): Promise<{ success: boolean; type?: string; error?: string; hint?: string }> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }, {
        timeout: 15000,
        signal: signal,
      });
      return { success: true };
    } catch (error: any) {
      if (signal?.aborted) {
        return { success: false, type: '中断', error: 'User interrupted', hint: '用户取消' };
      }
      return { success: false, type: '连接错误', error: error.message, hint: '检查API配置' };
    }
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: this.convertMessages(),
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
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({
        role: 'assistant',
        content: '',
        toolCalls: toolCalls,
      });
      return { toolCalls, finished: false };
    }

    return { finished: true };
  }

  async continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.push({
      role: 'tool',
      content: result,
      toolCallId: toolCallId,
    });

const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: this.convertMessages(),
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
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({ role: 'assistant', content: '', toolCalls: toolCalls });
      return { toolCalls, finished: false };
    }

    return { finished: true };
  }

  private convertMessages(): ChatCompletionMessageParam[] {
    return this.messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId!,
          content: m.content,
        } as any;
      }
      if (m.role === 'assistant' && m.toolCalls) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        } as any;
      }
      return { role: m.role, content: m.content } as any;
    });
  }
}