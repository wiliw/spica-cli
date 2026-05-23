import { LAIN_COLORS } from './colors';
import fs from 'fs';

const ESC = '\x1b';

export interface ScreenState {
  inputBuffer: string[];
  cursorCol: number;
  terminalHeight: number;
  terminalWidth: number;
  inputLines: number;
  statusRow: number;
  scrollBottom: number;
  statusText: string;       // 存储状态栏内容
  completer: ((line: string) => string[]) | null;
  shownCompletionList: boolean;
  lastCompletionLine: string;
  cursorInScrollArea: boolean;
  isStreaming: boolean;
}

export class ScreenManager {
  state: ScreenState;

  constructor() {
    const height = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;

    this.state = {
      inputBuffer: [''],
      cursorCol: 0,
      terminalHeight: height,
      terminalWidth: width,
      inputLines: 1,
      statusRow: height - 2,
      scrollBottom: height - 3,
      statusText: '',
      completer: null,
      shownCompletionList: false,
      lastCompletionLine: '',
      cursorInScrollArea: false,
      isStreaming: false,
    };
  }

  // 计算输入内容需要的行数
  private calcInputLines(): number {
    const content = '> ' + this.state.inputBuffer[0];
    const width = this.state.terminalWidth;
    // 计算显示宽度（考虑 CJK）
    let displayWidth = 0;
    for (const char of content) {
      displayWidth += char.charCodeAt(0) > 0x7F ? 2 : 1;
    }
    return Math.max(1, Math.ceil(displayWidth / width));
  }

  // 更新布局（输入行数变化时）
  private updateLayout(): void {
    const newLines = this.calcInputLines();
    if (newLines !== this.state.inputLines) {
      const oldStatusRow = this.state.statusRow;
      this.state.inputLines = newLines;
      this.state.statusRow = this.state.terminalHeight - newLines - 1;
      this.state.scrollBottom = this.state.statusRow - 1;

      // 清除旧状态栏位置（如果被输入框覆盖）
      if (oldStatusRow > this.state.statusRow) {
        for (let row = this.state.statusRow + 1; row <= oldStatusRow; row++) {
          fs.writeSync(1, `${ESC}[${row};1H${ESC}[2K`);
        }
      }

      // 重新设置滚动区域
      fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
      
      // 重绘状态栏在新位置
      this.drawStatus();
    }
  }

  setStreaming(streaming: boolean): void {
    this.state.isStreaming = streaming;
  }

  start(): void {
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
    fs.writeSync(1, `${ESC}[2J${ESC}[1;1H`);
    this.drawStatus();
    this.refreshInput();
    this.restoreCursor();
  }

  end(): void {
    fs.writeSync(1, `${ESC}[r${ESC}[2J${ESC}[1;1H`);
  }

  appendScroll(text: string): void {
    if (!this.state.cursorInScrollArea) {
      fs.writeSync(1, `${ESC}[?25l`);
      fs.writeSync(1, `${ESC}[${this.state.scrollBottom};1H`);
      this.state.cursorInScrollArea = true;
    }
    fs.writeSync(1, text);
  }

  // 刷新状态栏（清除并重绘）
  refreshStatus(): void {
    this.drawStatus();
  }

  // 绘制状态栏
  private drawStatus(): void {
    fs.writeSync(1, `${ESC}[?25l`);
    fs.writeSync(1, `${ESC}[${this.state.statusRow};1H${ESC}[2K`);
    if (this.state.statusText) {
      fs.writeSync(1, this.state.statusText);
    }
  }

  // 格式化输入内容（高亮 /command）
  private formatInputContent(content: string): string {
    if (content.startsWith('/')) {
      // 找到命令结束位置（空格或结尾）
      const spaceIdx = content.indexOf(' ');
      const cmdEnd = spaceIdx > 0 ? spaceIdx : content.length;
      const cmd = content.slice(0, cmdEnd);
      const rest = content.slice(cmdEnd);
      // 使用 magenta 高亮命令部分
      return `\x1b[35m${cmd}\x1b[0m${rest}`;
    }
    return content;
  }

  // 刷新输入框（清除所有输入行，重绘）
  refreshInput(): void {
    this.updateLayout();
    fs.writeSync(1, `${ESC}[?25l`);

    // 清除所有输入行（从 statusRow+1 到 terminalHeight）
    for (let row = this.state.statusRow + 1; row <= this.state.terminalHeight; row++) {
      fs.writeSync(1, `${ESC}[${row};1H${ESC}[2K`);
    }

    // 在输入区域第一行显示内容
    const inputStartRow = this.state.statusRow + 1;
    fs.writeSync(1, `${ESC}[${inputStartRow};1H`);
    const formattedContent = this.formatInputContent(this.state.inputBuffer[0]);
    fs.writeSync(1, '> ' + formattedContent);
  }

