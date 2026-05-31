import { OpenAICompatibleProvider } from './providers/OpenAICompatible';
import { getProviderConfig } from '../utils/config';
import type { ToolDefinition, LLMResponse } from './providers/BaseProvider';

export class LLMClient {
  private provider!: OpenAICompatibleProvider;
  private providerName: string;

  constructor(providerName?: string, providerConfig?: any) {
    this.providerName = providerName || 'default';
    
    if (providerConfig) {
      this.provider = new OpenAICompatibleProvider(providerConfig);
    } else {
      this.initFromConfig(providerName);
    }
  }

  private async initFromConfig(name?: string) {
    const config = await getProviderConfig(name);
    this.providerName = config.name;
    this.provider = new OpenAICompatibleProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      name: config.name,
    });
  }

  async generate(prompt: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    return this.provider.generate(prompt, tools);
  }

  async continueWithToolResult(toolCallId: string, result: string, tools?: ToolDefinition[]): Promise<LLMResponse> {
    return this.provider.continueWithToolResult(toolCallId, result, tools);
  }

  clearHistory() {
    this.provider.clearHistory();
  }

  getProviderName(): string {
    return this.providerName;
  }
}

export type { ProviderConfig } from '../utils/config';