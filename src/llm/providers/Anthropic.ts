import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig, ChatMessage, ToolCall } from './BaseProvider';

export class AnthropicProvider extends BaseProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    this.messages.push({ role: 'user', content: prompt });

    const systemPrompt = this.messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = this.messages.filter(m => m.role !== 'system');

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: conversationMessages.map(m => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.role === 'tool' 
            ? [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]
            : m.content,
        })),
        tools: tools?.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }),
    });

    const data = await response.json() as any;

    if (data.content?.[0]?.type === 'text') {
      this.messages.push({ role: 'assistant', content: data.content[0].text });
      return { content: data.content[0].text, finished: true };
    }

    if (data.content?.[0]?.type === 'tool_use') {
      const toolCalls: ToolCall[] = data.content.map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.input,
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

    return this.generate('', tools);
  }
}