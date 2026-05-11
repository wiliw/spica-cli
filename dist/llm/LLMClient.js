import { OpenAICompatibleProvider } from './providers/OpenAICompatible';
import { TokenCounter } from './TokenCounter';
import { RateLimiter } from './RateLimiter';
import { FunctionCaller } from './FunctionCaller';
export class LLMClient {
    provider;
    tokenCounter;
    rateLimiter;
    functionCaller;
    tools = [];
    constructor(config) {
        this.provider = new OpenAICompatibleProvider({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl || 'https://api.openai.com/v1',
            name: config.name || config.provider,
        });
        this.tokenCounter = new TokenCounter();
        this.rateLimiter = new RateLimiter(config.rateLimit || {});
        this.functionCaller = new FunctionCaller();
    }
    setSystemPrompt(prompt) {
        this.provider.setSystemPrompt(prompt);
    }
    registerTool(name, executor) {
        this.functionCaller.RegisterTool(name, executor);
    }
    registerTools(tools) {
        this.functionCaller.RegisterMultiple(tools);
    }
    setToolDefinitions(tools) {
        this.tools = tools;
    }
    async generate(prompt, tools) {
        await this.rateLimiter.waitForAvailability();
        this.rateLimiter.recordRequest();
        const toolsToUse = tools || this.tools;
        const response = await this.provider.generate(prompt, toolsToUse);
        if (response.content) {
            const tokens = this.tokenCounter.estimateTokens(response.content);
            this.rateLimiter.recordTokenUsage(tokens);
        }
        return response;
    }
    async continueWithToolResult(toolCallName, result, tools) {
        const toolsToUse = tools || this.tools;
        const lastMessage = this.provider.getMessages()[this.provider.getMessages().length - 1];
        const toolCallId = lastMessage.toolCalls?.find(tc => tc.name === toolCallName)?.id || '';
        await this.rateLimiter.waitForAvailability();
        this.rateLimiter.recordRequest();
        const response = await this.provider.continueWithToolResult(toolCallId, result, toolsToUse);
        if (response.content) {
            const tokens = this.tokenCounter.estimateTokens(response.content);
            this.rateLimiter.recordTokenUsage(tokens);
        }
        return response;
    }
    async executeWithTools(prompt, maxIterations = 10) {
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
    clearHistory() {
        this.provider.clearHistory();
    }
    getTokenStatus() {
        return this.rateLimiter.getStatus();
    }
    getProvider() {
        return this.provider;
    }
}
//# sourceMappingURL=LLMClient.js.map