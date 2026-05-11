export declare class TokenCounter {
    private static readonly AVERAGE_CHARS_PER_TOKEN;
    private static readonly MAX_CONTEXT_WINDOW;
    estimateTokens(text: string): number;
    estimateMessages(messages: {
        role: string;
        content: string;
    }[]): number;
    canFitInContext(messages: {
        role: string;
        content: string;
    }[], responseTokens?: number): boolean;
    getRemainingTokens(messages: {
        role: string;
        content: string;
    }[], responseTokens?: number): number;
    truncateToFit(text: string, maxTokens: number): string;
}
//# sourceMappingURL=TokenCounter.d.ts.map