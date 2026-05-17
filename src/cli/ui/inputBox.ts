// Input Box - 正确使用滚动区域

import { LAIN_COLORS } from './colors';

const ESC = '\x1b';

export class InputBox {
  private buffer: string[] = [''];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private maxInputRows: number = 2;
  private statusRow: number = 0;    // 状态栏行
  private separatorRow: number = 0; // 分隔线行
  private inputRow: number = 0;     // 输入行
  private scrollBottom: number = 0; // 滚动区域底部
  private terminalHeight: number = 24;
  private terminalWidth: number = 80;

  constructor() {
    this.updateTerminalSize();
  }

  private updateTerminalSize(): void {
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;

    // 计算位置（从底部往上）
    // 底部3行：状态栏、分隔线、输入区
    this.statusRow = this.terminalHeight - 2;
    this.separatorRow = this.terminalHeight - 1;
    this.inputRow = this.terminalHeight;  // 最底部
    this.scrollBottom = this.terminalHeight - 3;  // 滚动区域底部
  }

  // 启动：设置滚动区域
  start(): void {
    this.updateTerminalSize();

    // 1. 设置滚动区域（行1 到 scrollBottom）
    process.stdout.write(`${ESC}[1;${this.scrollBottom}r`);

    // 2. 清除屏幕并移到滚动区域顶部
    process.stdout.write(`${ESC}[2J${ESC}[1;1H`);

    // 3. 初始渲染输入区
    this.renderFixedArea();
  }

  // 结束：重置滚动区域
  end(): void {
    process.stdout.write(`${ESC}[r`);  // 重置为全屏滚动
    process.stdout.write(`${ESC}[2J${ESC}[1;1H`);  // 清屏
  }

  // 移动光标到滚动区域底部（准备输出）
  moveToScrollArea(): void {
    // 光标移到滚动区域最后一行
    process.stdout.write(`${ESC}[${this.scrollBottom};1H`);
  }

  // 计算字符串的显示宽度（中文=2，英文=1）
  private getStringWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      // 中文和全角字符宽度为2
      const code = char.charCodeAt(0);
      if (code > 0x7F) {
        // CJK字符、全角字符等宽度为2
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  // 渲染固定区域（状态栏、分隔线、输入框）
  renderFixedArea(): void {
    // 清除状态栏
    process.stdout.write(`${ESC}[${this.statusRow};1H${ESC}[2K`);

    // 清除并写入分隔线
    process.stdout.write(`${ESC}[${this.separatorRow};1H${ESC}[2K`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(this.terminalWidth)));

    // 输入区
    process.stdout.write(`${ESC}[${this.inputRow};1H${ESC}[2K`);
    const fullContent = this.buffer[this.cursorRow] || '';
    const maxDisplayWidth = this.terminalWidth - 3;  // 减去 "> " 的宽度

    // 从末尾截取，保证显示宽度不超限
    let displayContent = '';
    let displayWidth = 0;
    for (let i = fullContent.length - 1; i >= 0 && displayWidth < maxDisplayWidth; i--) {
      const charWidth = this.getStringWidth(fullContent[i]);
      if (displayWidth + charWidth <= maxDisplayWidth) {
        displayContent = fullContent[i] + displayContent;
        displayWidth += charWidth;
      } else {
        break;
      }
    }

    process.stdout.write(LAIN_COLORS.primary('> ') + displayContent);

    // 光标位置：计算光标前内容的显示宽度
    const contentBeforeCursor = fullContent.slice(0, this.cursorCol);
    const cursorDisplayWidth = this.getStringWidth(contentBeforeCursor);

    // 如果内容被截断（光标在截断部分），光标在显示末尾
    const actualCursorCol = fullContent.length > displayContent.length
      ? displayWidth  // 内容被截断，光标在末尾
      : cursorDisplayWidth;  // 内容未截断，光标在原位置

    process.stdout.write(`${ESC}[${this.inputRow};${actualCursorCol + 3}H`);
  }

  // 显示状态
  showStatus(status: string): void {
    process.stdout.write(`${ESC}[${this.statusRow};1H${ESC}[2K`);
    process.stdout.write(LAIN_COLORS.muted(status));
    this.renderFixedArea();
  }

  // 处理输入
  handleInput(data: string): boolean {
    if (data === '\r' || data === '\n') {
      return true;
    }

    if (data === '\x7f' || data === '\b') {
      this.backspace();
      return false;
    }

    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }

    // 粘贴
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }

    this.insert(data);
    return false;
  }

  private handleAnsi(seq: string): void {
    if (seq === `${ESC}[A`) {  // 上
      // 可扩展：历史记录
    } else if (seq === `${ESC}[B`) {  // 下
    } else if (seq === `${ESC}[C`) {  // 右
      if (this.cursorCol < this.buffer[this.cursorRow].length) {
        this.cursorCol++;
      }
    } else if (seq === `${ESC}[D`) {  // 左
      if (this.cursorCol > 0) {
        this.cursorCol--;
      }
    } else if (seq === `${ESC}[3~`) {  // Delete
      this.delete();
    }
  }

  private handlePaste(data: string): void {
    const content = data
      .replace(/\x1b\[200~/g, '')
      .replace(/\x1b\[201~/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    if (content.trim()) {
      this.insert(content);
    }
  }

  private insert(text: string): void {
    const line = this.buffer[this.cursorRow];
    this.buffer[this.cursorRow] = line.slice(0, this.cursorCol) + text + line.slice(this.cursorCol);
    this.cursorCol += text.length;
  }

  private backspace(): void {
    if (this.cursorCol > 0) {
      const line = this.buffer[this.cursorRow];
      this.buffer[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol--;
    }
  }

  private delete(): void {
    const line = this.buffer[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.buffer[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
    }
  }

  getContent(): string {
    return this.buffer.join('\n');
  }

  clear(): void {
    this.buffer = [''];
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  // 渲染（只更新输入区）
  render(): void {
    this.renderFixedArea();
  }
}