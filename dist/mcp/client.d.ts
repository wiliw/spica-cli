import { EventEmitter } from 'events';
import { MCPServerConfig } from '../utils/settings';
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface MCPConfig {
    servers: MCPServerConfig[];
}
export declare class MCPManager extends EventEmitter {
    private clients;
    private tools;
    constructor();
    loadConfig(): Promise<MCPConfig>;
    connectAll(): Promise<void>;
    connectServer(config: MCPServerConfig): Promise<void>;
    getToolDefinitions(): MCPTool[];
    callTool(fullName: string, args: Record<string, any>): Promise<{
        success: boolean;
        output: string;
        error?: string;
    }>;
    disconnectAll(): Promise<void>;
    listConnectedServers(): string[];
    listAvailableTools(): string[];
    hasTool(name: string): boolean;
}
export declare function getMCPManager(): MCPManager;
export declare function initMCP(): Promise<void>;
export declare function shutdownMCP(): Promise<void>;
export declare function generateExampleConfig(): MCPConfig;
export declare function saveExampleConfig(): Promise<void>;
//# sourceMappingURL=client.d.ts.map