import { SpicaAgent } from '../agent';
declare class RuntimeStateManager {
    private state;
    setAgent(agent: SpicaAgent | null): void;
    getAgent(): SpicaAgent | null;
    setProviderConfig(config: any): void;
    getProviderConfig(): any;
    get model(): string;
    setProcessing(isProcessing: boolean): void;
    isProcessing(): boolean;
    setBypassMode(mode: boolean): void;
    isBypassMode(): boolean;
    setConnectionErrorShown(shown: boolean): void;
    isConnectionErrorShown(): boolean;
    setStreamingOutput(streaming: boolean): void;
    isStreamingOutput(): boolean;
    setPermissionDialogActive(active: boolean): void;
    isPermissionDialogActive(): boolean;
    setVerboseMode(verbose: boolean): void;
    isVerboseMode(): boolean;
    toggleVerboseMode(): boolean;
    interrupt(): void;
    reset(): void;
}
export declare function getRuntimeState(): RuntimeStateManager;
export declare function resetRuntimeState(): void;
export {};
//# sourceMappingURL=RuntimeState.d.ts.map