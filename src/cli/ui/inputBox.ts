// ANSI Input Box - 简化版
// 固定在底部，不使用滚动区域

import { LAIN_COLORS } from './colors';

const ESC = '\x1b';

export class InputBox {
  private buffer: string[] = [''];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private maxRows: number = 3;
  private terminalHeight: number = 24;
  private terminalWidth: number = 80;

  constructor() {
    this.updateTerminalSize();
  }

  private updateTerminalSize(): void {
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;
  }

  // 渲染输入框（固定在底部）
  render(): void {
    this.updateTerminalSize();

    // 输入框起始行（底部预留空间）
    const startRow = this.terminalHeight - this.maxRows;

    // 清除输入区并绘制分隔线
    for (let i = startRow; i <= this.terminalHeight; i++) {
      process.stdout.write(`${ESC}[${i};1H${ESC}[2K`);
    }

    // 分隔线
    process.stdout.write(`${ESC}[${startRow};1H`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(this.terminalWidth)));

    // 输入内容
    for (let i = 0; i < Math.min(this.buffer.length, this.maxRows); i++) {
      const row = startRow + 1 + i;
      process.stdout.write(`${ESC}[${row};1H`);
      if (i === 0) {
        process.stdout.write(LAIN_COLORS.primary('> ') + this.buffer[i]);
      } else {
        process.stdout.write('  ' + this.buffer[i]);
      }
    }

    // 光标定位
    const displayRow = Math.min(this.cursorRow, this.maxRows - 1);
    const actualRow = startRow + 1 + displayRow;
    const colOffset = (this.cursorRow === 0 ? 3 : 2) + this.cursorCol;
    process.stdout.write(`${ESC}[${actualRow};${colOffset}H`);
  }

  // 清除输入框区域（让输出可以打印）
  clearForOutput(): void {
    this.updateTerminalSize();
    const startRow = this.terminalHeight - this.maxRows;
    for (let i = startRow; i <= this.terminalHeight; i++) {
      process.stdout.write(`${ESC}[${i};1H${ESC}[2K`);
    }
    // 移动光标到清除区上方，让输出从这里开始
    process.stdout.write(`${ESC}[${startRow - 1};1H`);
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

    if (data.startsWith(`${ESC}[`)) {
      this.handleAnsiSequence(data);
      return false;
    }

    // 粘贴
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }

    this.insertChar(data);
    return false;
  }

  private handleAnsiSequence(seq: string): void {
    if (seq === `${ESC}[A` && this.cursorRow > 0) {
      this.cursorRow--;
      this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
    } else if (seq === `${ESC}[B` && this.cursorRow < this.buffer.length - 1) {
      this.cursorRow++;
      this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
    } else if (seq === `${ESC}[C` && this.cursorCol < this.buffer[this.cursorRow].length) {
      this.cursorCol++;
    } else if (seq === `${ESC}[D` && this.cursorCol > 0) {
      this.cursorCol--;
    } else if (seq === `${ESC}[3~`) {
      this.deleteChar();
    }
  }

  private handlePaste(data: string): void {
    let content = data
      .replace(/\x1b\[200~/g, '')
      .replace(/\x1b\[201~/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    if (content.trim()) {
      this.insertText(content);
      // 简短提示
      const msg = LAIN_COLORS.muted(`[PASTE ${content.length}c/${content.split('\n').length}l]`);
      process.stdout.write(`${ESC}[${this.terminalHeight - this.maxRows - 1};1H${ESC}[2K${msg}`);
    }
  }

  private insertChar(ch: string): void {
    const line = this.buffer[this.cursorRow];
    this.buffer[this.cursorRow] = line.slice(0, this.cursorCol) + ch + line.slice(this.cursorCol);
    this.cursorCol += ch.length;
  }

  private insertText(text: string): void {
    const lines = text.split('\n');
    const firstPart = this.buffer[this.cursorRow].slice(0, this.cursorCol);
    const lastPart = this.buffer[this.cursorRow].slice(this.cursorCol);

    if (lines.length === 1) {
      this.buffer[this.cursorRow] = firstPart + lines[0] + lastPart;
      this.cursorCol += lines[0].length;
    } else {
      this.buffer[this.cursorRow] = firstPart + lines[0];
      for (let i = 1; i < lines.length - 1; i++) {
        this.buffer.splice(this.cursorRow + i, 0, lines[i]);
      }
      this.buffer.splice(this.cursorRow + lines.length - 1, 0, lines[lines.length - 1] + lastPart);
      this.cursorRow += lines.length - 1;
      this.cursorCol = lines[lines.length - 1].length;
    }
  }

  private backspace(): void {
    if (this.cursorCol > 0) {
      const line = this.buffer[this.cursorRow];
      this.buffer[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol--;
    } else if (this.cursorRow > 0) {
      const currentLine = this.buffer[this.cursorRow];
      this.buffer.splice(this.cursorRow, 1);
      this.cursorRow--;
      this.cursorCol = this.buffer[this.cursorRow].length;
      this.buffer[this.cursorRow] += currentLine;
    }
  }

  private deleteChar(): void {
    const line = this.buffer[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.buffer[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
    } else if (this.cursorRow < this.buffer.length - 1) {
      this.buffer[this.cursorRow] += this.buffer[this.cursorRow + 1];
      this.buffer.splice(this.cursorRow + 1, 1);
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

  // 输出到stdout（自然滚动）
  print(text: string): void {
    // 先清除输入区
    this.clearForOutput();
    // 打印内容
    process.stdout.write(text);
    // 重新渲染输入框
    this.render();
  }
}