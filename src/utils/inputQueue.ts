// 输入队列 - 管理用户输入，支持非阻塞输入和撤回

export interface QueuedInput {
  id: number;
  content: string;
  timestamp: Date;
  processed: boolean;
}

export class InputQueue {
  private queue: QueuedInput[] = [];
  private nextId: number = 1;
  private maxSize: number = 50;

  // 添加输入到队列
  add(content: string): QueuedInput {
    const input: QueuedInput = {
      id: this.nextId++,
      content: content.trim(),
      timestamp: new Date(),
      processed: false,
    };

    this.queue.push(input);

    // 限制队列大小
    if (this.queue.length > this.maxSize) {
      this.queue.shift();
    }

    return input;
  }

  // 获取所有未处理的输入
  getPending(): QueuedInput[] {
    return this.queue.filter(i => !i.processed);
  }

  // 合并所有未处理的输入为一个指令
  mergePending(): string {
    const pending = this.getPending();
    if (pending.length === 0) return '';

    // 标记为已处理
    pending.forEach(i => i.processed = true);

    // 合并内容
    return pending.map(i => i.content).join('\n');
  }

  // 撤回最后一个未处理的输入
  undoLast(): QueuedInput | null {
    const pending = this.getPending();
    if (pending.length === 0) return null;

    const last = pending[pending.length - 1];
    const index = this.queue.indexOf(last);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
    return last;
  }

  // 撤回指定 ID 的输入
  undoById(id: number): QueuedInput | null {
    const input = this.queue.find(i => i.id === id && !i.processed);
    if (input) {
      const index = this.queue.indexOf(input);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
      return input;
    }
    return null;
  }

  // 清空所有未处理的输入
  clearPending(): number {
    const count = this.getPending().length;
    this.queue = this.queue.filter(i => i.processed);
    return count;
  }

  // 获取队列状态
  getStatus(): {
    total: number;
    pending: number;
    processed: number;
    pendingPreview: string[];
  } {
    const pending = this.getPending();
    return {
      total: this.queue.length,
      pending: pending.length,
      processed: this.queue.filter(i => i.processed).length,
      pendingPreview: pending.slice(-5).map(i =>
        i.content.length > 30 ? i.content.slice(0, 30) + '...' : i.content
      ),
    };
  }

  // 是否有未处理的输入
  hasPending(): boolean {
    return this.getPending().length > 0;
  }

  // 获取队列长度
  length(): number {
    return this.queue.length;
  }
}

// 全局输入队列实例
let globalQueue: InputQueue | null = null;

export function getInputQueue(): InputQueue {
  if (!globalQueue) {
    globalQueue = new InputQueue();
  }
  return globalQueue;
}

export function clearInputQueue(): void {
  globalQueue = null;
}