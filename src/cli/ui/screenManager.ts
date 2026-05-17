// Screen Manager - 虚拟屏幕管理，定时刷新避免冲突
// 所有输入输出都更新内部状态，定时器统一刷新到终端

import { LAIN_COLORS } from './colors';
import fs from 'fs';

const ESC = '\x1b';

export interface ScreenState {
  scrollContent: string[];
  inputBuffer: string[];
  cursorRow: number;
  cursorCol: number;
  statusText: string;
  terminalHeight: number;
  terminalWidth: number;
  statusRow: number;
  separatorRow: number;
  inputStartRow: number;
  scrollBottom: number;
  maxInputRows: number;
  completer: ((line: string) => string[]) | null;
  shownCompletionList: boolean;
  lastCompletionLine: string;
}

export class ScreenManager {
  state: ScreenState;
  refreshInterval: NodeJS.Timeout | null = null;
  lastRefreshTime: number = 0;
  needsRefresh: boolean = false;

  constructor() {
    this.state = this.initState();
  }

  initState(): ScreenState {
    const height = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;
    const maxInputRows = 3;

    return {
      scrollContent: [],
      inputBuffer: [''],
      cursorRow: 0,
      cursorCol: 0,
      statusText: '',
      terminalHeight: height,
      terminalWidth: width,
      statusRow: height - maxInputRows - 2,
      separatorRow: height - maxInputRows - 1,
      inputStartRow: height - maxInputRows,
      scrollBottom: height - maxInputRows - 3,
      maxInputRows,
      completer: null,
      shownCompletionList: false,
      lastCompletionLine: '',
    };
  }

  // 启动屏幕管理
  start(): void {
    this.updateSize();
    // 设置滚动区域
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
    // 清屏
    fs.writeSync(1, `${ESC}[2J${ESC}[1;1H`);
    // 启动定时刷新（每30ms）
    this.refreshInterval = setInterval(() => this.tickRefresh(), 30);
  }

  // 结束
  end(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    fs.writeSync(1, `${ESC}[r${ESC}[2J${ESC}[1;1H`);
  }

  // 定时刷新
  tickRefresh(): void {
    if (!this.needsRefresh) return;
    this.needsRefresh = false;
    this.doRefresh();
  }

  // 强制立即刷新（用于关键操作如 Enter）
  forceRefresh(): void {
    this.doRefresh();
  }

  // 实际刷新屏幕
  doRefresh(): void {
    const st = this.state;
    let output = '';

    // 1. 刷新滚动区域新内容
    if (st.scrollContent.length > 0) {
      output += `${ESC}[${st.scrollBottom};1H`;
      for (const line of st.scrollContent) {
        output += line;
      }
      st.scrollContent = [];  // 清空已输出内容
    }

    // 2. 刷新状态栏
    if (st.statusText) {
      output += `${ESC}[${st.statusRow};1H${ESC}[2K`;
      output += st.statusText;
    }

    // 3. 刷新分隔线
    output += `${ESC}[${st.separatorRow};1H${ESC}[2K`;
    output += LAIN_COLORS.muted('─'.repeat(st.terminalWidth));

    // 4. 刷新输入框（多行，自动换行显示）
    const maxLineWidth = st.terminalWidth - 2;
    const displayLines: string[] = [];

    for (const bufLine of st.inputBuffer) {
      let remaining = bufLine;
      while (remaining.length > 0) {
        let lineContent = '';
        let lineWidth = 0;
        for (const char of remaining) {
          const cw = this.getCharWidth(char);
          if (lineWidth + cw > maxLineWidth) break;
          lineContent += char;
          lineWidth += cw;
        }
        displayLines.push(lineContent);
        remaining = remaining.slice(lineContent.length);
      }
    }

    // 清除输入区
    for (let i = 0; i < st.maxInputRows; i++) {
      output += `${ESC}[${st.inputStartRow + i};1H${ESC}[2K`;
    }

    // 显示最后 maxInputRows 行
    const startIdx = Math.max(0, displayLines.length - st.maxInputRows);
    for (let i = 0; i < st.maxInputRows && startIdx + i < displayLines.length; i++) {
      output += `${ESC}[${st.inputStartRow + i};1H`;
      output += displayLines[startIdx + i];
    }

    // 5. 定位光标到输入位置
    const cursorLine = st.inputBuffer[st.cursorRow] || '';
    const beforeCursor = cursorLine.slice(0, st.cursorCol);
    const cursorColDisplay = this.getStringWidth(beforeCursor) + 1;
    const cursorRowDisplay = Math.min(st.cursorRow, st.maxInputRows - 1);
    output += `${ESC}[${st.inputStartRow + cursorRowDisplay};${cursorColDisplay}H`;

    // 同步写入
    fs.writeSync(1, output);
  }

  // 添加滚动输出内容
  appendScroll(text: string): void {
    this.state.scrollContent.push(text);
    this.needsRefresh = true;
  }

  // 设置状态栏
  setStatus(text: string): void {
    this.state.statusText = text;
    this.needsRefresh = true;
  }

  // 处理用户输入
  handleInput(data: string): boolean {
    if (data === '\r') {
      return true;  // Enter 发送
    }

    if (data === '\x7f' || data === '\b') {
      this.backspace();
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

    // 包含换行则多行插入
    if (data.includes('\n')) {
      const lines = data.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.newLine();
        if (lines[i]) this.insert(lines[i]);
      }
    } else {
      this.insert(data);
    }
    return false;
  }