  restoreCursor(): void {
    // 计算光标在输入区域的行和列（基于原始内容，不含 ANSI 码）
    const rawContent = this.state.inputBuffer[0];
    const cursorCharPos = this.state.cursorCol;

    // 使用字符迭代器正确处理 UTF-8
    const chars = [...rawContent];
    const contentBeforeCursor = chars.slice(0, cursorCharPos).join('');

    // 计算显示宽度（包含 '> ' 前缀）
    let displayWidth = 2;  // '> ' 前缀宽度
    for (const char of contentBeforeCursor) {
      displayWidth += char.charCodeAt(0) > 0x7F ? 2 : 1;
    }

    const width = this.state.terminalWidth;
    // 光标在 displayWidth 位置之后，即 displayWidth + 1
    // 行和列基于光标位置计算
    const inputRow = this.state.statusRow + 1 + Math.floor(displayWidth / width);
    const inputCol = (displayWidth % width) + 1;

    fs.writeSync(1, `${ESC}[${inputRow};${inputCol}H`);
    fs.writeSync(1, `${ESC}[?25h`);
    this.state.cursorInScrollArea = false;
  }

  refreshInputAndKeepCursor(): void {
    this.refreshInput();
    this.restoreCursor();

    if (this.state.isStreaming) {
      fs.writeSync(1, `${ESC}[${this.state.scrollBottom};1H`);
      fs.writeSync(1, `${ESC}[?25l`);
      this.state.cursorInScrollArea = true;
    }
  }

  getDisplayCol(line: string, col: number): number {
    let w = 0;
    for (let i = 0; i < col && i < line.length; i++) {
      w += line.charCodeAt(i) > 0x7F ? 2 : 1;
    }
    return w;
  }

  handleInput(data: string): boolean {
    if (data === '\r' || data === '\n') return true;
    if (data === '\x7f' || data === '\b') {
      if (this.state.cursorCol > 0) {
        const line = this.state.inputBuffer[0];
        this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol - 1) + line.slice(this.state.cursorCol);
        this.state.cursorCol--;
        // 流式期间用特殊处理，非流式期间直接刷新
        if (this.state.isStreaming) {
          this.refreshInputAndKeepCursor();
        } else {
          this.refreshInput();
          this.restoreCursor();
        }
      }
      return false;
    }
    if (data === '\t') {
      this.handleTab();
      return false;
    }
    // 粘贴必须在 ESC 检查之前，因为粘贴数据也以 ESC 开头
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }
    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }
    // 插入字符
    const line = this.state.inputBuffer[0];
    this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol) + data + line.slice(this.state.cursorCol);
    this.state.cursorCol += [...data].length;  // 使用字符迭代器正确计算 UTF-8
    this.updateLayout();  // 更新布局（输入行数可能变化）
    // 流式期间用特殊处理，非流式期间直接刷新
    if (this.state.isStreaming) {
      this.refreshInputAndKeepCursor();
    } else {
      this.refreshInput();
      this.restoreCursor();
    }
    return false;
  }

  handleAnsi(seq: string): void {
    if (seq === `${ESC}[C`) {
      if (this.state.cursorCol < this.state.inputBuffer[0].length) this.state.cursorCol++;
    } else if (seq === `${ESC}[D`) {
      if (this.state.cursorCol > 0) this.state.cursorCol--;
    } else if (seq === `${ESC}[3~`) {
      const line = this.state.inputBuffer[0];
      if (this.state.cursorCol < line.length) {
        this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol) + line.slice(this.state.cursorCol + 1);
      }
    }
    // 流式期间用特殊处理，非流式期间直接刷新
    if (this.state.isStreaming) {
      this.refreshInputAndKeepCursor();
    } else {
      this.refreshInput();
      this.restoreCursor();
    }
  }

  handleTab(): void {
    const line = this.state.inputBuffer[0];
    if (!line.startsWith('/') || !this.state.completer) return;
    const hits = this.state.completer(line);
    if (hits.length === 1) {
      this.state.inputBuffer[0] = hits[0];
      this.state.cursorCol = [...hits[0]].length;  // 使用字符迭代器正确计算 UTF-8
      this.updateLayout();
      this.refreshInput();
      this.restoreCursor();
    } else if (hits.length > 1) {
      this.appendScroll('\n' + hits.join('  ') + '\n');
      this.restoreCursor();
    }
  }

  handlePaste(data: string): void {
    const content = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
    // 使用字符迭代器正确计算长度（UTF-8）
    const chars = [...content];
    this.state.inputBuffer[0] += content;
    this.state.cursorCol += chars.length;
    this.updateLayout();
    this.refreshInput();
    this.restoreCursor();
  }

  getContent(): string {
    return this.state.inputBuffer[0];
  }

  clear(): void {
    this.state.inputBuffer[0] = '';
    this.state.cursorCol = 0;
    this.state.inputLines = 1;
    this.state.statusRow = this.state.terminalHeight - 2;
    this.state.scrollBottom = this.state.terminalHeight - 3;
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
    this.drawStatus();
    this.refreshInput();
    this.restoreCursor();
  }

  setCompleter(fn: (line: string) => string[]): void {
    this.state.completer = fn;
  }

  setStatus(text: string): void {
    this.state.statusText = text;
    this.drawStatus();
    this.restoreCursor();
  }
}

let instance: ScreenManager | null = null;
export function getScreenManager(): ScreenManager {
  if (!instance) instance = new ScreenManager();
  return instance;
}
