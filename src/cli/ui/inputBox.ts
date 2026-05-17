// Input Box - 正确使用滚动区域，支持多行输入

import { LAIN_COLORS } from './colors';
import { getOutputCoordinator } from './outputCoordinator';

const ESC = '\x1b';

export class InputBox {
  private buffer: string[] = [''];  // 多行缓冲
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private statusRow: number = 0;
  private separatorRow: number = 0;
  private inputStartRow: number = 0;  // 输入区起始行
  private maxInputRows: number = 3;   // 最大显示3行
  private scrollBottom: number = 0;
  private terminalHeight: number = 24;
  private terminalWidth: number = 80;
  private completer: ((line: string) => string[]) | null = null;
  private shownCompletionList: boolean = false;
  private lastCompletionLine: string = '';
  private coordinator = getOutputCoordinator();

  constructor() {
    this.updateTerminalSize();
  }

  private updateTerminalSize(): void {
    this.terminalHeight = process.stdout.rows || 24;
    this.terminalWidth = process.stdout.columns || 80;

    // 计算位置（从底部往上）
    // 底部区域：状态栏(1行) + 分隔线(1行) + 输入区(maxInputRows行)
    this.statusRow = this.terminalHeight - this.maxInputRows - 2;
    this.separatorRow = this.terminalHeight - this.maxInputRows - 1;
    this.inputStartRow = this.terminalHeight - this.maxInputRows;
    this.scrollBottom = this.statusRow - 1;  // 滚动区域底部在状态栏上方
  }

  // 设置补全函数
  setCompleter(completer: (line: string) => string[]): void {
    this.completer = completer;
  }

  // 启动：设置滚动区域
  start(): void {
    this.updateTerminalSize();

    // 设置滚动区域（行1 到 scrollBottom）
    this.coordinator.write(`${ESC}[1;${this.scrollBottom}r`);

    // 清除屏幕并移到滚动区域顶部
    this.coordinator.write(`${ESC}[2J${ESC}[1;1H`);

    // 初始渲染输入区
    this.renderFixedArea();
  }

  // 结束：重置滚动区域
  end(): void {
    this.coordinator.write(`${ESC}[r`);  // 重置为全屏滚动
    this.coordinator.write(`${ESC}[2J${ESC}[1;1H`);  // 清屏
  }

  // 移动光标到滚动区域底部（准备输出）
  moveToScrollArea(): void {
    this.coordinator.write(`${ESC}[${this.scrollBottom};1H`);
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

  // 渲染固定区域（状态栏、分隔线、多行输入框）
  renderFixedArea(): void {
    let output = '';

    // 清除并渲染状态栏
    output += `${ESC}[${this.statusRow};1H${ESC}[2K`;

    // 清除并渲染分隔线
    output += `${ESC}[${this.separatorRow};1H${ESC}[2K`;
    output += LAIN_COLORS.muted('─'.repeat(this.terminalWidth));

    // 清除输入区所有行
    for (let i = 0; i < this.maxInputRows; i++) {
      output += `${ESC}[${this.inputStartRow + i};1H${ESC}[2K`;
    }

    // 计算所有行的显示内容（每行最多 terminalWidth - 2 个字符宽度）
    const maxLineWidth = this.terminalWidth - 2;
    const displayLines: string[] = [];

    // 将 buffer 内容按显示宽度分割成显示行
    for (const bufLine of this.buffer) {
      let remaining = bufLine;
      while (remaining.length > 0) {
        let lineContent = '';
        let lineWidth = 0;
        for (const char of remaining) {
          const charWidth = this.getStringWidth(char);
          if (lineWidth + charWidth > maxLineWidth) break;
          lineContent += char;
          lineWidth += charWidth;
        }
        displayLines.push(lineContent);
        remaining = remaining.slice(lineContent.length);
      }
    }

    // 只显示最后 maxInputRows 行（确保当前输入可见）
    const startDisplay = Math.max(0, displayLines.length - this.maxInputRows);
    for (let i = 0; i < this.maxInputRows && startDisplay + i < displayLines.length; i++) {
      output += `${ESC}[${this.inputStartRow + i};1H`;
      output += displayLines[startDisplay + i];
    }

    // 计算光标显示位置
    // 需要计算光标所在行之前的所有显示行数量
    let displayLinesBeforeCursorRow = 0;
    for (let r = 0; r < this.cursorRow; r++) {
      const bufLine = this.buffer[r] || '';
      let remaining = bufLine;
      while (remaining.length > 0) {
        let lineWidth = 0;
        let charCount = 0;
        for (const char of remaining) {
          const cw = this.getStringWidth(char);
          if (lineWidth + cw > maxLineWidth) break;
          lineWidth += cw;
          charCount++;
        }
        displayLinesBeforeCursorRow++;
        remaining = remaining.slice(charCount);
      }
    }

    // 计算当前行光标前的显示宽度，确定光标在哪一个显示行
    const cursorLine = this.buffer[this.cursorRow] || '';
    const beforeCursor = cursorLine.slice(0, this.cursorCol);
    let cursorDisplayCol = this.getStringWidth(beforeCursor);
    let cursorDisplayRowOffset = Math.floor(cursorDisplayCol / maxLineWidth);
    cursorDisplayCol = cursorDisplayCol % maxLineWidth + 1;  // +1 因为列从1开始

    // 光标在输入区的绝对行号
    const cursorAbsoluteDisplayRow = displayLinesBeforeCursorRow + cursorDisplayRowOffset;
    const adjustedRow = Math.min(cursorAbsoluteDisplayRow, this.maxInputRows - 1);

    output += `${ESC}[${this.inputStartRow + adjustedRow};${cursorDisplayCol + 1}H`;

    // 通过协调器一次性输出
    this.coordinator.write(output);
  }

  // 显示状态
  showStatus(status: string): void {
    this.coordinator.write(`${ESC}[${this.statusRow};1H${ESC}[2K`);
    this.coordinator.write(LAIN_COLORS.muted(status));
  }

  // 处理输入（Enter发送，其他键正常处理）
  handleInput(data: string): boolean {
    // 单独 Enter 发送内容
    if (data === '\r') {
      return true;
    }

    // Backspace
    if (data === '\x7f' || data === '\b') {
      this.backspace();
      this.shownCompletionList = false;
      return false;
    }

    // Tab 补全
    if (data === '\t') {
      this.handleTab();
      return false;
    }

    // 方向键等 ANSI 序列
    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }

    // 粘贴（包含换行）
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      this.shownCompletionList = false;
      return false;
    }

