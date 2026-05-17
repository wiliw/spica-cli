// TUI 输入处理

import { LAIN_COLORS } from './colors';
import { InputBox } from './inputBox';
import { getOutputCoordinator } from './outputCoordinator';

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
  private interruptCount: number = 0;
  private coordinator = getOutputCoordinator();

  constructor() {
    this.inputBox = new InputBox();
  }

  getInputBox(): InputBox {
    return this.inputBox;
  }

  start(): void {
    this.inputBox.start();
  }

  end(): void {
    this.inputBox.end();
  }

  handleStdin(data: string, permissionDialogActive: boolean): TUIInputResult {
    if (permissionDialogActive) {
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    if (data === '\x03') {
      this.interruptCount++;
      if (this.interruptCount >= 3) {
        return { content: '', shouldProcess: false, shouldExit: true, isInterrupt: false };
      }
      setTimeout(() => this.interruptCount = 0, 1000);
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    if (data === ESC) {
      const now = Date.now();
      if (now - this.lastEscTime < 500) {
        this.lastEscTime = 0;
        return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: true };
      }
      this.lastEscTime = now;
      return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
    }

    const shouldSend = this.inputBox.handleInput(data);

    if (shouldSend) {
      const content = this.inputBox.getContent();
      this.inputBox.clear();
      this.inputBox.render();
      return { content, shouldProcess: true, shouldExit: false, isInterrupt: false };
    }

    this.inputBox.render();
    return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
  }
}