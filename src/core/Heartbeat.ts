// 心跳提示 - 在长时间等待期间输出进度提示

export interface HeartbeatConfig {
  interval?: number;     // 心跳间隔（毫秒），默认 3000
  message?: string;      // 心跳消息，默认 '.'
  maxCount?: number;     // 最大心跳次数，默认 20（约60秒）
  showProgress?: boolean; // 是否显示进度百分比
}

export interface ProgressInfo {
  current: number;
  total: number;
  label?: string;
}

export class Heartbeat {
  private timer: NodeJS.Timeout | null = null;
  private count: number = 0;
  private config: HeartbeatConfig;
  private output: (msg: string) => void;
  private progress: ProgressInfo | null = null;

  constructor(output: (msg: string) => void, config?: HeartbeatConfig) {
    this.output = output;
    this.config = {
      interval: config?.interval || 3000,
      message: config?.message || '.',
      maxCount: config?.maxCount || 20,
      showProgress: config?.showProgress ?? true,
    };
  }

  // 设置进度信息
  setProgress(info: ProgressInfo): void {
    this.progress = info;
  }

  // 清除进度信息
  clearProgress(): void {
    this.progress = null;
  }

  // 启动心跳
  start(): void {
    if (this.timer) return;

    this.count = 0;
    this.timer = setInterval(() => {
      this.count++;

      if (this.count > this.config.maxCount!) {
        this.output('\n[TIMEOUT] Response taking too long, press ESC ESC to interrupt\n');
        this.stop();
        return;
      }

      // 显示进度或普通心跳
      if (this.config.showProgress && this.progress) {
        const percent = Math.round((this.progress.current / this.progress.total) * 100);
        const label = this.progress.label || 'Progress';
        this.output(`\n[${label}] ${percent}% (${this.progress.current}/${this.progress.total})`);
      } else {
        this.output(this.config.message!);
      }
    }, this.config.interval!);
  }

  // 停止心跳
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.count = 0;
      this.progress = null;
    }
  }

  // 是否正在运行
  isRunning(): boolean {
    return this.timer !== null;
  }

  // 更新输出函数
  setOutput(output: (msg: string) => void): void {
    this.output = output;
  }
}

// 全局心跳实例
let globalHeartbeat: Heartbeat | null = null;

export function getHeartbeat(): Heartbeat | null {
  return globalHeartbeat;
}

export function createHeartbeat(output: (msg: string) => void, config?: HeartbeatConfig): Heartbeat {
  globalHeartbeat = new Heartbeat(output, config);
  return globalHeartbeat;
}

export function startHeartbeat(): void {
  if (globalHeartbeat) {
    globalHeartbeat.start();
  }
}

export function stopHeartbeat(): void {
  if (globalHeartbeat) {
    globalHeartbeat.stop();
  }
}

export function clearHeartbeat(): void {
  if (globalHeartbeat) {
    globalHeartbeat.stop();
    globalHeartbeat = null;
  }
}

// 更新进度信息
export function updateHeartbeatProgress(info: ProgressInfo): void {
  if (globalHeartbeat) {
    globalHeartbeat.setProgress(info);
  }
}

// 清除进度信息
export function clearHeartbeatProgress(): void {
  if (globalHeartbeat) {
    globalHeartbeat.clearProgress();
  }
}