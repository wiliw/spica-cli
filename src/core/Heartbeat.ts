// 心跳提示 - 在长时间等待期间输出进度提示

export interface HeartbeatConfig {
  interval?: number;     // 心跳间隔（毫秒），默认 3000
  message?: string;      // 心跳消息，默认 '.'
  maxCount?: number;     // 最大心跳次数，默认 20（约60秒）
}

export class Heartbeat {
  private timer: NodeJS.Timeout | null = null;
  private count: number = 0;
  private config: HeartbeatConfig;
  private output: (msg: string) => void;

  constructor(output: (msg: string) => void, config?: HeartbeatConfig) {
    this.output = output;
    this.config = {
      interval: config?.interval || 3000,
      message: config?.message || '.',
      maxCount: config?.maxCount || 20,
    };
  }

  // 启动心跳
  start(): void {
    if (this.timer) return;

    this.count = 0;
    this.timer = setInterval(() => {
      this.count++;
      if (this.count > this.config.maxCount!) {
        // 超过最大次数，输出超时提示并停止
        this.output('\n[TIMEOUT] Response taking too long, press Ctrl+C to interrupt\n');
        this.stop();
        return;
      }
      this.output(this.config.message!);
    }, this.config.interval!);
  }

  // 停止心跳
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.count = 0;
    }
  }

  // 是否正在运行
  isRunning(): boolean {
    return this.timer !== null;
  }

  // 更新输出函数（用于切换输出目标）
  setOutput(output: (msg: string) => void): void {
    this.output = output;
  }
}

// 全局心跳实例（由 RuntimeState 管理）
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