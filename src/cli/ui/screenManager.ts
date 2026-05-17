import { LAIN_COLORS } from './colors';
import fs from 'fs';

const ESC = '\x1b';

export interface ScreenState {
  inputBuffer: string[];
  cursorCol: number;
  terminalHeight: number;
  terminalWidth: number;
  inputRow: number;
  scrollBottom: number;
  completer: ((line: string) => string[]) | null;
  shownCompletionList: boolean;
  lastCompletionLine: string;
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
      inputRow: height,
      scrollBottom: height - 1,
      completer: null,
      shownCompletionList: false,
      lastCompletionLine: '',
    };
  }

  start(): void {
    // 设置滚动区域：1 到 height-1
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
    fs.writeSync(1, `${ESC}[2J${ESC}[1;1H`);
    this.refreshInput();
  }

  end(): void {
    fs.writeSync(1, `${ESC}[r${ESC}[2J${ESC}[1;1H`);
  }

  // 输出到滚动区域，完成后光标回到输入框
  appendScroll(text: string): void {
    // 1. 定位到滚动区域底部
    fs.writeSync(1, `${ESC}[${this.state.scrollBottom};1H`);
    // 2. 写入内容
    fs.writeSync(1, text);
    // 3. 立即恢复光标到输入框
    this.restoreCursor();
  }

  // 恢复光标到输入框
  restoreCursor(): void {
    const col = this.getDisplayCol(this.state.inputBuffer[0], this.state.cursorCol) + 1;
    fs.writeSync(1, `${ESC}[${this.state.inputRow};${col}H`);
  }

  // 刷新输入框显示
  refreshInput(): void {
    // 清除输入行
    fs.writeSync(1, `${ESC}[${this.state.inputRow};1H${ESC}[2K`);
    // 显示输入内容
    fs.writeSync(1, '> ' + this.state.inputBuffer[0]);
    // 光标定位
    this.restoreCursor();
  }

  getDisplayCol(line: string, col: number): number {
    let w = 0;
    for (let i = 0; i < col && i < line.length; i++) {
      w += line.charCodeAt(i) > 0x7F ? 2 : 1;
    }
    return w;
  }

  handleInput(data: string): boolean {
    if (data === '\r') return true;
    if (data === '\x7f' || data === '\b') {
      if (this.state.cursorCol > 0) {
        const line = this.state.inputBuffer[0];
        this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol - 1) + line.slice(this.state.cursorCol);
        this.state.cursorCol--;
        this.refreshInput();
      }
      return false;
    }
    if (data === '\t') {
      this.handleTab();
      return false;
    }
    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }
    // 插入字符
    const line = this.state.inputBuffer[0];
    this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol) + data + line.slice(this.state.cursorCol);
    this.state.cursorCol += data.length;
    this.refreshInput();
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
    this.refreshInput();
  }

  handleTab(): void {
    const line = this.state.inputBuffer[0];
    if (!line.startsWith('/') || !this.state.completer) return;
    const hits = this.state.completer(line);
    if (hits.length === 1) {
      this.state.inputBuffer[0] = hits[0];
      this.state.cursorCol = hits[0].length;
      this.refreshInput();
    } else if (hits.length > 1) {
      this.appendScroll('\n' + hits.join('  ') + '\n');
    }
  }

  handlePaste(data: string): void {
    const content = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
    this.state.inputBuffer[0] += content;
    this.state.cursorCol += content.length;
    this.refreshInput();
  }

  getContent(): string {
    return this.state.inputBuffer[0];
  }

  clear(): void {
    this.state.inputBuffer[0] = '';
    this.state.cursorCol = 0;
    this.refreshInput();
  }

  setCompleter(fn: (line: string) => string[]): void {
    this.state.completer = fn;
  }

  setStatus(text: string): void {
    // 状态栏在 height-1 行
    fs.writeSync(1, `${ESC}[${this.state.terminalHeight - 1};1H${ESC}[2K`);
    fs.writeSync(1, text);
    this.restoreCursor();
  }
}

let instance: ScreenManager | null = null;
export function getScreenManager(): ScreenManager {
  if (!instance) instance = new ScreenManager();
  return instance;
}
