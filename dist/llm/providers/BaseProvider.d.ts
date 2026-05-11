export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCallId?: string;
    toolCalls?: ToolCall[];
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}
export interface LLMResponse {
    content?: string;
    toolCalls?: ToolCall[];
    finished: boolean;
}
export interface LLMProviderConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    name?: string;
}
export declare abstract class BaseProvider {
    protected config: LLMProviderConfig;
    protected messages: ChatMessage[];
    constructor(config: LLMProviderConfig);
    abstract generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    abstract continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    setSystemPrompt(prompt: string): void;
    addMessage(message: ChatMessage): void;
    clearHistory(): void;
    getMessages(): ChatMessage[];
}
//# sourceMappingURL=BaseProvider.d.ts.map