export class TokenCounter {
  private static readonly AVERAGE_CHARS_PER_TOKEN = 4;
  private static readonly MAX_CONTEXT_WINDOW = 128000;

  estimateTokens(text: string): number {
    return Math.ceil(text.length / TokenCounter.AVERAGE_CHARS_PER_TOKEN);
  }

  estimateMessages(messages: { role: string; content: string }[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateTokens(msg.role) + this.estimateTokens(msg.content);
      total += 4;
    }
    total += 2;
    return total;
  }

  canFitInContext(messages: { role: string; content: string }[], responseTokens: number = 4096): boolean {
    const used = this.estimateMessages(messages);
    return used + responseTokens <= TokenCounter.MAX_CONTEXT_WINDOW;
  }

  getRemainingTokens(messages: { role: string; content: string }[], responseTokens: number = 4096): number {
    const used = this.estimateMessages(messages);
    return Math.max(0, TokenCounter.MAX_CONTEXT_WINDOW - used - responseTokens);
  }

  truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * TokenCounter.AVERAGE_CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }
}