  handleAnsi(seq: string): void {
    const st = this.state;
    if (seq === `${ESC}[A`) {
      if (st.cursorRow > 0) {
        st.cursorRow--;
        st.cursorCol = Math.min(st.cursorCol, st.inputBuffer[st.cursorRow].length);
      }
    } else if (seq === `${ESC}[B`) {
      if (st.cursorRow < st.inputBuffer.length - 1) {
        st.cursorRow++;
        st.cursorCol = Math.min(st.cursorCol, st.inputBuffer[st.cursorRow].length);
      }
    } else if (seq === `${ESC}[C`) {
      if (st.cursorCol < st.inputBuffer[st.cursorRow].length) st.cursorCol++;
    } else if (seq === `${ESC}[D`) {
      if (st.cursorCol > 0) st.cursorCol--;
    } else if (seq === `${ESC}[3~`) {
      this.delete();
    }
    this.needsRefresh = true;
  }

  handleTab(): void {
    const st = this.state;
    const currentLine = st.inputBuffer[st.cursorRow];
    if (!currentLine.startsWith('/') || !st.completer) return;

    const hits = st.completer(currentLine);
    if (hits.length === 1) {
      this.insert(hits[0].slice(currentLine.length));
      st.shownCompletionList = false;
    } else if (hits.length > 1) {
      if (!st.shownCompletionList || currentLine !== st.lastCompletionLine) {
        // 显示补全列表（作为滚动输出）
        this.appendScroll('\n' + hits.map(h => `${h}  `).join('') + '\n');
        st.shownCompletionList = true;
        st.lastCompletionLine = currentLine;
      } else {
        this.insert(hits[0].slice(currentLine.length));
        st.shownCompletionList = false;
      }
    }
  }

  handlePaste(data: string): void {
    const content = data
      .replace(/\x1b\[200~/g, '')
      .replace(/\x1b\[201~/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    if (content.trim()) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.newLine();
        if (lines[i]) this.insert(lines[i]);
      }
    }
  }

  insert(text: string): void {
    const st = this.state;
    const line = st.inputBuffer[st.cursorRow];
    st.inputBuffer[st.cursorRow] = line.slice(0, st.cursorCol) + text + line.slice(st.cursorCol);
    st.cursorCol += text.length;
    this.needsRefresh = true;
  }

  newLine(): void {
    const st = this.state;
    const line = st.inputBuffer[st.cursorRow];
    const before = line.slice(0, st.cursorCol);
    const after = line.slice(st.cursorCol);
    st.inputBuffer[st.cursorRow] = before;
    st.inputBuffer.splice(st.cursorRow + 1, 0, after);
    st.cursorRow++;
    st.cursorCol = 0;
    this.needsRefresh = true;
  }

  backspace(): void {
    const st = this.state;
    if (st.cursorCol > 0) {
      const line = st.inputBuffer[st.cursorRow];
      st.inputBuffer[st.cursorRow] = line.slice(0, st.cursorCol - 1) + line.slice(st.cursorCol);
      st.cursorCol--;
    } else if (st.cursorRow > 0) {
      const prev = st.inputBuffer[st.cursorRow - 1];
      const curr = st.inputBuffer[st.cursorRow];
      st.inputBuffer[st.cursorRow - 1] = prev + curr;
      st.inputBuffer.splice(st.cursorRow, 1);
      st.cursorRow--;
      st.cursorCol = prev.length;
    }
    this.needsRefresh = true;
  }

  delete(): void {
    const st = this.state;
    const line = st.inputBuffer[st.cursorRow];
    if (st.cursorCol < line.length) {
      st.inputBuffer[st.cursorRow] = line.slice(0, st.cursorCol) + line.slice(st.cursorCol + 1);
    } else if (st.cursorRow < st.inputBuffer.length - 1) {
      const next = st.inputBuffer[st.cursorRow + 1];
      st.inputBuffer[st.cursorRow] = line + next;
      st.inputBuffer.splice(st.cursorRow + 1, 1);
    }
    this.needsRefresh = true;
  }

  getContent(): string {
    return this.state.inputBuffer.join('\n');
  }

  clear(): void {
    this.state.inputBuffer = [''];
    this.state.cursorRow = 0;
    this.state.cursorCol = 0;
    this.needsRefresh = true;
  }

  setCompleter(fn: (line: string) => string[]): void {
    this.state.completer = fn;
  }

  updateSize(): void {
    const height = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;
    this.state.terminalHeight = height;
    this.state.terminalWidth = width;
    this.state.statusRow = height - this.state.maxInputRows - 2;
    this.state.separatorRow = height - this.state.maxInputRows - 1;
    this.state.inputStartRow = height - this.state.maxInputRows;
    this.state.scrollBottom = height - this.state.maxInputRows - 3;
  }

  getCharWidth(char: string): number {
    return char.charCodeAt(0) > 0x7F ? 2 : 1;
  }

  getStringWidth(str: string): number {
    let w = 0;
    for (const c of str) w += this.getCharWidth(c);
    return w;
  }
}

let instance: ScreenManager | null = null;

export function getScreenManager(): ScreenManager {
  if (!instance) instance = new ScreenManager();
  return instance;
}