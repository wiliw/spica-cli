export type SubAgentType = 'explore' | 'review' | 'fix' | 'build';
export interface SubAgentResult {
    status: 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';
    output?: string;
    concerns?: string[];
    neededContext?: string[];
    blocker?: string;
    success: boolean;
}
export interface SubAgentTask {
    prompt: string;
    description?: string;
    type?: SubAgentType;
    skill?: string;
}
export interface SubAgentConfig {
    allowedTools: string[] | '*';
    timeout: number;
    description: string;
}
export declare const SUB_AGENT_CONFIGS: Record<SubAgentType, SubAgentConfig>;
export declare function getSubAgentConfig(type?: SubAgentType): SubAgentConfig;
export declare function isToolAllowed(toolName: string, config: SubAgentConfig): boolean;
export declare function summarizeResult(result: string, maxLength?: number): string;
//# sourceMappingURL=subAgent.d.ts.map