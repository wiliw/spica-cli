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
  onVerboseToggle?: () => void;  // Ctrl+O 回调
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

  // CJK 字符范围（East Asian Wide）
  // 参考: https://unicode.org/reports/tr11/
  private isCJKChar(char: string): boolean {
    const code = char.charCodeAt(0);
    // CJK 统一汉字: U+4E00 - U+9FFF
    // CJK 扩展 A: U+3400 - U+4DBF
    // CJK 兼容汉字: U+F900 - U+FAFF
    // CJK 统一汉字扩展 B-F 需要代理对处理，暂不支持
    // 日文假名: U+3040 - U+30FF (Hiragana + Katakana)
    // 韩文字母: U+AC00 - U+D7AF (Hangul Syllables)
    // 全角符号: U+FF00 - U+FFEF (Halfwidth and Fullwidth Forms)
    return (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0x3040 && code <= 0x30FF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xFF00 && code <= 0xFFEF)
    );
  }

  // 计算单个字符的显示宽度
  private getCharDisplayWidth(char: string): number {
    if (char === '\n') return 0;  // 换行符不占横向宽度
    if (char === '\t') return 8;  // Tab 宽度 8（或可配置）
    if (this.isCJKChar(char)) return 2;  // CJK 字符宽度 2
    return 1;  // 其他字符（包括 Unicode 符号如 ● ✓ ✗）宽度 1
  }

  // 计算字符串的显示宽度（不含换行符）
  private getStringDisplayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      width += this.getCharDisplayWidth(char);
    }
    return width;
  }

  // 计算输入内容需要的行数
  private calcInputLines(): number {
    const content = this.state.inputBuffer[0];
    const width = this.state.terminalWidth;

    // 按换行符分割成逻辑行
    const logicalLines = content.split('\n');
    let totalLines = 0;

    for (let i = 0; i < logicalLines.length; i++) {
      const line = logicalLines[i];
      // 第一行有 '> ' 前缀（2字符宽度）
      const prefixWidth = i === 0 ? 2 : 0;
      const lineWidth = prefixWidth + this.getStringDisplayWidth(line);
      // 计算该逻辑行在终端中占用的物理行数
      totalLines += Math.max(1, Math.ceil(lineWidth / width));
    }

    return totalLines;
  }

  // 更新布局（输入行数变化时）
  private updateLayout(): void {
    const newLines = this.calcInputLines();
    if (newLines !== this.state.inputLines) {
      const oldStatusRow = this.state.statusRow;
      const oldScrollBottom = this.state.scrollBottom;
      this.state.inputLines = newLines;
      this.state.statusRow = this.state.terminalHeight - newLines - 1;
      this.state.scrollBottom = this.state.statusRow - 1;

      // 清除需要更新的区域
      if (oldStatusRow > this.state.statusRow) {
        // 输入行数增加：清除被输入框覆盖的旧位置
        for (let row = this.state.statusRow + 1; row <= oldStatusRow; row++) {
          fs.writeSync(1, `${ESC}[${row};1H${ESC}[2K`);
        }
      } else if (oldStatusRow < this.state.statusRow) {
        // 输入行数减少：清除变成滚动区域的旧输入位置
        for (let row = oldScrollBottom + 1; row <= this.state.scrollBottom; row++) {
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

    // 按换行符分割内容，渲染多行
    const content = this.state.inputBuffer[0];
    const logicalLines = content.split('\n');
    const inputStartRow = this.state.statusRow + 1;
    const width = this.state.terminalWidth;

    let currentRow = inputStartRow;
    for (let i = 0; i < logicalLines.length; i++) {
      const lineContent = logicalLines[i];
      // 第一行带 '> ' 前缀
      const displayContent = i === 0 ? '> ' + this.formatInputContent(lineContent) : lineContent;

      // 计算该逻辑行占用的物理行数
      const prefixWidth = i === 0 ? 2 : 0;
      const lineWidth = prefixWidth + this.getStringDisplayWidth(lineContent);
      const physicalLines = Math.max(1, Math.ceil(lineWidth / width));

      // 清除该逻辑行占用的所有物理行（防止残留）
      for (let j = 0; j < physicalLines; j++) {
        fs.writeSync(1, `${ESC}[${currentRow + j};1H${ESC}[2K`);
      }

      // 写入内容（只写在第一个物理行，终端自动换行）
      fs.writeSync(1, `${ESC}[${currentRow};1H`);
      fs.writeSync(1, displayContent);

      currentRow += physicalLines;
    }
  }

  restoreCursor(): void {
    const rawContent = this.state.inputBuffer[0];
    const cursorCharPos = this.state.cursorCol;
    const width = this.state.terminalWidth;

    // 使用字符迭代器正确处理 UTF-8
    const chars = [...rawContent];
    const contentBeforeCursor = chars.slice(0, cursorCharPos);

    // 找到光标所在的逻辑行
    let logicalLineIndex = 0;  // 逻辑行索引（从0开始）
    let charsInCurrentLine = 0;  // 当前逻辑行内的字符数
    let totalCharsProcessed = 0;

    for (const char of contentBeforeCursor) {
      if (char === '\n') {
        logicalLineIndex++;
        charsInCurrentLine = 0;
      } else {
        charsInCurrentLine++;
      }
      totalCharsProcessed++;
    }

    // 分割内容获取各逻辑行
    const logicalLines = rawContent.split('\n');
    const currentLogicalLine = logicalLines[logicalLineIndex] || '';

    // 计算光标在当前逻辑行内的字符位置
    const cursorColInLine = charsInCurrentLine;

    // 计算当前逻辑行内光标前的显示宽度
    const charsBeforeCursorInLine = [...currentLogicalLine].slice(0, cursorColInLine);
    let displayWidthInLine = 0;
    for (const char of charsBeforeCursorInLine) {
      displayWidthInLine += this.getCharDisplayWidth(char);
    }

    // 第一行有 '> ' 前缀（2字符宽度）
    const prefixWidth = logicalLineIndex === 0 ? 2 : 0;
    const totalDisplayWidth = prefixWidth + displayWidthInLine;

    // 计算光标所在逻辑行之前的所有逻辑行占用的物理行数
    let physicalLinesBefore = 0;
    for (let i = 0; i < logicalLineIndex; i++) {
      const line = logicalLines[i];
      const pWidth = i === 0 ? 2 : 0;
      const lineWidth = pWidth + this.getStringDisplayWidth(line);
      physicalLinesBefore += Math.max(1, Math.ceil(lineWidth / width));
    }

    // 计算光标在当前逻辑行内占用的物理行数
    const physicalLinesInCurrentBeforeCursor = Math.floor(totalDisplayWidth / width);

    // 计算最终光标位置
    const inputStartRow = this.state.statusRow + 1;
    const cursorRow = inputStartRow + physicalLinesBefore + physicalLinesInCurrentBeforeCursor;
    const cursorCol = (totalDisplayWidth % width) + 1;

    fs.writeSync(1, `${ESC}[${cursorRow};${cursorCol}H`);
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
    const chars = [...line].slice(0, col);
    return this.getStringDisplayWidth(chars.join(''));
  }

  handleInput(data: string): boolean {
    if (data === '\r' || data === '\n') return true;
    // Ctrl+O (\x0f) 切换详细/缩略显示模式
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
    // 插入到光标位置，而不是追加到末尾
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
    fs.writeSync(1, `${ESC}[1;${this.state.scrollBottom}r`);
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
