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
  private pendingInterrupt = false;  // 中断标记（用于rate limiter等待期间）

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
    // 提前创建AbortController，支持中断rate limiter等待
    // 如果有旧的 controller，先 abort 避免竞态
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const toolsToUse = tools || this.tools;

    try {
      // 等待rate limiter（可被中断）
      await this.rateLimiter.waitForAvailability(this.abortController.signal);

      if (this.abortController.signal.aborted) {
        throw new Error('Interrupted during rate limit wait');
      }

      this.rateLimiter.recordRequest();
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
    this.rateLimiter.interrupt();  // 中断rate limiter等待
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // 直接生成（不使用历史消息，用于摘要等）
  async generateDirect(prompt: string): Promise<LLMResponse> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      await this.rateLimiter.waitForAvailability(this.abortController.signal);

      if (this.abortController.signal.aborted) {
        throw new Error('Interrupted during rate limit wait');
      }

      this.rateLimiter.recordRequest();
      // 使用 provider 的 generateDirect 方法（不添加到历史）
      const response = await this.provider.generateDirect(prompt, this.abortController.signal);

      if (response.content) {
        const tokens = this.tokenCounter.estimateTokens(response.content);
        this.rateLimiter.recordTokenUsage(tokens);
      }

      return response;
    } finally {
      this.abortController = null;
    }
  }

  async continueWithToolResult(toolCallName: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    const toolsToUse = tools || this.tools;

    const lastMessage = this.provider.getMessages()[this.provider.getMessages().length - 1];
    const toolCallId = lastMessage.toolCalls?.find(tc => tc.name === toolCallName)?.id || '';

    // 添加tool结果消息
    this.provider.addToolMessage(toolCallId, result);

    // 提前创建AbortController
    this.abortController = new AbortController();

    try {
      await this.rateLimiter.waitForAvailability(this.abortController.signal);

      if (this.abortController.signal.aborted) {
        throw new Error('Interrupted during rate limit wait');
      }

      this.rateLimiter.recordRequest();
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

  async continueWithAllToolResults(
    toolResults: Array<{ name: string; result: string; id?: string }>,
    tools?: ToolDefinition[],
    postToolMessages?: ChatMessage[]
  ): Promise<LLMResponse> {
    const toolsToUse = tools || this.tools;
    const lastMessage = this.provider.getMessages()[this.provider.getMessages().length - 1];

    // 1. 先添加所有 tool 结果消息（确保紧跟在 assistant tool_calls 后）
    for (const { name, result, id } of toolResults) {
      const toolCallId = id || lastMessage.toolCalls?.find(tc => tc.name === name)?.id || '';
      this.provider.addToolMessage(toolCallId, result);
    }

    // 2. 再添加 post-tool 消息（如 REQUIRED_SKILL）
    if (postToolMessages && postToolMessages.length > 0) {
      for (const msg of postToolMessages) {
        this.provider.addMessage(msg);
      }
    }

    // 提前创建AbortController
    this.abortController = new AbortController();

    try {
      await this.rateLimiter.waitForAvailability(this.abortController.signal);

      if (this.abortController.signal.aborted) {
        throw new Error('Interrupted during rate limit wait');
      }

      this.rateLimiter.recordRequest();
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
            // Tool execution failed - error will be returned to caller
          }

          await this.rateLimiter.waitForAvailability();
          this.rateLimiter.recordRequest();

          response = await this.provider.continueWithToolResult(tc.id, result.content || result.output || result.error || '', this.tools);

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

  addMessage(message: ChatMessage): void {
    this.provider.addMessage(message);
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

  // 添加用户消息（不立即生成）
  addUserMessage(content: string): void {
    this.provider.addUserMessage(content);
  }

  // 从历史消息继续生成（不添加新的user消息）
  async generateFromHistory(tools?: ToolDefinition[]): Promise<LLMResponse> {
    const toolsToUse = tools || this.tools;
    this.abortController = new AbortController();

    try {
      await this.rateLimiter.waitForAvailability(this.abortController.signal);

      if (this.abortController.signal.aborted) {
        throw new Error('Interrupted during rate limit wait');
      }

      this.rateLimiter.recordRequest();
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
}