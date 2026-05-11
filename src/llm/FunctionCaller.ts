import { ToolCall } from './providers/BaseProvider';
import { ToolResult } from '../tools/index';

export type ToolExecutor = (name: string, args: Record<string, any>) => Promise<ToolResult>;

export class FunctionCaller {
  private toolExecutors: Map<string, ToolExecutor> = new Map();

  RegisterTool(name: string, executor: ToolExecutor): void {
    this.toolExecutors.set(name, executor);
  }

  RegisterMultiple(tools: Record<string, ToolExecutor>): void {
    for (const [name, executor] of Object.entries(tools)) {
      this.toolExecutors.set(name, executor);
    }
  }

  async Execute(toolCall: ToolCall): Promise<ToolResult> {
    const executor = this.toolExecutors.get(toolCall.name);
    if (!executor) {
      return {
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
      };
    }

    try {
      return await executor(toolCall.name, toolCall.arguments);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  async ExecuteMultiple(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map(tc => this.Execute(tc)));
  }

  hasTool(name: string): boolean {
    return this.toolExecutors.has(name);
  }

  getRegisteredTools(): string[] {
    return Array.from(this.toolExecutors.keys());
  }
}