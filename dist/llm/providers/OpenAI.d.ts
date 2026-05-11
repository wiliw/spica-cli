import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig } from './BaseProvider';
export declare class OpenAIProvider extends BaseProvider {
    private client;
    constructor(config: LLMProviderConfig);
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    private convertMessages;
}
//# sourceMappingURL=OpenAI.d.ts.map