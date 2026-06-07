/**
 * ScrollbackBuffer - 终端历史缓冲区
 *
 * 用于保存终端输出历史，在resize后可以重新渲染
 * 限制最大行数，防止内存溢出
 */

export class ScrollbackBuffer {
  private buffer: string[] = [];
  private maxLines: number;

  constructor(maxLines: number = 500) {
    this.maxLines = maxLines;
  }

  /**
   * 添加文本到缓冲区
   * 按行分割，每行单独保存
   */
  append(text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      this.buffer.push(line);
      // 超过限制时删除最旧的行
      if (this.buffer.length > this.maxLines) {
        this.buffer.shift();
      }
    }
  }

  /**
   * 获取所有行
   */
  getLines(): string[] {
    return [...this.buffer];
  }

  /**
   * 获取最后N行
   */
  getLastNLines(n: number): string[] {
    if (n <= 0) return [];
    return this.buffer.slice(-n);
  }

  /**
   * 获取总行数
   */
  getLineCount(): number {
    return this.buffer.length;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * 设置最大行数
   */
  setMaxLines(max: number): void {
    this.maxLines = max;
    // 如果当前超过新限制，删除多余的行
    while (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
  }
}

// 单例模式，方便在screenManager中使用
let scrollbackInstance: ScrollbackBuffer | null = null;

export function getScrollbackBuffer(maxLines: number = 500): ScrollbackBuffer {
  if (!scrollbackInstance) {
    scrollbackInstance = new ScrollbackBuffer(maxLines);
  }
  return scrollbackInstance;
}