// ANSI Input Box - 使用滚动区域固定输入框

import { LAIN_COLORS } from './colors';

const ESC = '\x1b';

export class InputBox {
  private buffer: string[] = [''];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private maxRows: number = 3;
  private terminalHeight: number = 24;
  private terminalWidth: number = 80;
  private inputStartRow: number = 0;

  constructor() {
    this.updateTerminalSize();
  }

  private updateTerminalSize(): void {
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;
    this.inputStartRow = this.terminalHeight - this.maxRows;
  }

  // 启动：设置滚动区域
  start(): void {
    this.updateTerminalSize();
    // 滚动区域：第1行 到 inputStartRow-1
    // 输入区域：inputStartRow 到 terminalHeight（不滚动）
    process.stdout.write(`${ESC}[1;${this.inputStartRow - 1}r`);
    // 光标移到滚动区域顶部
    process.stdout.write(`${ESC}[1;1H`);
    // 初始渲染输入框
    this.render();
  }

  // 结束：重置滚动区域
  end(): void {
    process.stdout.write(`${ESC}[r`); // 重置滚动区域为整个屏幕
  }

  // 渲染输入框（固定在底部）
  render(): void {
    // 保存当前光标位置
    process.stdout.write(`${ESC}[s`);

    // 绘制分隔线
    process.stdout.write(`${ESC}[${this.inputStartRow};1H`);
    process.stdout.write(`${ESC}[2K`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(this.terminalWidth)));

    // 绘制输入内容（处理换行）
    const promptWidth = 2; // '> ' 的宽度
    const maxWidth = this.terminalWidth - promptWidth - 1;

    let displayLines: string[] = [];
    for (let i = 0; i < this.buffer.length; i++) {
      const line = this.buffer[i];
      if (line.length <= maxWidth) {
        displayLines.push(line);
      } else {
        // 分割长行
        for (let j = 0; j < line.length; j += maxWidth) {
          displayLines.push(line.slice(j, j + maxWidth));
        }
      }
    }

    // 只显示最后 maxRows 行
    const visibleLines = displayLines.slice(-this.maxRows);

    for (let i = 0; i < this.maxRows; i++) {
      const row = this.inputStartRow + 1 + i;
      process.stdout.write(`${ESC}[${row};1H`);
      process.stdout.write(`${ESC}[2K`);

      if (i < visibleLines.length) {
        if (i === 0 && displayLines.length <= this.maxRows) {
          process.stdout.write(LAIN_COLORS.primary('> ') + visibleLines[i]);
        } else {
          process.stdout.write('  ' + visibleLines[i]);
        }
      }
    }

    // 光标定位
    // 计算光标在显示中的位置
    const cursorDisplayPos = this.calculateCursorDisplayPosition(maxWidth);
    const displayRow = Math.min(cursorDisplayPos.row, this.maxRows - 1);
    const actualRow = this.inputStartRow + 1 + displayRow;
    const colOffset = (displayRow === 0 && displayLines.length <= this.maxRows ? 3 : 2) + cursorDisplayPos.col;
    process.stdout.write(`${ESC}[${actualRow};${colOffset}H`);
  }

  // 计算光标在显示中的位置（考虑换行）
  private calculateCursorDisplayPosition(maxWidth: number): { row: number; col: number } {
    let row = 0;
    let col = 0;

    for (let i = 0; i < this.cursorRow; i++) {
      const line = this.buffer[i];
      row += Math.ceil(line.length / maxWidth) || 1;
    }

    const currentLine = this.buffer[this.cursorRow];
    col = this.cursorCol % maxWidth;
    row += Math.floor(this.cursorCol / maxWidth);

    return { row, col };
  }

  // 显示状态栏（在分隔线上方）
  showStatus(status: string): void {
    const statusRow = this.inputStartRow - 1;
    process.stdout.write(`${ESC}[${statusRow};1H`);
    process.stdout.write(`${ESC}[2K`);
    process.stdout.write(LAIN_COLORS.muted(status));
    // 重绘输入框
    this.render();
  }

  // 输出时：光标移到滚动区域
  moveToScrollArea(): void {
    process.stdout.write(`${ESC}[${this.inputStartRow - 1};1H`);
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
      const lines = content.split('\n');
      // 显示粘贴提示（在输入区上方一行）
      process.stdout.write(`${ESC}[s`);
      process.stdout.write(`${ESC}[${this.inputStartRow - 1};1H`);
      process.stdout.write(`${ESC}[2K`);
      process.stdout.write(LAIN_COLORS.muted(`[PASTE ${content.length} chars, ${lines.length} lines]`));
      process.stdout.write(`${ESC}[u`);
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
}