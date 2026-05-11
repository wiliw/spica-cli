import { BaseProvider, ToolDefinition, LLMResponse, LLMProviderConfig } from './BaseProvider';
export declare class LocalProvider extends BaseProvider {
    private baseUrl;
    constructor(config: LLMProviderConfig);
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
}
//# sourceMappingURL=Local.d.ts.map