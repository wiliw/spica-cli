import { HookDefinition, HookMatcher, HookResult } from '../utils/settings';
export type { HookMatcher, HookDefinition, HookResult };
export interface HooksConfig {
    hooks: {
        PreToolUse?: HookDefinition[];
        PostToolUse?: HookDefinition[];
    };
}
export declare function loadHooks(workspacePath?: string): HooksConfig;
export declare function runPreHooks(toolName: string, args: Record<string, any>): HookResult;
export declare function runPostHooks(toolName: string, args: Record<string, any>, result: any): string | null;
//# sourceMappingURL=index.d.ts.map