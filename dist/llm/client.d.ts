export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}
export interface ToolCall {
    name: string;
    arguments: Record<string, any>;
}
export interface LLMResponse {
    content?: string;
    toolCalls?: ToolCall[];
    finished: boolean;
}
export declare class LLMClient {
    private client;
    private model;
    private messages;
    constructor(apiKey: string, model?: string, baseUrl?: string);
    setSystemPrompt(prompt: string): void;
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(name: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    clearHistory(): void;
}
//# sourceMappingURL=client.d.ts.map