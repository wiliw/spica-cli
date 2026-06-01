// 运行时状态管理 - 替代散落的全局变量

import { SpicaAgent } from '../agent';

interface RuntimeState {
  agent: SpicaAgent | null;
  providerConfig: any;
  isProcessing: boolean;
  bypassMode: boolean;
  connectionErrorShown: boolean;
  streamingOutput: boolean;
  permissionDialogActive: boolean;
  verboseMode: boolean;
  showThinking: boolean;
}

class RuntimeStateManager {
  private state: RuntimeState = {
    agent: null,
    providerConfig: null,
    isProcessing: false,
    bypassMode: false,
    connectionErrorShown: false,
    streamingOutput: false,
    permissionDialogActive: false,
    verboseMode: false,
    showThinking: false,
  };

  // Agent
  setAgent(agent: SpicaAgent | null): void {
    this.state.agent = agent;
  }

  getAgent(): SpicaAgent | null {
    return this.state.agent;
  }

  // Provider Config
  setProviderConfig(config: any): void {
    this.state.providerConfig = config;
  }

  getProviderConfig(): any {
    return this.state.providerConfig;
  }

  get model(): string {
    return this.state.providerConfig?.model || '';
  }

  // Processing
  setProcessing(isProcessing: boolean): void {
    this.state.isProcessing = isProcessing;
  }

  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  // Bypass Mode
  setBypassMode(bypass: boolean): void {
    this.state.bypassMode = bypass;
  }

  isBypassMode(): boolean {
    return this.state.bypassMode;
  }

  // Connection Error
  setConnectionErrorShown(shown: boolean): void {
    this.state.connectionErrorShown = shown;
  }

  isConnectionErrorShown(): boolean {
    return this.state.connectionErrorShown;
  }

  // Streaming Output
  setStreamingOutput(streaming: boolean): void {
    this.state.streamingOutput = streaming;
  }

  isStreamingOutput(): boolean {
    return this.state.streamingOutput;
  }

  // Permission Dialog Active
  setPermissionDialogActive(active: boolean): void {
    this.state.permissionDialogActive = active;
  }

  isPermissionDialogActive(): boolean {
    return this.state.permissionDialogActive;
  }

  // Verbose Mode
  setVerboseMode(verbose: boolean): void {
    this.state.verboseMode = verbose;
  }

  isVerboseMode(): boolean {
    return this.state.verboseMode;
  }

  toggleVerboseMode(): boolean {
    this.state.verboseMode = !this.state.verboseMode;
    return this.state.verboseMode;
  }

  // Thinking 显示模式（Ctrl+O 切换）
  setShowThinking(show: boolean): void {
    this.state.showThinking = show;
  }

  isShowThinking(): boolean {
    return this.state.showThinking;
  }

  toggleShowThinking(): boolean {
    this.state.showThinking = !this.state.showThinking;
    return this.state.showThinking;
  }

  // Interrupt
  interrupt(): void {
    if (this.state.agent) {
      this.state.agent.interrupt();
    }
  }

  // Reset
  reset(): void {
    this.state = {
      agent: null,
      providerConfig: null,
      isProcessing: false,
      bypassMode: false,
      connectionErrorShown: false,
      streamingOutput: false,
      permissionDialogActive: false,
      verboseMode: false,
      showThinking: false,
    };
  }
}

let instance: RuntimeStateManager | null = null;

export function getRuntimeState(): RuntimeStateManager {
  if (!instance) instance = new RuntimeStateManager();
  return instance;
}

export function resetRuntimeState(): void {
  if (instance) instance.reset();
}