import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig } from './BaseProvider';
export declare class AnthropicProvider extends BaseProvider {
    private apiKey;
    private baseUrl;
    constructor(config: LLMProviderConfig);
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
}
//# sourceMappingURL=Anthropic.d.ts.map