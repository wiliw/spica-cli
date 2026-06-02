export class TokenCounter {
  private static readonly AVERAGE_CHARS_PER_TOKEN = 4;
  private static readonly CJK_CHARS_PER_TOKEN = 1.5;
  private static readonly CODE_CHARS_PER_TOKEN = 3;
  private contextWindow: number = 128000;  // 默认值，可动态设置

  setContextWindow(size: number): void {
    this.contextWindow = size;
  }

  getContextWindow(): number {
    return this.contextWindow;
  }

  private detectContentType(text: string): 'cjk' | 'code' | 'prose' {
    let cjkCount = 0;
    let codeIndicators = 0;

    for (const char of text) {
      const code = char.charCodeAt(0);
      // CJK Unified Ideographs, Hiragana, Katakana, Hangul
      if (
        (code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3040 && code <= 0x309F) ||
        (code >= 0x30A0 && code <= 0x30FF) ||
        (code >= 0xAC00 && code <= 0xD7AF)
      ) {
        cjkCount++;
      }
    }

    // Code indicators: braces, semicolons, arrows, dots
    const codePatterns = /[{}();=><[\].]/g;
    const codeMatches = text.match(codePatterns);
    if (codeMatches) codeIndicators = codeMatches.length;

    if (cjkCount > text.length * 0.3) return 'cjk';
    if (codeIndicators > text.length * 0.05) return 'code';
    return 'prose';
  }

  estimateTokens(text: string): number {
    const type = this.detectContentType(text);
    const charsPerToken =
      type === 'cjk' ? TokenCounter.CJK_CHARS_PER_TOKEN :
      type === 'code' ? TokenCounter.CODE_CHARS_PER_TOKEN :
      TokenCounter.AVERAGE_CHARS_PER_TOKEN;
    return Math.ceil(text.length / charsPerToken);
  }

  // 估算单条消息的 tokens（包括 toolCalls 等结构）
  estimateMessage(msg: { role: string; content: string; toolCalls?: any[]; toolCallId?: string }): number {
    let total = this.estimateTokens(msg.role);
    total += this.estimateTokens(msg.content || '');
    total += 4;  // 消息结构开销

    // 计算 toolCalls
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        total += this.estimateTokens(tc.name || '');
        total += this.estimateTokens(tc.id || '');
        total += this.estimateTokens(JSON.stringify(tc.arguments || {}));
        total += 10;  // toolCall 结构开销
      }
    }

    // 计算 toolCallId
    if (msg.toolCallId) {
      total += this.estimateTokens(msg.toolCallId);
    }

    return total;
  }

  estimateMessages(messages: { role: string; content: string; toolCalls?: any[]; toolCallId?: string }[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateMessage(msg);
    }
    total += 3;  // 消息数组开销
    return total;
  }

  canFitInContext(messages: { role: string; content: string; toolCalls?: any[]; toolCallId?: string }[], responseTokens: number = 4096): boolean {
    const used = this.estimateMessages(messages);
    return used + responseTokens <= this.contextWindow;
  }

  getRemainingTokens(messages: { role: string; content: string; toolCalls?: any[]; toolCallId?: string }[], responseTokens: number = 4096): number {
    const used = this.estimateMessages(messages);
    return Math.max(0, this.contextWindow - used - responseTokens);
  }

  truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * TokenCounter.AVERAGE_CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }
}