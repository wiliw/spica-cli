import { LAIN_COLORS } from './colors';
import { getScreenManager } from './screenManager';

const ESC = '\x1b';

export interface TUIInputResult {
  content: string;
  shouldProcess: boolean;
  shouldExit: boolean;
  isInterrupt: boolean;
}

export class TUIInputHandler {
  private screen: ReturnType<typeof getScreenManager>;
  private lastEscTime: number = 0;
  private interruptCount: number = 0;

  constructor() {
    this.screen = getScreenManager();
  }

  getScreen() {
    return this.screen;
  }

  start(): void {
    this.screen.start();
  }

  end(): void {
    this.screen.end();
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

    const shouldSend = this.screen.handleInput(data);

    if (shouldSend) {
      const content = this.screen.getContent();
      this.screen.clear();
      return { content, shouldProcess: true, shouldExit: false, isInterrupt: false };
    }

    return { content: '', shouldProcess: false, shouldExit: false, isInterrupt: false };
  }
}