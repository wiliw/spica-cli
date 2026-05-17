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

  // 渲染固定区域（状态栏、分隔线、输入框）
  renderFixedArea(): void {
    // 清除并写入状态栏
    process.stdout.write(`${ESC}[${this.statusRow};1H${ESC}[2K`);

    // 清除并写入分隔线
    process.stdout.write(`${ESC}[${this.separatorRow};1H${ESC}[2K`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(this.terminalWidth)));

    // 清除并写入输入区
    process.stdout.write(`${ESC}[${this.inputRow};1H${ESC}[2K`);
    const displayContent = this.buffer.join('\n').slice(-this.terminalWidth + 3);  // 限制宽度
    process.stdout.write(LAIN_COLORS.primary('> ') + displayContent);

    // 光标定位到输入位置
    const cursorDisplayCol = Math.min(this.cursorCol, this.terminalWidth - 4);
    process.stdout.write(`${ESC}[${this.inputRow};${cursorDisplayCol + 3}H`);
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