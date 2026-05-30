// 心跳提示 - 在长时间等待期间输出进度提示
import { getRuntimeState } from './RuntimeState';
export class Heartbeat {
    timer = null;
    count = 0;
    config;
    output;
    progress = null;
    constructor(output, config) {
        this.output = output;
        this.config = {
            interval: config?.interval || 3000,
            message: config?.message || '.',
            maxCount: config?.maxCount || 20,
            showProgress: config?.showProgress ?? true,
        };
    }
    // 设置进度信息
    setProgress(info) {
        this.progress = info;
    }
    // 清除进度信息
    clearProgress() {
        this.progress = null;
    }
    // 启动心跳
    start() {
        if (this.timer)
            return;
        this.count = 0;
        timeoutInjected = false; // 重置注入标记
        // 立即显示第一个心跳符号，让用户知道正在等待
        this.output(this.config.message);
        this.timer = setInterval(() => {
            this.count++;
            if (this.count > this.config.maxCount) {
                this.output('\n[TIMEOUT] Response took >120s. AI will handle recovery...\n');
                this.stop();
                // 防止重复注入timeout消息
                if (!timeoutInjected) {
                    const state = getRuntimeState();
                    const agent = state.getAgent();
                    const llm = agent?.getLLM();
                    if (llm) {
                        timeoutInjected = true; // 标记已注入
                        // 注入timeout消息，让AI自己决定如何处理
                        llm.addUserMessage('[TIMEOUT WARNING] Response took too long (>120s). Please:\n1. Try different approach or simpler solution\n2. Use subagent (task tool) for complex tasks\n3. Check API/network status if external call\n4. Continue from where you left off, or explain issue');
                        // 不interrupt，让AI继续处理新的prompt
                        // 停止heartbeat等待新的LLM响应
                    }
                    else {
                        // 没有LLM可用，只能interrupt
                        if (agent) {
                            agent.interrupt();
                        }
                        state.setProcessing(false);
                    }
                }
                return;
            }
            // 显示进度或普通心跳
            if (this.config.showProgress && this.progress) {
                const percent = Math.round((this.progress.current / this.progress.total) * 100);
                const label = this.progress.label || 'Progress';
                this.output(`\n[${label}] ${percent}% (${this.progress.current}/${this.progress.total})`);
            }
            else {
                this.output(this.config.message);
            }
        }, this.config.interval);
    }
    // 停止心跳
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.count = 0;
            this.progress = null;
        }
    }
    // 是否正在运行
    isRunning() {
        return this.timer !== null;
    }
    // 更新输出函数
    setOutput(output) {
        this.output = output;
    }
}
// 全局心跳实例
let globalHeartbeat = null;
let timeoutInjected = false; // 防止重复注入timeout消息
export function getHeartbeat() {
    return globalHeartbeat;
}
export function createHeartbeat(output, config) {
    globalHeartbeat = new Heartbeat(output, config);
    return globalHeartbeat;
}
export function startHeartbeat() {
    if (globalHeartbeat) {
        globalHeartbeat.start();
    }
}
export function stopHeartbeat() {
    if (globalHeartbeat) {
        globalHeartbeat.stop();
    }
}
export function clearHeartbeat() {
    if (globalHeartbeat) {
        globalHeartbeat.stop();
        globalHeartbeat = null;
    }
}
// 更新进度信息
export function updateHeartbeatProgress(info) {
    if (globalHeartbeat) {
        globalHeartbeat.setProgress(info);
    }
}
// 清除进度信息
export function clearHeartbeatProgress() {
    if (globalHeartbeat) {
        globalHeartbeat.clearProgress();
    }
}
//# sourceMappingURL=Heartbeat.js.map