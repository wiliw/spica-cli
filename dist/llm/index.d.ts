import type { ToolDefinition, LLMResponse } from './providers/BaseProvider';
export declare class LLMClient {
    private provider;
    private providerName;
    constructor(providerName?: string, providerConfig?: any);
    private initFromConfig;
    generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse>;
    clearHistory(): void;
    getProviderName(): string;
}
export { BUILTIN_PROVIDERS } from '../utils/config';
export type { ProviderConfig } from '../utils/config';
//# sourceMappingURL=index.d.ts.map