import { OpenAICompatibleProvider } from './providers/OpenAICompatible';
import { ToolExecutor } from './FunctionCaller';
import type { ToolDefinition, LLMResponse } from './providers/BaseProvider';
export interface LLMClientConfig {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
    name?: string;
    rateLimit?: {
        requestsPerMinute?: number;
        tokensPerMinute?: number;
    };
}
export declare class LLMClient {
    private provider;
    private tokenCounter;
    private rateLimiter;
    private functionCaller;
    private tools;
    constructor(config: LLMClientConfig);
    setSystemPrompt(prompt: string): void;
    registerTool(name: string, executor: ToolExecutor): void;
    registerTools(tools: Record<string, ToolExecutor>): void;
    setToolDefinitions(tools: ToolDefinition[]): void;
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallName: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    executeWithTools(prompt: string, maxIterations?: number): Promise<string>;
    clearHistory(): void;
    getTokenStatus(): {
        requestsRemaining: number;
        tokensRemaining: number;
    };
    getProvider(): OpenAICompatibleProvider;
}
//# sourceMappingURL=LLMClient.d.ts.map