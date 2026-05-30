export interface ProjectConfig {
    type?: string;
    language?: string;
    framework?: string;
    commands?: {
        build?: string;
        test?: string;
        dev?: string;
        lint?: string;
    };
    constraints?: string[];
    devTips?: string[];
    testingInstructions?: string;
    prInstructions?: string;
    codeStyle?: string[];
    rawContent?: string;
}
export declare function loadProjectConfig(workspace: string): ProjectConfig | null;
export declare function autoDetectProject(workspace: string): ProjectConfig;
export declare function generateAgentsMd(config: ProjectConfig): string;
export declare function createAgentsMd(workspace: string): Promise<string>;
//# sourceMappingURL=projectConfig.d.ts.map