export interface HeartbeatConfig {
    interval?: number;
    message?: string;
    maxCount?: number;
    showProgress?: boolean;
}
export interface ProgressInfo {
    current: number;
    total: number;
    label?: string;
}
export declare class Heartbeat {
    private timer;
    private count;
    private config;
    private output;
    private progress;
    constructor(output: (msg: string) => void, config?: HeartbeatConfig);
    setProgress(info: ProgressInfo): void;
    clearProgress(): void;
    start(): void;
    stop(): void;
    isRunning(): boolean;
    setOutput(output: (msg: string) => void): void;
}
export declare function getHeartbeat(): Heartbeat | null;
export declare function createHeartbeat(output: (msg: string) => void, config?: HeartbeatConfig): Heartbeat;
export declare function startHeartbeat(): void;
export declare function stopHeartbeat(): void;
export declare function clearHeartbeat(): void;
export declare function updateHeartbeatProgress(info: ProgressInfo): void;
export declare function clearHeartbeatProgress(): void;
//# sourceMappingURL=Heartbeat.d.ts.map