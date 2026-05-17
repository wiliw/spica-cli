// ANSI TUI Input Box
// 独立输入框，支持多行编辑和粘贴

import { LAIN_COLORS } from './colors';

const ESC = '\x1b';

export class InputBox {
  private buffer: string[] = [''];  // 多行缓冲区
  private cursorRow: number = 0;    // 光标行号（缓冲区内）
  private cursorCol: number = 0;    // 光标列号
  private maxRows: number = 5;      // 最大显示行数
  private inputAreaStart: number = 0; // 输入区起始行（终端行号）
  private terminalHeight: number = 24;

  constructor() {
    this.updateTerminalSize();
  }

  private updateTerminalSize(): void {
    this.terminalHeight = process.stdout.rows || 24;
    this.inputAreaStart = this.terminalHeight - this.maxRows - 1;
  }

  // 启用备用屏幕缓冲区（全屏模式）
  enableAltScreen(): void {
    process.stdout.write(`${ESC}[?1049h`);
  }

  // 禁用备用屏幕缓冲区
  disableAltScreen(): void {
    process.stdout.write(`${ESC}[?1049l`);
  }

  // 设置滚动区域（上方为输出区，下方为输入区）
  setupScrollRegion(): void {
    this.updateTerminalSize();
    // 滚动区域：第1行到 inputAreaStart 行
    process.stdout.write(`${ESC}[1;${this.inputAreaStart}r`);
    // 光标移到滚动区域顶部
    process.stdout.write(`${ESC}[1;1H`);
  }

  // 重置滚动区域（整个屏幕）
  resetScrollRegion(): void {
    process.stdout.write(`${ESC}[r`);
  }

  // 清除输入区
  clearInputArea(): void {
    for (let i = 0; i <= this.maxRows; i++) {
      process.stdout.write(`${ESC}[${this.inputAreaStart + i};1H`);
      process.stdout.write(`${ESC}[2K`);
    }
  }

  // 渲染输入框
  render(): void {
    this.updateTerminalSize();
    this.clearInputArea();

    // 绘制分隔线
    process.stdout.write(`${ESC}[${this.inputAreaStart};1H`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(process.stdout.columns || 80)));

    // 绘制提示符和内容
    const prompt = LAIN_COLORS.primary('> ');
    for (let i = 0; i < Math.min(this.buffer.length, this.maxRows); i++) {
      const row = this.inputAreaStart + 1 + i;
      process.stdout.write(`${ESC}[${row};1H`);
      process.stdout.write(`${ESC}[2K`);
      if (i === 0) {
        process.stdout.write(prompt);
      } else {
        process.stdout.write('  '); // 续行缩进
      }
      process.stdout.write(this.buffer[i] || '');
    }

    // 定位光标
    const displayRow = Math.min(this.cursorRow, this.maxRows - 1);
    const actualRow = this.inputAreaStart + 1 + displayRow;
    const promptOffset = this.cursorRow === 0 ? 2 : 2; // '>' 占2字符
    const actualCol = promptOffset + this.cursorCol + 1;
    process.stdout.write(`${ESC}[${actualRow};${actualCol}H`);
  }

  // 处理输入
  handleInput(data: string): boolean {
    // 返回 true 表示应该发送内容（Enter）
    // 返回 false 表示继续编辑

    // 检测特殊按键
    if (data === '\r' || data === '\n') {
      // Enter - 发送
      return true;
    }

    if (data === '\x7f' || data === '\b') {
      // Backspace
      this.backspace();
      return false;
    }

    if (data.startsWith(`${ESC}[`)) {
      // 方向键等 ANSI 序列
      this.handleAnsiSequence(data);
      return false;
    }

    // 检测粘贴序列
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }

    // 普通字符输入
    this.insertChar(data);
    return false;
  }

  private handleAnsiSequence(seq: string): void {
    if (seq === `${ESC}[A`) {
      // 上箭头
      if (this.cursorRow > 0) {
        this.cursorRow--;
        this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
      }
    } else if (seq === `${ESC}[B`) {
      // 下箭头
      if (this.cursorRow < this.buffer.length - 1) {
        this.cursorRow++;
        this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
      }
    } else if (seq === `${ESC}[C`) {
      // 右箭头
      if (this.cursorCol < this.buffer[this.cursorRow].length) {
        this.cursorCol++;
      }
    } else if (seq === `${ESC}[D`) {
      // 左箭头
      if (this.cursorCol > 0) {
        this.cursorCol--;
      }
    } else if (seq === `${ESC}[3~`) {
      // Delete
      this.deleteChar();
    }
  }

  private handlePaste(data: string): void {
    // 提取粘贴内容
    let content = data;
    // 去除粘贴序列标记
    content = content.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (content.trim()) {
      // 在光标位置插入
      this.insertText(content);

      // 显示粘贴信息
      const lines = content.split('\n');
      const chars = content.length;
      // 简单提示（短暂显示）
      const msg = LAIN_COLORS.muted(`[PASTE] ${chars} chars, ${lines.length} lines`);
      // 在输入区上方临时显示
      process.stdout.write(`${ESC}[${this.inputAreaStart - 1};1H`);
      process.stdout.write(`${ESC}[2K`);
      process.stdout.write(msg);
      // 2秒后清除
      setTimeout(() => {
        process.stdout.write(`${ESC}[${this.inputAreaStart - 1};1H`);
        process.stdout.write(`${ESC}[2K`);
        this.render();
      }, 2000);
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
      // 单行
      this.buffer[this.cursorRow] = firstPart + lines[0] + lastPart;
      this.cursorCol += lines[0].length;
    } else {
      // 多行
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
      // 合并到上一行
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
      // 合并下一行
      const nextLine = this.buffer[this.cursorRow + 1];
      this.buffer.splice(this.cursorRow + 1, 1);
      this.buffer[this.cursorRow] += nextLine;
    }
  }

  // 获取内容
  getContent(): string {
    return this.buffer.join('\n');
  }

  // 清空
  clear(): void {
    this.buffer = [''];
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  // 移动光标到输出区（用于打印输出）
  moveToOutputArea(): void {
    process.stdout.write(`${ESC}[${this.inputAreaStart};1H`);
  }

  // 在输出区打印
  printToOutput(text: string): void {
    // 保存当前光标位置
    process.stdout.write(`${ESC}[s`);
    // 移到输出区底部
    process.stdout.write(`${ESC}[${this.inputAreaStart - 1};1H`);
    // 打印
    process.stdout.write(text + '\n');
    // 恢复光标
    process.stdout.write(`${ESC}[u`);
  }
}