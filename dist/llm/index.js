import { OpenAICompatibleProvider } from './providers/OpenAICompatible';
import { getProviderConfig } from '../utils/config';
export class LLMClient {
    provider;
    providerName;
    constructor(providerName, providerConfig) {
        this.providerName = providerName || 'default';
        if (providerConfig) {
            this.provider = new OpenAICompatibleProvider(providerConfig);
        }
        else {
            this.initFromConfig(providerName);
        }
    }
    async initFromConfig(name) {
        const config = await getProviderConfig(name);
        this.providerName = config.name;
        this.provider = new OpenAICompatibleProvider({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
            name: config.name,
        });
    }
    async generate(prompt, tools) {
        return this.provider.generate(prompt, tools);
    }
    async continueWithToolResult(toolCallId, result, tools) {
        return this.provider.continueWithToolResult(toolCallId, result, tools);
    }
    clearHistory() {
        this.provider.clearHistory();
    }
    getProviderName() {
        return this.providerName;
    }
}
export { BUILTIN_PROVIDERS } from '../utils/config';
//# sourceMappingURL=index.js.map