    // 普通字符输入（包含换行符 \n 则插入换行）
    if (data.includes('\n')) {
      // 多行内容，逐行插入
      const lines = data.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          this.newLine();  // 插入新行
        }
        if (lines[i]) {
          this.insert(lines[i]);
        }
      }
    } else {
      this.insert(data);
    }
    this.shownCompletionList = false;
    return false;
  }

  private handleAnsi(seq: string): void {
    if (seq === `${ESC}[A`) {  // 上箭头：移动到上一行
      if (this.cursorRow > 0) {
        this.cursorRow--;
        this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
      }
    } else if (seq === `${ESC}[B`) {  // 下箭头：移动到下一行
      if (this.cursorRow < this.buffer.length - 1) {
        this.cursorRow++;
        this.cursorCol = Math.min(this.cursorCol, this.buffer[this.cursorRow].length);
      }
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

  // 插入新行
  private newLine(): void {
    const currentLine = this.buffer[this.cursorRow];
    const beforeCursor = currentLine.slice(0, this.cursorCol);
    const afterCursor = currentLine.slice(this.cursorCol);

    this.buffer[this.cursorRow] = beforeCursor;
    this.buffer.splice(this.cursorRow + 1, 0, afterCursor);
    this.cursorRow++;
    this.cursorCol = 0;
  }

  // Tab 补全处理
  private handleTab(): void {
    const currentLine = this.buffer[this.cursorRow];
    if (!currentLine.startsWith('/') || !this.completer) {
      return;
    }

    const hits = this.completer(currentLine);

    if (hits.length === 1) {
      const completion = hits[0].slice(currentLine.length);
      this.insert(completion);
      this.shownCompletionList = false;
      this.lastCompletionLine = hits[0];
    } else if (hits.length > 1) {
      if (!this.shownCompletionList || currentLine !== this.lastCompletionLine) {
        // 第一次Tab：显示列表（通过协调器）
        this.moveToScrollArea();
        this.coordinator.write('\n' + hits.map(h => `${h}  `).join('') + '\n');
        this.shownCompletionList = true;
        this.lastCompletionLine = currentLine;
      } else {
        // 第二次Tab：补全第一个
        const completion = hits[0].slice(currentLine.length);
        this.insert(completion);
        this.shownCompletionList = false;
        this.lastCompletionLine = hits[0];
      }
    }
  }

  private handlePaste(data: string): void {
    const content = data
      .replace(/\x1b\[200~/g, '')
      .replace(/\x1b\[201~/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    if (content.trim()) {
      // 粘贴可能包含多行
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          this.newLine();
        }
        if (lines[i]) {
          this.insert(lines[i]);
        }
      }
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
    } else if (this.cursorRow > 0) {
      // 当前行开头，删除到上一行末尾
      const prevLine = this.buffer[this.cursorRow - 1];
      const currLine = this.buffer[this.cursorRow];
      this.buffer[this.cursorRow - 1] = prevLine + currLine;
      this.buffer.splice(this.cursorRow, 1);
      this.cursorRow--;
      this.cursorCol = prevLine.length;
    }
  }

  private delete(): void {
    const line = this.buffer[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.buffer[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
    } else if (this.cursorRow < this.buffer.length - 1) {
      // 当前行末尾，合并下一行
      const nextLine = this.buffer[this.cursorRow + 1];
      this.buffer[this.cursorRow] = line + nextLine;
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

  // 渲染（只更新输入区）
  render(): void {
    this.renderFixedArea();
  }
}