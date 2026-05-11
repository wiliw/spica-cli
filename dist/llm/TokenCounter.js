export class TokenCounter {
    static AVERAGE_CHARS_PER_TOKEN = 4;
    static MAX_CONTEXT_WINDOW = 128000;
    estimateTokens(text) {
        return Math.ceil(text.length / TokenCounter.AVERAGE_CHARS_PER_TOKEN);
    }
    estimateMessages(messages) {
        let total = 0;
        for (const msg of messages) {
            total += this.estimateTokens(msg.role) + this.estimateTokens(msg.content);
            total += 4;
        }
        total += 2;
        return total;
    }
    canFitInContext(messages, responseTokens = 4096) {
        const used = this.estimateMessages(messages);
        return used + responseTokens <= TokenCounter.MAX_CONTEXT_WINDOW;
    }
    getRemainingTokens(messages, responseTokens = 4096) {
        const used = this.estimateMessages(messages);
        return Math.max(0, TokenCounter.MAX_CONTEXT_WINDOW - used - responseTokens);
    }
    truncateToFit(text, maxTokens) {
        const maxChars = maxTokens * TokenCounter.AVERAGE_CHARS_PER_TOKEN;
        if (text.length <= maxChars)
            return text;
        return text.slice(0, maxChars - 3) + '...';
    }
}
//# sourceMappingURL=TokenCounter.js.map