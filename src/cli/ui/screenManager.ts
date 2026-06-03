import { COLORS } from './colors';
import { isCJK } from './stringWidth';

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
    };
  }

  private getCharDisplayWidth(char: string): number {
    if (char === '\n') return 0;
    if (char === '\t') return 8;
    if (isCJK(char)) return 2;
    return 1;
  }

  private getStringDisplayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
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
      this.state.cursorInScrollArea = false;
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

    for (let row = this.state.statusRow + 1; row <= this.state.terminalHeight; row++) {
      writeStdout(`${ESC}[${row};1H${ESC}[2K`);
    }

    const content = this.state.inputBuffer[0];
    const logicalLines = content.split('\n');
    const inputStartRow = this.state.statusRow + 1;
    const width = this.state.terminalWidth;

    let currentRow = inputStartRow;
    for (let i = 0; i < logicalLines.length; i++) {
      const lineContent = logicalLines[i];
      const displayContent = i === 0 ? '> ' + this.formatInputContent(lineContent) : lineContent;

      const prefixWidth = i === 0 ? 2 : 0;
      const lineWidth = prefixWidth + this.getStringDisplayWidth(lineContent);
      const physicalLines = Math.max(1, Math.ceil(lineWidth / width));

      for (let j = 0; j < physicalLines; j++) {
        writeStdout(`${ESC}[${currentRow + j};1H${ESC}[2K`);
      }

      writeStdout(`${ESC}[${currentRow};1H`);
      writeStdout(displayContent);

      currentRow += physicalLines;
    }
  }

  restoreCursor(): void {
    const rawContent = this.state.inputBuffer[0];
    const cursorCharPos = this.state.cursorCol;
    const width = this.state.terminalWidth;

    const chars = [...rawContent];
    const contentBeforeCursor = chars.slice(0, cursorCharPos);

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

    const cursorColInLine = charsInCurrentLine;

    const charsBeforeCursorInLine = [...currentLogicalLine].slice(0, cursorColInLine);
    let displayWidthInLine = 0;
    for (const char of charsBeforeCursorInLine) {
      displayWidthInLine += this.getCharDisplayWidth(char);
    }

    const prefixWidth = logicalLineIndex === 0 ? 2 : 0;
    const totalDisplayWidth = prefixWidth + displayWidthInLine;

    let physicalLinesBefore = 0;
    for (let i = 0; i < logicalLineIndex; i++) {
      const line = logicalLines[i];
      const pWidth = i === 0 ? 2 : 0;
      const lineWidth = pWidth + this.getStringDisplayWidth(line);
      physicalLinesBefore += Math.max(1, Math.ceil(lineWidth / width));
    }

    const physicalLinesInCurrentBeforeCursor = Math.floor(totalDisplayWidth / width);

    const inputStartRow = this.state.statusRow + 1;
    const cursorRow = inputStartRow + physicalLinesBefore + physicalLinesInCurrentBeforeCursor;
    const cursorCol = (totalDisplayWidth % width) + 1;

    writeStdout(`${ESC}[${cursorRow};${cursorCol}H`);
    writeStdout(`${ESC}[?25h`);
    this.state.cursorInScrollArea = false;
  }

  refreshInputAndKeepCursor(): void {
    if (this.state.isStreaming) {
      writeStdout('\x1b7');
    }

    this.refreshInput();
    this.restoreCursor();

    if (this.state.isStreaming) {
      writeStdout('\x1b8');
      writeStdout(`${ESC}[?25l`);
      this.state.cursorInScrollArea = true;
    }
  }

  getDisplayCol(line: string, col: number): number {
    const chars = [...line].slice(0, col);
    return this.getStringDisplayWidth(chars.join(''));
  }

  handleInput(data: string): boolean {
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
        this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol - 1) + line.slice(this.state.cursorCol);
        this.state.cursorCol--;
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
    if (data.includes(`${ESC}[200~`)) {
      this.handlePaste(data);
      return false;
    }
    if (data.startsWith(ESC)) {
      this.handleAnsi(data);
      return false;
    }
    const line = this.state.inputBuffer[0];
    this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol) + data + line.slice(this.state.cursorCol);
    this.state.cursorCol += [...data].length;
    this.updateLayout();
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
      this.state.cursorCol = [...hits[0]].length;
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
    const chars = [...content];
    const line = this.state.inputBuffer[0];
    this.state.inputBuffer[0] = line.slice(0, this.state.cursorCol) + content + line.slice(this.state.cursorCol);
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
}

let instance: ScreenManager | null = null;
export function getScreenManager(): ScreenManager {
  if (!instance) instance = new ScreenManager();
  return instance;
}