import { ToolCall } from './providers/BaseProvider';
import { ToolResult } from '../tools/index';
export type ToolExecutor = (name: string, args: Record<string, any>) => Promise<ToolResult>;
export declare class FunctionCaller {
    private toolExecutors;
    RegisterTool(name: string, executor: ToolExecutor): void;
    RegisterMultiple(tools: Record<string, ToolExecutor>): void;
    Execute(toolCall: ToolCall): Promise<ToolResult>;
    ExecuteMultiple(toolCalls: ToolCall[]): Promise<ToolResult[]>;
    hasTool(name: string): boolean;
    getRegisteredTools(): string[];
}
//# sourceMappingURL=FunctionCaller.d.ts.map