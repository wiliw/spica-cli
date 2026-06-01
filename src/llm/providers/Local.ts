import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig, ChatMessage, ToolCall } from './BaseProvider';

export class LocalProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:8080/v1';
  }

  async checkConnection(signal?: AbortSignal): Promise<{ success: boolean; type?: string; error?: string; hint?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: signal,
      });
      return { success: response.ok };
    } catch (error: any) {
      if (signal?.aborted) {
        return { success: false, type: 'Interrupted', error: 'User interrupted', hint: 'User cancelled' };
      }
      return { success: false, type: 'Connection error', error: error.message, hint: 'Check if local service is running' };
    }
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (prompt) {
      this.messages.push({ role: 'user', content: prompt });
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.messages.map(m => {
          if (m.role === 'tool') {
            return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
          }
          if (m.role === 'assistant' && m.toolCalls) {
            return {
              role: 'assistant',
              content: m.content,
              tool_calls: m.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            };
          }
          return { role: m.role, content: m.content };
        }),
        tools: tools?.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });

    const data = await response.json() as any;
    const message = data.choices?.[0]?.message;

    if (message?.content) {
      this.messages.push({ role: 'assistant', content: message.content });
      return { content: message.content, finished: true };
    }

    if (message?.tool_calls) {
      const toolCalls: ToolCall[] = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      this.messages.push({ role: 'assistant', content: '', toolCalls: toolCalls });
      return { toolCalls, finished: false };
    }

    return { finished: true };
  }

  async continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.push({ role: 'tool', content: result, toolCallId: toolCallId });
    return this.generate('', tools);
  }
}