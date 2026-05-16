export class TokenCounter {
  private static readonly AVERAGE_CHARS_PER_TOKEN = 4;
  private contextWindow: number = 128000;  // 默认值，可动态设置

  setContextWindow(size: number): void {
    this.contextWindow = size;
  }

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
    return used + responseTokens <= this.contextWindow;
  }

  getRemainingTokens(messages: { role: string; content: string }[], responseTokens: number = 4096): number {
    const used = this.estimateMessages(messages);
    return Math.max(0, this.contextWindow - used - responseTokens);
  }

  truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * TokenCounter.AVERAGE_CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }
}