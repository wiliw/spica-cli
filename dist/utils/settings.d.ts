export declare const GLOBAL_DIR: string;
export declare const GLOBAL_SETTINGS_FILE: string;
export interface ProviderConfig {
    name: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    description?: string;
}
export interface MCPServerConfig {
    name: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    disabled?: boolean;
}
export interface SkillDefinition {
    name?: string;
    description: string;
    promptTemplate: string;
    allowedTools?: string[];
    timeout?: number;
    autoInvoke?: boolean;
    paths?: string[];
    argumentHint?: string;
}
export interface HookMatcher {
    tool?: string;
    args?: Record<string, string>;
}
export interface HookDefinition {
    matcher: HookMatcher;
    action: 'block' | 'confirm' | 'log' | 'warn';
    message: string;
}
export interface HookResult {
    matched: boolean;
    action: 'block' | 'confirm' | 'log' | 'warn' | 'none';
    message: string;
}
export interface Settings {
    defaultProvider?: string;
    providers?: Record<string, ProviderConfig>;
    mcp?: {
        servers: MCPServerConfig[];
    };
    skills?: Record<string, SkillDefinition>;
    hooks?: {
        PreToolUse?: HookDefinition[];
        PostToolUse?: HookDefinition[];
    };
}
export declare const BUILTIN_PROVIDERS: Record<string, Partial<ProviderConfig>>;
export declare function loadGlobalSettings(): Promise<Settings>;
export declare function saveGlobalSettings(settings: Settings): Promise<void>;
export declare function loadProjectSkills(workspacePath: string): Record<string, SkillDefinition> | null;
export declare function loadProjectHooks(workspacePath: string): Settings['hooks'] | null;
export declare function loadEffectiveSettings(workspacePath: string): Promise<Settings>;
export declare function getProviderConfig(providerName?: string): Promise<ProviderConfig>;
export declare function setProviderConfig(name: string, apiKey: string, baseUrl?: string, model?: string): Promise<void>;
export declare function listProviders(): Promise<string[]>;
export declare function setDefaultProvider(name: string): Promise<void>;
//# sourceMappingURL=settings.d.ts.map