import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig } from './BaseProvider';
export declare class OpenAICompatibleProvider extends BaseProvider {
    private client;
    private providerName;
    constructor(config: LLMProviderConfig);
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    private convertMessages;
}
//# sourceMappingURL=OpenAICompatible.d.ts.map