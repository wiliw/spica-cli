// 运行时状态管理 - 替代散落的全局变量
class RuntimeStateManager {
    state = {
        agent: null,
        providerConfig: null,
        isProcessing: false,
        bypassMode: false,
        connectionErrorShown: false,
        streamingOutput: false,
        permissionDialogActive: false,
        verboseMode: false, // 默认缩略模式
    };
    // Agent
    setAgent(agent) {
        this.state.agent = agent;
    }
    getAgent() {
        return this.state.agent;
    }
    // Provider Config
    setProviderConfig(config) {
        this.state.providerConfig = config;
    }
    getProviderConfig() {
        return this.state.providerConfig;
    }
    get model() {
        return this.state.providerConfig?.model || '';
    }
    // Processing
    setProcessing(isProcessing) {
        this.state.isProcessing = isProcessing;
    }
    isProcessing() {
        return this.state.isProcessing;
    }
    // Bypass Mode
    setBypassMode(mode) {
        this.state.bypassMode = mode;
    }
    isBypassMode() {
        return this.state.bypassMode;
    }
    // Connection Error
    setConnectionErrorShown(shown) {
        this.state.connectionErrorShown = shown;
    }
    isConnectionErrorShown() {
        return this.state.connectionErrorShown;
    }
    // Streaming Output
    setStreamingOutput(streaming) {
        this.state.streamingOutput = streaming;
    }
    isStreamingOutput() {
        return this.state.streamingOutput;
    }
    // Permission Dialog Active
    setPermissionDialogActive(active) {
        this.state.permissionDialogActive = active;
    }
    isPermissionDialogActive() {
        return this.state.permissionDialogActive;
    }
    // Verbose Mode (详细显示模式)
    setVerboseMode(verbose) {
        this.state.verboseMode = verbose;
    }
    isVerboseMode() {
        return this.state.verboseMode;
    }
    toggleVerboseMode() {
        this.state.verboseMode = !this.state.verboseMode;
        return this.state.verboseMode;
    }
    // Interrupt
    interrupt() {
        if (this.state.agent) {
            this.state.agent.interrupt();
        }
    }
    // Reset
    reset() {
        this.state = {
            agent: null,
            providerConfig: null,
            isProcessing: false,
            bypassMode: false,
            connectionErrorShown: false,
            streamingOutput: false,
            permissionDialogActive: false,
            verboseMode: false, // 默认缩略模式
        };
    }
}
let instance = null;
export function getRuntimeState() {
    if (!instance)
        instance = new RuntimeStateManager();
    return instance;
}
export function resetRuntimeState() {
    if (instance)
        instance.reset();
}
//# sourceMappingURL=RuntimeState.js.map