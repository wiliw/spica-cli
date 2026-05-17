// Screen Manager - 简化版
// 流式输出期间不刷新输入框，结束后统一刷新

import { LAIN_COLORS } from './colors';
import fs from 'fs';

const ESC = '\x1b';

export interface ScreenState {
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
  inScrollArea: boolean;  // 光标是否在滚动区域
}

export class ScreenManager {
  state: ScreenState;
  refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.state = this.initState();
  }

  initState(): ScreenState {
    const height = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;
    const maxInputRows = 3;

    return {
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
      inScrollArea: true,  // 默认光标在滚动区域
    };
  }

  start(): void {
    this.updateSize();
    // 设置滚动区域
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
    // 清屏
    fs.writeSync(1, `${ESC}[2J${ESC}[1;1H`);
    // 刷新固定区域
    this.refreshFixedArea();
    // 启动定时刷新（每 100ms）
    this.refreshTimer = setInterval(() => this.tickRefresh(), 100);
  }

  end(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    fs.writeSync(1, `${ESC}[r${ESC}[2J${ESC}[1;1H`);
  }

  // 定时刷新（只刷新输入框，不刷新状态栏和分隔线）
  tickRefresh(): void {
    if (this.state.inScrollArea) {
      // 光标在滚动区域，刷新输入框后恢复光标
      this.refreshInputOnly();
    }
  }

  // 只刷新输入框（快速刷新，不影响滚动输出）
  refreshInputOnly(): void {
    const st = this.state;
    const maxLineWidth = st.terminalWidth - 2;
    const displayLines: string[] = [];

    // 计算显示行
    for (const bufLine of st.inputBuffer) {
      let remaining = bufLine;
      while (remaining.length > 0) {
        let lineContent = '';
        let lineWidth = 0;
        let charCount = 0;
        for (const char of remaining) {
          const cw = this.getCharWidth(char);
          if (lineWidth + cw > maxLineWidth) break;
          lineContent += char;
          lineWidth += cw;
          charCount++;
        }
        displayLines.push(lineContent);
        remaining = remaining.slice(charCount);
      }
    }

    // 刷新输入区
    let output = '';
    for (let i = 0; i < st.maxInputRows; i++) {
      output += `${ESC}[${st.inputStartRow + i};1H${ESC}[2K`;
    }
    const startIdx = Math.max(0, displayLines.length - st.maxInputRows);
    for (let i = 0; i < st.maxInputRows && startIdx + i < displayLines.length; i++) {
      output += `${ESC}[${st.inputStartRow + i};1H`;
      output += displayLines[startIdx + i];
    }

    // 恢复光标到滚动区域底部
    output += `${ESC}[${st.scrollBottom};1H`;

    fs.writeSync(1, output);
  }

  // 滚动输出
  appendScroll(text: string): void {
    // 如果光标不在滚动区域，先定位到 scrollBottom
    if (!this.state.inScrollArea) {
      fs.writeSync(1, `${ESC}[${this.state.scrollBottom};1H`);
      this.state.inScrollArea = true;
    }
    fs.writeSync(1, text);
  }

  // 刷新固定区域（状态栏、分隔线、输入框）
  refreshFixedArea(): void {
    const st = this.state;
    let output = '';

    // 状态栏
    if (st.statusText) {
      output += `${ESC}[${st.statusRow};1H${ESC}[2K`;
      output += st.statusText;
    }

    // 分隔线
    output += `${ESC}[${st.separatorRow};1H${ESC}[2K`;
    output += LAIN_COLORS.muted('─'.repeat(st.terminalWidth));

    // 输入框（计算显示行）
    const maxLineWidth = st.terminalWidth - 2;
    const displayLines: string[] = [];

    for (const bufLine of st.inputBuffer) {
      let remaining = bufLine;
      while (remaining.length > 0) {
        let lineContent = '';
        let lineWidth = 0;
        let charCount = 0;
        for (const char of remaining) {
          const cw = this.getCharWidth(char);
          if (lineWidth + cw > maxLineWidth) break;
          lineContent += char;
          lineWidth += cw;
          charCount++;
        }
        displayLines.push(lineContent);
        remaining = remaining.slice(charCount);
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

    // 光标定位到输入位置
    let displayLinesBeforeCursorRow = 0;
    for (let r = 0; r < st.cursorRow; r++) {
      let remaining = st.inputBuffer[r] || '';
      while (remaining.length > 0) {
        let lineWidth = 0;
        let charCount = 0;
        for (const char of remaining) {
          const cw = this.getCharWidth(char);
          if (lineWidth + cw > maxLineWidth) break;
          lineWidth += cw;
          charCount++;
        }
        displayLinesBeforeCursorRow++;
        remaining = remaining.slice(charCount);
      }
    }

    const cursorLine = st.inputBuffer[st.cursorRow] || '';
    const beforeCursor = cursorLine.slice(0, st.cursorCol);
    const cursorColWidth = this.getStringWidth(beforeCursor);
    const cursorDisplayRowOffset = Math.floor(cursorColWidth / maxLineWidth);
    const cursorColInRow = cursorColWidth % maxLineWidth;

    const cursorDisplayRow = Math.min(displayLinesBeforeCursorRow + cursorDisplayRowOffset, st.maxInputRows - 1);
    const cursorDisplayCol = cursorColInRow + 1;

    output += `${ESC}[${st.inputStartRow + cursorDisplayRow};${cursorDisplayCol}H`;

    fs.writeSync(1, output);

    // 刷新后光标在输入框
    this.state.inScrollArea = false;
  }

  setStatus(text: string): void {
    this.state.statusText = text;
    this.refreshFixedArea();
  }

  handleInput(data: string): boolean {
    if (data === '\r') {
      return true;
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

    if (data.includes('\n')) {
      const lines = data.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.newLine();
        if (lines[i]) this.insert(lines[i]);
      }
    } else {
      this.insert(data);
    }
    // 不立即刷新，定时器会处理
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
    // 不立即刷新
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
        // Tab 补全列表显示在滚动区域（立即输出）
        fs.writeSync(1, `${ESC}[${st.scrollBottom};1H`);
        fs.writeSync(1, '\n' + hits.map(h => `${h}  `).join('') + '\n');
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
  }

  getContent(): string {
    return this.state.inputBuffer.join('\n');
  }

  clear(): void {
    this.state.inputBuffer = [''];
    this.state.cursorRow = 0;
    this.state.cursorCol = 0;
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