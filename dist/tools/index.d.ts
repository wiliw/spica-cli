export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
}
export declare const TOOLS_DEFINITIONS: ToolDefinition[];
export declare function executeTool(name: string, args: Record<string, any>): Promise<ToolResult>;
//# sourceMappingURL=index.d.ts.map