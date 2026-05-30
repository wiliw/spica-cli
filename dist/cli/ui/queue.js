// 输入队列 - 管理用户输入，支持非阻塞输入和撤回
export class InputQueue {
    queue = [];
    nextId = 1;
    maxSize = 50;
    // 添加输入到队列
    add(content) {
        const input = {
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
    getPending() {
        return this.queue.filter(i => !i.processed);
    }
    // 合并所有未处理的输入为一个指令
    mergePending() {
        const pending = this.getPending();
        if (pending.length === 0)
            return '';
        // 标记为已处理
        pending.forEach(i => i.processed = true);
        // 合并内容
        return pending.map(i => i.content).join('\n');
    }
    // 撤回最后一个未处理的输入
    undoLast() {
        const pending = this.getPending();
        if (pending.length === 0)
            return null;
        const last = pending[pending.length - 1];
        const index = this.queue.indexOf(last);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
        return last;
    }
    // 撤回指定 ID 的输入
    undoById(id) {
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
    clearPending() {
        const count = this.getPending().length;
        this.queue = this.queue.filter(i => i.processed);
        return count;
    }
    // 获取队列状态
    getStatus() {
        const pending = this.getPending();
        return {
            total: this.queue.length,
            pending: pending.length,
            processed: this.queue.filter(i => i.processed).length,
            pendingPreview: pending.slice(-5).map(i => i.content.length > 30 ? i.content.slice(0, 30) + '...' : i.content),
        };
    }
    // 是否有未处理的输入
    hasPending() {
        return this.getPending().length > 0;
    }
    // 获取队列长度
    length() {
        return this.queue.length;
    }
}
// 全局输入队列实例
let globalQueue = null;
export function getInputQueue() {
    if (!globalQueue) {
        globalQueue = new InputQueue();
    }
    return globalQueue;
}
export function clearInputQueue() {
    globalQueue = null;
}
//# sourceMappingURL=queue.js.map