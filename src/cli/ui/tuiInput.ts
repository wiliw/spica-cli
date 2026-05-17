// TUI 输入处理模块
// 使用 ANSI 控制码实现独立输入框

import { LAIN_COLORS } from './colors';
import { InputBox } from './inputBox';

const ESC = '\x1b';

export interface TUIInputResult {
  content: string;
  shouldProcess: boolean;
  shouldExit: boolean;
  isInterrupt: boolean;
}

export class TUIInputHandler {
  private inputBox: InputBox;
  private lastEscTime: number = 0;
  private isProcessing: boolean = false;
  private interruptCount: number = 0;

  constructor() {
    this.inputBox = new InputBox();
  }

  // 启动 TUI 模式
  start(): void {
    this.inputBox.enableAltScreen();
    this.inputBox.setupScrollRegion();
    this.inputBox.render();
  }

  // 结束 TUI 模式
  end(): void {
    this.inputBox.resetScrollRegion();
    this.inputBox.disableAltScreen();
  }

  // 设置处理状态
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
    if (processing) {
      // 显示处理状态
      this.inputBox.moveToOutputArea();
      process.stdout.write(LAIN_COLORS.primary('Processing... (ESC ESC to interrupt)\n'));
    }
    this.inputBox.render();
  }

  // 处理 stdin 数据
  handleStdin(data: string, permissionDialogActive: boolean): TUIInputResult {
    // 如果权限对话框激活，跳过处理
    if (permissionDialogActive) {
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    // Ctrl+C 处理
    if (data === '\x03') {
      this.interruptCount++;
      if (this.interruptCount >= 3) {
        return { content: '', shouldProcess: false, shouldExit: true, isInterrupt: false };
      }
      // 重置计数器
      setTimeout(() => this.interruptCount = 0, 1000);
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    // ESC ESC 中断
    if (data === ESC) {
      const now = Date.now();
      if (now - this.lastEscTime < 500) {
        this.lastEscTime = 0;
        if (this.isProcessing) {
          return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: true };
        }
      } else {
        this.lastEscTime = now;
      }
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    // InputBox 处理输入
    const shouldSend = this.inputBox.handleInput(data);

    if (shouldSend) {
      const content = this.inputBox.getContent();
      this.inputBox.clear();
      this.inputBox.render();
      return { content, shouldProcess: true, shouldExit: false, isInterrupt: false };
    }

    // 渲染输入框
    this.inputBox.render();
    return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
  }

  // 打印到输出区
  printOutput(text: string): void {
    this.inputBox.moveToOutputArea();
    process.stdout.write(text);
  }

  // 显示完成状态
  showDone(): void {
    this.inputBox.moveToOutputArea();
    process.stdout.write(LAIN_COLORS.success('\n[OK] Done\n'));
    this.inputBox.render();
  }

  // 显示错误
  showError(message: string): void {
    this.inputBox.moveToOutputArea();
    process.stdout.write(LAIN_COLORS.error(`\n[ERR] ${message}\n`));
    this.inputBox.render();
  }

  // 显示中断
  showInterrupted(): void {
    this.inputBox.moveToOutputArea();
    process.stdout.write(LAIN_COLORS.warning('\n[INTERRUPTED]\n'));
    this.inputBox.render();
  }

  getInputBox(): InputBox {
    return this.inputBox;
  }
}