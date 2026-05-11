import { ToolCall } from '../llm/providers/BaseProvider';
export interface ParsedResponse {
    content: string;
    toolCalls: ToolCall[];
    actions: Action[];
    errors: string[];
}
export interface Action {
    type: 'file_write' | 'file_read' | 'file_edit' | 'bash' | 'git' | 'test';
    params: Record<string, any>;
    reasoning?: string;
}
export declare class ResponseParser {
    parse(response: string): ParsedResponse;
    parseToolCalls(toolCalls: ToolCall[]): Action[];
    private toolCallToAction;
    private extractActions;
    private extractErrors;
    extractIntent(response: string): string | null;
    extractQuestions(response: string): string[];
    extractCodeBlocks(response: string): {
        language: string;
        code: string;
    }[];
    extractFilePaths(response: string): string[];
}
//# sourceMappingURL=ResponseParser.d.ts.map