import { EventEmitter } from 'events';
import { OpenAICompatibleProvider } from './providers/OpenAICompatible';
import { TokenCounter } from './TokenCounter';
import { RateLimiter } from './RateLimiter';
import { FunctionCaller, ToolExecutor } from './FunctionCaller';
import type { ToolDefinition, LLMResponse, ChatMessage } from './providers/BaseProvider';

export interface LLMClientConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  name?: string;
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
}

export class LLMClient extends EventEmitter {
  private provider: OpenAICompatibleProvider;
  private tokenCounter: TokenCounter;
  private rateLimiter: RateLimiter;
  private functionCaller: FunctionCaller;
  private tools: ToolDefinition[] = [];
  private abortController: AbortController | null = null;

  constructor(config: LLMClientConfig) {
    super();
    this.provider = new OpenAICompatibleProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      name: config.name || config.provider,
    });

    this.provider.on('chunk', (chunk: string) => {
      this.emit('chunk', chunk);
    });

    this.provider.on('reasoning', (content: string) => {
      this.emit('reasoning', content);
    });

    this.tokenCounter = new TokenCounter();
    this.rateLimiter = new RateLimiter(config.rateLimit || {});
    this.functionCaller = new FunctionCaller();
  }

  // 检查API连接（支持中断）
  async checkConnection(signal?: AbortSignal): Promise<{ success: boolean; type?: string; error?: string; hint?: string }> {
    return this.provider.checkConnection(signal);
  }

  setSystemPrompt(prompt: string): void {
    this.provider.setSystemPrompt(prompt);
  }

  registerTool(name: string, executor: ToolExecutor): void {
    this.functionCaller.RegisterTool(name, executor);
  }

  registerTools(tools: Record<string, ToolExecutor>): void {
    this.functionCaller.RegisterMultiple(tools);
  }

  setToolDefinitions(tools: ToolDefinition[]): void {
    this.tools = tools;
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    await this.rateLimiter.waitForAvailability();
    this.rateLimiter.recordRequest();

    this.abortController = new AbortController();
    const toolsToUse = tools || this.tools;
    
    try {
      const response = await this.provider.generate(prompt, toolsToUse, this.abortController.signal);

      if (response.content) {
        const tokens = this.tokenCounter.estimateTokens(response.content);
        this.rateLimiter.recordTokenUsage(tokens);
      }

      return response;
    } finally {
      this.abortController = null;
    }
  }

  interrupt() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async continueWithToolResult(toolCallName: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    const toolsToUse = tools || this.tools;

    const lastMessage = this.provider.getMessages()[this.provider.getMessages().length - 1];
    const toolCallId = lastMessage.toolCalls?.find(tc => tc.name === toolCallName)?.id || '';

    // 添加tool结果消息
    this.provider.addToolMessage(toolCallId, result);

    await this.rateLimiter.waitForAvailability();
    this.rateLimiter.recordRequest();

    this.abortController = new AbortController();

    try {
      // 发起生成请求
      const response = await this.provider.generateFromHistory(toolsToUse, this.abortController.signal);

      if (response.content) {
        const tokens = this.tokenCounter.estimateTokens(response.content);
        this.rateLimiter.recordTokenUsage(tokens);
      }

      return response;
    } finally {
      this.abortController = null;
    }
  }

  // 添加多个工具结果后继续生成
  async continueWithAllToolResults(toolResults: Array<{ name: string; result: string }>, tools?: ToolDefinition[]): Promise<LLMResponse> {
    const toolsToUse = tools || this.tools;
    const lastMessage = this.provider.getMessages()[this.provider.getMessages().length - 1];

    // 添加所有tool结果消息
    for (const { name, result } of toolResults) {
      const toolCallId = lastMessage.toolCalls?.find(tc => tc.name === name)?.id || '';
      this.provider.addToolMessage(toolCallId, result);
    }

    await this.rateLimiter.waitForAvailability();
    this.rateLimiter.recordRequest();

    this.abortController = new AbortController();

    try {
      const response = await this.provider.generateFromHistory(toolsToUse, this.abortController.signal);

      if (response.content) {
        const tokens = this.tokenCounter.estimateTokens(response.content);
        this.rateLimiter.recordTokenUsage(tokens);
      }

      return response;
    } finally {
      this.abortController = null;
    }
  }

  async executeWithTools(prompt: string, maxIterations: number = 10): Promise<string> {
    let response = await this.generate(prompt);
    let iterations = 0;

    while (!response.finished && iterations < maxIterations) {
      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          const result = await this.functionCaller.Execute(tc);

          if (!result.success) {
            console.error(`Tool ${tc.name} failed: ${result.error}`);
          }

          await this.rateLimiter.waitForAvailability();
          this.rateLimiter.recordRequest();

          response = await this.provider.continueWithToolResult(tc.id, result.output || result.error || '', this.tools);

          if (response.content) {
            const tokens = this.tokenCounter.estimateTokens(response.content);
            this.rateLimiter.recordTokenUsage(tokens);
          }
        }
      }
      iterations++;
    }

    return response.content || '';
  }

  clearHistory(): void {
    this.provider.clearHistory();
  }

  getMessages(): ChatMessage[] {
    return this.provider.getMessages();
  }

  setMessages(messages: ChatMessage[]): void {
    this.provider.setMessages(messages);
  }

  getTokenStatus(): { requestsRemaining: number; tokensRemaining: number } {
    return this.rateLimiter.getStatus();
  }

  getProvider(): OpenAICompatibleProvider {
    return this.provider;
  }
}