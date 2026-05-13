import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig, ChatMessage, ToolCall } from './BaseProvider';

export class OpenAICompatibleProvider extends BaseProvider {
  private client: OpenAI;
  private providerName: string;
  private onChunk?: (chunk: string) => void;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.providerName = config.name || 'OpenAI-compatible';
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 60000,
      maxRetries: 2,
    });
  }

  setChunkHandler(handler: (chunk: string) => void): void {
    this.onChunk = handler;
  }

async generate(prompt: string, tools?: ToolDefinition[], signal?: AbortSignal): Promise<LLMResponse> {
    this.messages.push({ role: 'user', content: prompt });

    try {
      const stream = await this.client.chat.completions.create({
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
        stream: true,
      }, { signal });

      let fullContent = '';
      let toolCalls: any[] = [];
      let hasToolCalls = false;

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
          this.emit('chunk', delta.content);
        }
        
        if ((delta as any)?.reasoning_content) {
          this.emit('reasoning', (delta as any).reasoning_content);
        }
        
        if (delta?.tool_calls) {
          hasToolCalls = true;
          delta.tool_calls.forEach((tc: any) => {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, name: '', arguments: '' };
              }
              if (tc.function?.name) {
                toolCalls[tc.index].name += tc.function.name;
                this.emit('tool_name_chunk', tc.function.name);
              }
              if (tc.function?.arguments) {
                toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          });
        }
      }

      if (hasToolCalls && toolCalls.length > 0) {
        const parsedToolCalls: ToolCall[] = toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.arguments),
        }));

        this.messages.push({
          role: 'assistant',
          content: fullContent || '',
          toolCalls: parsedToolCalls,
        });
        
        return { toolCalls: parsedToolCalls, finished: false };
      }

      if (fullContent) {
        this.messages.push({ role: 'assistant', content: fullContent });
        return { content: fullContent, finished: true };
      }

      return { finished: true };
    } catch (error: any) {
      if (signal?.aborted) {
        return { finished: true };
      }
      if (error.message?.includes('streaming')) {
        return await this.generateNonStreaming(prompt, tools);
      }
      throw new Error(`${this.providerName} API error: ${error.message}`);
    }
  }
  
  private async generateNonStreaming(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.pop();
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

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({
        role: 'assistant',
        content: message.content || '',
        toolCalls: toolCalls,
      });
      
      return { toolCalls, finished: false };
    }

    if (message.content) {
      this.messages.push({ role: 'assistant', content: message.content });
      return { content: message.content, finished: true };
    }

    return { finished: true };
  }

  async continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[], signal?: AbortSignal): Promise<LLMResponse> {
    this.messages.push({
      role: 'tool',
      content: result,
      toolCallId: toolCallId,
    });

    try {
      const stream = await this.client.chat.completions.create({
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
        stream: true,
      }, { signal });

      let fullContent = '';
      let toolCalls: any[] = [];
      let hasToolCalls = false;

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
          this.emit('chunk', delta.content);
        }
        
        if ((delta as any)?.reasoning_content) {
          this.emit('reasoning', (delta as any).reasoning_content);
        }
        
        if (delta?.tool_calls) {
          hasToolCalls = true;
          delta.tool_calls.forEach((tc: any) => {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, name: '', arguments: '' };
              }
              if (tc.function?.name) {
                toolCalls[tc.index].name += tc.function.name;
              }
              if (tc.function?.arguments) {
                toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          });
        }
      }

      if (hasToolCalls && toolCalls.length > 0) {
        const parsedToolCalls: ToolCall[] = toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.arguments),
        }));

        this.messages.push({
          role: 'assistant',
          content: fullContent || '',
          toolCalls: parsedToolCalls,
        });
        
        return { toolCalls: parsedToolCalls, finished: false };
      }

      if (fullContent) {
        this.messages.push({ role: 'assistant', content: fullContent });
        return { content: fullContent, finished: true };
      }

      return { finished: true };
    } catch (error: any) {
      if (signal?.aborted) {
        return { finished: true };
      }
      throw new Error(`${this.providerName} API error: ${error.message}`);
    }
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

  // 添加tool结果消息
  addToolMessage(toolCallId: string, result: string): void {
    this.messages.push({
      role: 'tool',
      content: result,
      toolCallId: toolCallId,
    });
  }

  // 从当前历史发起生成请求（不添加新的user消息）
  async generateFromHistory(tools?: ToolDefinition[], signal?: AbortSignal): Promise<LLMResponse> {
    try {
      const stream = await this.client.chat.completions.create({
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
        stream: true,
      }, { signal });

      let fullContent = '';
      let toolCalls: any[] = [];
      let hasToolCalls = false;

      for await (const chunk of stream) {
        if (signal?.aborted) break;

        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          this.emit('chunk', delta.content);
        }

        if ((delta as any)?.reasoning_content) {
          this.emit('reasoning', (delta as any).reasoning_content);
        }

        if (delta?.tool_calls) {
          hasToolCalls = true;
          delta.tool_calls.forEach((tc: any) => {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, name: '', arguments: '' };
              }
              if (tc.function?.name) {
                toolCalls[tc.index].name += tc.function.name;
              }
              if (tc.function?.arguments) {
                toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          });
        }
      }

      if (hasToolCalls && toolCalls.length > 0) {
        const parsedToolCalls: ToolCall[] = toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.arguments),
        }));

        this.messages.push({
          role: 'assistant',
          content: fullContent || '',
          toolCalls: parsedToolCalls,
        });

        return { toolCalls: parsedToolCalls, finished: false };
      }

      if (fullContent) {
        this.messages.push({ role: 'assistant', content: fullContent });
        return { content: fullContent, finished: true };
      }

      return { finished: true };
    } catch (error: any) {
      if (signal?.aborted) {
        return { finished: true };
      }
      throw new Error(`${this.providerName} API error: ${error.message}`);
    }
  }
}