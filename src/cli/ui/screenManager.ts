import { isFullWidth } from './stringWidth';
import { COLORS } from './colors';

const ESC = '\x1b';

function writeStdout(text: string): void {
  process.stdout.write(text);
}

export interface ScreenState {
  inputBuffer: string[];
  cursorCol: number;
  terminalHeight: number;
  terminalWidth: number;
  inputLines: number;
  statusRow: number;
  scrollBottom: number;
  statusText: string;
  completer: ((line: string) => string[]) | null;
  shownCompletionList: boolean;
  lastCompletionLine: string;
  cursorInScrollArea: boolean;
  isStreaming: boolean;
  onVerboseToggle?: () => void;
  // 缓冲的输入，用于流式输出结束后刷新
  pendingInputRefresh: boolean;
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
      onVerboseToggle: undefined,
      pendingInputRefresh: false,
    };

    // 监听终端 resize
    process.stdout.on('resize', () => {
      this.handleResize();
    });
  }

  private handleResize(): void {
    const newHeight = process.stdout.rows || 24;
    const newWidth = process.stdout.columns || 80;

    // 更新状态
    this.state.terminalHeight = newHeight;
    this.state.terminalWidth = newWidth;

    // 重新计算布局
    this.updateLayout();

    // 清屏
    writeStdout(`${ESC}[2J${ESC}[H`);

    // 显示 resize 提示
    writeStdout(COLORS.muted('[resize] screen refreshed\n'));

    // 刷新输入框
    this.refreshInput();

    // 恢复光标
    this.restoreCursor();
  }

  private getCharDisplayWidth(char: string): number {
    if (char === '\n') return 0;
    if (char === '\t') return 8;
    const codePoint = char.codePointAt(0);
    if (!codePoint) return 1;
    
    // Emoji 和其他复杂 grapheme cluster 宽度为 2
    if (char.length > 1 || codePoint > 0xFFFF) return 2;
    
    if (isFullWidth(char)) return 2;
    return 1;
  }

  private getStringDisplayWidth(str: string): number {
    let width = 0;
    const graphemes = str.match(/\P{M}\p{M}*/gu) || [];
    for (const char of graphemes) {
      width += this.getCharDisplayWidth(char);
    }
    return width;
  }

  private calcInputLines(): number {
    const content = this.state.inputBuffer[0];
    const width = this.state.terminalWidth;

    const logicalLines = content.split('\n');
    let totalLines = 0;

    for (let i = 0; i < logicalLines.length; i++) {
      const line = logicalLines[i];
      const prefixWidth = i === 0 ? 2 : 0;
      const lineWidth = prefixWidth + this.getStringDisplayWidth(line);
      totalLines += Math.max(1, Math.ceil(lineWidth / width));
    }

    return totalLines;
  }

  private updateLayout(): void {
    const newLines = this.calcInputLines();
    if (newLines !== this.state.inputLines) {
      const oldStatusRow = this.state.statusRow;
      const oldScrollBottom = this.state.scrollBottom;
      this.state.inputLines = newLines;
      this.state.statusRow = this.state.terminalHeight - newLines - 1;
      this.state.scrollBottom = this.state.statusRow - 1;

      if (oldStatusRow > this.state.statusRow) {
        for (let row = this.state.statusRow + 1; row <= oldStatusRow; row++) {
          writeStdout(`${ESC}[${row};1H${ESC}[2K`);
        }
      } else if (oldStatusRow < this.state.statusRow) {
        for (let row = oldScrollBottom + 1; row <= this.state.scrollBottom; row++) {
          writeStdout(`${ESC}[${row};1H${ESC}[2K`);
        }
      }

      writeStdout(`${ESC}[1;${this.state.scrollBottom}r`);
      this.drawStatus();
    }
  }

  setStreaming(streaming: boolean): void {
    this.state.isStreaming = streaming;
    if (!streaming) {
      // 流式输出结束后，如果有待刷新的输入，刷新输入框
      if (this.state.pendingInputRefresh) {
        this.state.pendingInputRefresh = false;
        this.state.cursorInScrollArea = false;
        this.refreshInput();
        this.restoreCursor();
      } else {
        this.state.cursorInScrollArea = false;
      }
    }
  }

  start(): void {
    writeStdout(`${ESC}[1;${this.state.scrollBottom}r`);
    writeStdout(`${ESC}[2J${ESC}[1;1H`);
    this.drawStatus();
    this.refreshInput();
    this.restoreCursor();
  }

  end(): void {
    writeStdout(`${ESC}[r${ESC}[2J${ESC}[1;1H`);
  }

  appendScroll(text: string): void {
    // 流式输出时：隐藏光标，移动到输出区域，输出内容
    // 不恢复光标，避免干扰输出
    if (!this.state.cursorInScrollArea) {
      writeStdout(`${ESC}[?25l`);
      writeStdout(`${ESC}[${this.state.scrollBottom};1H`);
      this.state.cursorInScrollArea = true;
    }
    writeStdout(text);
  }

  refreshStatus(): void {
    this.drawStatus();
  }

  private drawStatus(): void {
    writeStdout(`${ESC}[?25l`);
    writeStdout(`${ESC}[${this.state.statusRow};1H${ESC}[2K`);
    if (this.state.statusText) {
      writeStdout(this.state.statusText);
    }
  }

  private formatInputContent(content: string): string {
    if (content.startsWith('/')) {
      const spaceIdx = content.indexOf(' ');
      const cmdEnd = spaceIdx > 0 ? spaceIdx : content.length;
      const cmd = content.slice(0, cmdEnd);
      const rest = content.slice(cmdEnd);
      return `\x1b[35m${cmd}\x1b[0m${rest}`;
    }
    return content;
  }

  refreshInput(): void {
    this.updateLayout();
    writeStdout(`${ESC}[?25l`);

    const inputStartRow = this.state.statusRow + 1;
    const inputEndRow = this.state.terminalHeight;
    
    // 清空输入区域
    for (let row = inputStartRow; row <= inputEndRow; row++) {
      writeStdout(`${ESC}[${row};1H${ESC}[2K`);
    }

    const content = this.state.inputBuffer[0];
    const logicalLines = content.split('\n');
    const width = this.state.terminalWidth;

    let currentRow = inputStartRow;
    for (let i = 0; i < logicalLines.length; i++) {
      const lineContent = logicalLines[i];
      const displayContent = i === 0 ? '> ' + this.formatInputContent(lineContent) : lineContent;

      const prefixWidth = i === 0 ? 2 : 0;
      const lineWidth = prefixWidth + this.getStringDisplayWidth(lineContent);
      const physicalLines = Math.max(1, Math.ceil(lineWidth / width));

      // 确保不越界
      if (currentRow > inputEndRow) break;

      writeStdout(`${ESC}[${currentRow};1H`);
      writeStdout(displayContent);

      currentRow += physicalLines;
    }
  }

  restoreCursor(): void {
    const rawContent = this.state.inputBuffer[0];
    const cursorCharPos = this.state.cursorCol;
    const width = this.state.terminalWidth;

    // 使用 grapheme cluster 正确处理复杂 Unicode 字符
    const graphemes = rawContent.match(/\P{M}\p{M}*/gu) || [];
    const contentBeforeCursor = graphemes.slice(0, cursorCharPos);

    // 计算光标所在的逻辑行和行内位置
    let logicalLineIndex = 0;
    let charsInCurrentLine = 0;

    for (const char of contentBeforeCursor) {
      if (char === '\n') {
        logicalLineIndex++;
        charsInCurrentLine = 0;
      } else {
        charsInCurrentLine++;
      }
    }

    const logicalLines = rawContent.split('\n');
    const currentLogicalLine = logicalLines[logicalLineIndex] || '';

    // 计算光标在当前逻辑行中的显示宽度
    const graphemesInLine = currentLogicalLine.match(/\P{M}\p{M}*/gu) || [];
    const graphemesBeforeCursorInLine = graphemesInLine.slice(0, charsInCurrentLine);
    let displayWidthInLine = 0;
    for (const char of graphemesBeforeCursorInLine) {
      displayWidthInLine += this.getCharDisplayWidth(char);
    }

    const prefixWidth = logicalLineIndex === 0 ? 2 : 0;
    const cursorDisplayWidth = prefixWidth + displayWidthInLine;

    // 计算之前逻辑行占用的物理行数
    let physicalLinesBefore = 0;
    for (let i = 0; i < logicalLineIndex; i++) {
      const line = logicalLines[i];
      const pWidth = i === 0 ? 2 : 0;
      const lineWidth = pWidth + this.getStringDisplayWidth(line);
      physicalLinesBefore += Math.max(1, Math.ceil(lineWidth / width));
    }

    // 计算当前逻辑行中光标之前占用的物理行数
    // 边界情况：当 cursorDisplayWidth 正好是 width 的倍数时，光标在行末
    let physicalLinesInCurrentBeforeCursor: number;
    let cursorCol: number;
    
    if (cursorDisplayWidth > 0 && cursorDisplayWidth % width === 0) {
      // 光标正好在行边界，应该在当前行的末尾
      physicalLinesInCurrentBeforeCursor = Math.floor(cursorDisplayWidth / width) - 1;
      cursorCol = width;
    } else {
      physicalLinesInCurrentBeforeCursor = Math.floor(cursorDisplayWidth / width);
      cursorCol = (cursorDisplayWidth % width) + 1;
    }

    const inputStartRow = this.state.statusRow + 1;
    const cursorRow = inputStartRow + physicalLinesBefore + physicalLinesInCurrentBeforeCursor;

    // 确保光标不越界
    const maxRow = this.state.terminalHeight;
    const clampedCursorRow = Math.min(cursorRow, maxRow);
    const clampedCursorCol = Math.max(1, Math.min(cursorCol, width));

    writeStdout(`${ESC}[${clampedCursorRow};${clampedCursorCol}H`);
    writeStdout(`${ESC}[?25h`);
    this.state.cursorInScrollArea = false;
  }

  refreshInputAndKeepCursor(): void {
    this.refreshInput();
    this.restoreCursor();
  }

  getDisplayCol(line: string, col: number): number {
    const chars = [...line].slice(0, col);
    return this.getStringDisplayWidth(chars.join(''));
  }

  handleInput(data: string): boolean {
    // 流式输出时，只更新输入缓冲区，标记需要刷新，但不实际刷新
    // 避免干扰流式输出
    if (this.state.isStreaming) {
      // Ctrl+O 切换 verbose 模式
      if (data === '\x0f') {
        if (this.state.onVerboseToggle) {
          this.state.onVerboseToggle();
        }
        return false;
      }
      
      // Enter 键不处理
      if (data === '\r' || data === '\n') return false;
      
      // 删除键
      if (data === '\x7f' || data === '\b') {
        if (this.state.cursorCol > 0) {
          const line = this.state.inputBuffer[0];
          const graphemes = line.match(/\P{M}\p{M}*/gu) || [];
          this.state.inputBuffer[0] = 
            graphemes.slice(0, this.state.cursorCol - 1).join('') + 
            graphemes.slice(this.state.cursorCol).join('');
          this.state.cursorCol--;
          this.state.pendingInputRefresh = true;
        }
        return false;
      }
      
      // Tab 键
      if (data === '\t') {
        return false;
      }
      
      // 粘贴
      if (data.includes(`${ESC}[200~`)) {
        // eslint-disable-next-line no-control-regex -- ANSI escape codes for bracketed paste
        const content = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
        const graphemes = content.match(/\P{M}\p{M}*/gu) || [];
        const line = this.state.inputBuffer[0];
        const lineGraphemes = line.match(/\P{M}\p{M}*/gu) || [];
        this.state.inputBuffer[0] = 
          lineGraphemes.slice(0, this.state.cursorCol).join('') + 
          content + 
          lineGraphemes.slice(this.state.cursorCol).join('');
        this.state.cursorCol += graphemes.length;
        this.state.pendingInputRefresh = true;
        return false;
      }
      
      // 方向键等 ANSI 序列
      if (data.startsWith(ESC)) {
        return false;
      }
      
      // 普通字符输入
      const line = this.state.inputBuffer[0];
      const graphemes = line.match(/\P{M}\p{M}*/gu) || [];
      const dataGraphemes = data.match(/\P{M}\p{M}*/gu) || [];
      this.state.inputBuffer[0] = 
        graphemes.slice(0, this.state.cursorCol).join('') + 
        data + 
        graphemes.slice(this.state.cursorCol).join('');
      this.state.cursorCol += dataGraphemes.length;
      this.state.pendingInputRefresh = true;
      return false;
    }

    // 非流式输出时，正常处理输入
    // 确保光标在输入框区域
    if (this.state.cursorInScrollArea) {
      writeStdout(`${ESC}[?25l`);
      const inputStartRow = this.state.statusRow + 1;
      writeStdout(`${ESC}[${inputStartRow};1H`);
      this.state.cursorInScrollArea = false;
    }

    if (data === '\r' || data === '\n') return true;
    if (data === '\x0f') {
      if (this.state.onVerboseToggle) {
        this.state.onVerboseToggle();
      }
      return false;
    }
    if (data === '\x7f' || data === '\b') {
      if (this.state.cursorCol > 0) {
        const line = this.state.inputBuffer[0];
        const graphemes = line.match(/\P{M}\p{M}*/gu) || [];
        this.state.inputBuffer[0] = 
          graphemes.slice(0, this.state.cursorCol - 1).join('') + 
          graphemes.slice(this.state.cursorCol).join('');
        this.state.cursorCol--;
        this.refreshInput();
        this.restoreCursor();
      }
      return false;
    }
    if (data === '\t') {
      this.handleTab();
      return false;
    }
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }
    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }
    const line = this.state.inputBuffer[0];
    const graphemes = line.match(/\P{M}\p{M}*/gu) || [];
    const dataGraphemes = data.match(/\P{M}\p{M}*/gu) || [];
    this.state.inputBuffer[0] = 
      graphemes.slice(0, this.state.cursorCol).join('') + 
      data + 
      graphemes.slice(this.state.cursorCol).join('');
    this.state.cursorCol += dataGraphemes.length;
    this.updateLayout();
    this.refreshInput();
    this.restoreCursor();
    return false;
  }

  handleAnsi(seq: string): void {
    // 确保光标在输入框区域
    if (this.state.cursorInScrollArea) {
      writeStdout(`${ESC}[?25l`);
      const inputStartRow = this.state.statusRow + 1;
      writeStdout(`${ESC}[${inputStartRow};1H`);
      this.state.cursorInScrollArea = false;
    }

    const line = this.state.inputBuffer[0];
    const graphemes = line.match(/\P{M}\p{M}*/gu) || [];
    
    if (seq === `${ESC}[C`) {
      if (this.state.cursorCol < graphemes.length) this.state.cursorCol++;
    } else if (seq === `${ESC}[D`) {
      if (this.state.cursorCol > 0) this.state.cursorCol--;
    } else if (seq === `${ESC}[3~`) {
      if (this.state.cursorCol < graphemes.length) {
        this.state.inputBuffer[0] = 
          graphemes.slice(0, this.state.cursorCol).join('') + 
          graphemes.slice(this.state.cursorCol + 1).join('');
      }
    }
    this.refreshInput();
    this.restoreCursor();
  }

  handleTab(): void {
    // 确保光标在输入框区域
    if (this.state.cursorInScrollArea) {
      writeStdout(`${ESC}[?25l`);
      const inputStartRow = this.state.statusRow + 1;
      writeStdout(`${ESC}[${inputStartRow};1H`);
      this.state.cursorInScrollArea = false;
    }

    const line = this.state.inputBuffer[0];
    if (!line.startsWith('/') || !this.state.completer) return;
    const hits = this.state.completer(line);
    if (hits.length === 1) {
      this.state.inputBuffer[0] = hits[0];
      this.state.cursorCol = (hits[0].match(/\P{M}\p{M}*/gu) || []).length;
      this.updateLayout();
      this.refreshInput();
      this.restoreCursor();
    } else if (hits.length > 1) {
      this.appendScroll('\n' + hits.join('  ') + '\n');
      this.restoreCursor();
    }
  }

  handlePaste(data: string): void {
    // 确保光标在输入框区域
    if (this.state.cursorInScrollArea) {
      writeStdout(`${ESC}[?25l`);
      const inputStartRow = this.state.statusRow + 1;
      writeStdout(`${ESC}[${inputStartRow};1H`);
      this.state.cursorInScrollArea = false;
    }

    // eslint-disable-next-line no-control-regex -- ANSI escape codes for bracketed paste
    const content = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
    const graphemes = content.match(/\P{M}\p{M}*/gu) || [];
    const line = this.state.inputBuffer[0];
    const lineGraphemes = line.match(/\P{M}\p{M}*/gu) || [];
    this.state.inputBuffer[0] = 
      lineGraphemes.slice(0, this.state.cursorCol).join('') + 
      content + 
      lineGraphemes.slice(this.state.cursorCol).join('');
    this.state.cursorCol += graphemes.length;
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
    this.state.pendingInputRefresh = false;
    writeStdout(`${ESC}[1;${this.state.scrollBottom}r`);
    this.drawStatus();
    this.refreshInput();
    this.restoreCursor();
  }

  setCompleter(fn: (line: string) => string[]): void {
    this.state.completer = fn;
  }

  setVerboseToggleCallback(fn: () => void): void {
    this.state.onVerboseToggle = fn;
  }

  setStatus(text: string): void {
    this.state.statusText = text;
    this.drawStatus();
    this.restoreCursor();
  }

  writeRaw(text: string): void {
    process.stdout.write(text);
  }
}

let instance: ScreenManager | null = null;
export function getScreenManager(): ScreenManager {
  if (!instance) instance = new ScreenManager();
  return instance;
}