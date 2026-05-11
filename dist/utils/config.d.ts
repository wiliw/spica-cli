export interface ProviderConfig {
    name: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    description?: string;
}
export interface Config {
    defaultProvider?: string;
    providers?: Record<string, ProviderConfig>;
}
export declare const BUILTIN_PROVIDERS: Record<string, Partial<ProviderConfig>>;
export declare function loadConfig(): Promise<Config>;
export declare function saveConfig(config: Config): Promise<void>;
export declare function getProviderConfig(providerName?: string): Promise<ProviderConfig>;
export declare function setProviderConfig(name: string, apiKey: string, baseUrl?: string, model?: string): Promise<void>;
export declare function listProviders(): Promise<string[]>;
export declare function setDefaultProvider(name: string): Promise<void>;
export declare function setConfigValue(key: string, value: string): Promise<void>;
export declare function getConfigValue(key: string): Promise<string | undefined>;
//# sourceMappingURL=config.d.ts.map