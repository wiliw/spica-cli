// Output Coordinator - 所有终端写入通过此协调器同步执行
// 使用 fs.writeSync 确保写入是同步的，不会和其他写入冲突

import fs from 'fs';

class OutputCoordinator {
  private buffer: string = '';

  // 同步写入（使用 fs.writeSync 直接写入 stdout fd）
  write(text: string): void {
    // 累积到缓冲区
    this.buffer += text;
    // 立即同步刷新
    this.flush();
  }

  // 紧急输出（用于中断等特殊情况）
  writeImmediate(text: string): void {
    fs.writeSync(1, text);  // fd 1 = stdout
  }

  // 同步刷新缓冲区到 stdout
  private flush(): void {
    if (this.buffer.length === 0) return;

    // 使用 fs.writeSync 同步写入
    fs.writeSync(1, this.buffer);
    this.buffer = '';
  }

  // 清空缓冲区
  clear(): void {
    this.buffer = '';
  }
}

let coordinator: OutputCoordinator | null = null;

export function getOutputCoordinator(): OutputCoordinator {
  if (!coordinator) {
    coordinator = new OutputCoordinator();
  }
  return coordinator;
}