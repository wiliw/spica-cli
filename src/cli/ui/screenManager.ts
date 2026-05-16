// ANSI Screen Manager - 固定输入框 + 滚动输出区

import { LAIN_COLORS } from './colors';

export class ScreenManager {
  private rows: number;
  private cols: number;
  private contentLines: string[] = [];  // 输出历史
  private maxContentLines = 100;        // 最大保存行数
  private inputBuffer = '';
  private statusLine = '';
  private initialized = false;
  private currentLine = 0;              // 当前输出行位置

  constructor() {
    this.rows = process.stdout.rows || 24;
    this.cols = process.stdout.columns || 80;

    // 监听终端resize
    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows || 24;
      this.cols = process.stdout.columns || 80;
      if (this.initialized) {
        this.redraw();
      }
    });
  }

  // 初始化屏幕布局
  init(): void {
    this.initialized = true;
    this.currentLine = 0;

    // 清屏
    process.stdout.write('\x1b[2J\x1b[1H');

    // 设置滚动区域（从第1行到倒数第4行）
    // DECSTBM: CSI top ; bottom r
    const scrollTop = 1;
    const scrollBottom = this.rows - 4;
    process.stdout.write(`\x1b[${scrollTop};${scrollBottom}r`);

    // 移动光标到滚动区域顶部
    process.stdout.write('\x1b[1;1H');

    // 绘制初始布局
    this.redraw();
  }

  // 清理（退出时恢复终端）
  cleanup(): void {
    // 恢复滚动区域为整个屏幕
    process.stdout.write('\x1b[r');
    // 清屏
    process.stdout.write('\x1b[2J\x1b[1H');
    // 显示光标
    process.stdout.write('\x1b[?25h');
    this.initialized = false;
  }

  // 添加内容到输出区（优化：增量输出）
  addContent(text: string): void {
    if (!this.initialized) return;

    const lines = text.split('\n');
    this.contentLines.push(...lines);

    // 限制最大行数
    if (this.contentLines.length > this.maxContentLines) {
      this.contentLines = this.contentLines.slice(-this.maxContentLines);
    }

    // 保存光标位置
    process.stdout.write('\x1b[s');

    // 移动到滚动区域（底部）
    const scrollBottom = this.rows - 4;

    // 计算当前应该在的位置
    this.currentLine += lines.length;
    if (this.currentLine > scrollBottom) {
      // 超出滚动区域，从底部开始
      this.currentLine = scrollBottom;
    }

    // 输出新内容（让滚动区域自动滚动）
    for (const line of lines) {
      // 移动到滚动区域底部，输出后滚动区域自动向上滚动
      process.stdout.write(`\x1b[${scrollBottom};1H`);
      // 清除该行
      process.stdout.write('\x1b[2K');
      // 输出内容（截断）
      const truncated = line.slice(0, this.cols - 1);
      process.stdout.write(truncated);
      // 添加换行（触发滚动）
      process.stdout.write('\n');
    }

    // 恢复光标到输入行
    process.stdout.write('\x1b[u');
  }

  // 更新状态栏
  setStatus(text: string): void {
    this.statusLine = text;

    if (!this.initialized) return;

    // 保存光标
    process.stdout.write('\x1b[s');

    // 移动到状态行（倒数第3行）
    const statusRow = this.rows - 3;
    process.stdout.write(`\x1b[${statusRow};1H\x1b[2K`);
    process.stdout.write(LAIN_COLORS.muted(text.slice(0, this.cols - 1)));

    // 恢复光标
    process.stdout.write('\x1b[u');
  }

  // 更新输入框
  setInput(text: string): void {
    this.inputBuffer = text;
    this.redrawInput();
  }

  // 获取输入内容
  getInput(): string {
    return this.inputBuffer;
  }

  // 清空输入
  clearInput(): void {
    this.inputBuffer = '';
    this.redrawInput();
  }

  // 重绘整个布局
  redraw(): void {
    if (!this.initialized) return;

    // 重绘状态栏
    const statusRow = this.rows - 3;
    process.stdout.write(`\x1b[${statusRow};1H\x1b[2K`);
    process.stdout.write(LAIN_COLORS.muted(this.statusLine.slice(0, this.cols - 1)));

    // 重绘分隔线
    const sepRow = this.rows - 4;
    process.stdout.write(`\x1b[${sepRow};1H\x1b[2K`);
    process.stdout.write(LAIN_COLORS.muted('─'.repeat(this.cols)));

    // 重绘输入框
    this.redrawInput();
  }

  // 重绘输入框
  private redrawInput(): void {
    if (!this.initialized) return;

    const inputRow = this.rows - 2;
    const promptRow = this.rows - 1;

    // 清除输入区域（2行）
    process.stdout.write(`\x1b[${inputRow};1H\x1b[2K`);
    process.stdout.write(`\x1b[${promptRow};1H\x1b[2K`);

    // 显示提示符和输入内容
    process.stdout.write(`\x1b[${promptRow};1H`);
    process.stdout.write(LAIN_COLORS.primary.bold('> '));

    // 显示输入内容（截断）
    const displayText = this.inputBuffer.slice(-(this.cols - 3));
    process.stdout.write(displayText);

    // 移动光标到输入末尾
    const cursorCol = 3 + displayText.length;
    process.stdout.write(`\x1b[${promptRow};${cursorCol}H`);
  }

  // 移动光标到输入行
  moveToInput(): void {
    if (!this.initialized) return;

    const inputRow = this.rows - 1;
    const cursorCol = 3 + this.inputBuffer.length;
    process.stdout.write(`\x1b[${inputRow};${cursorCol}H`);
  }

  // 清空输出区
  clearContent(): void {
    this.contentLines = [];
    this.currentLine = 0;

    if (this.initialized) {
      const scrollBottom = this.rows - 4;
      for (let i = 1; i <= scrollBottom; i++) {
        process.stdout.write(`\x1b[${i};1H\x1b[2K`);
      }
      this.moveToInput();
    }
  }
}