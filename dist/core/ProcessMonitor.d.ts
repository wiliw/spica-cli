export declare enum ProcessStatus {
    RUNNING = "running",
    EXITED = "exited",
    KILLED = "killed",
    FAILED = "failed"
}
export interface ProcessInfo {
    id: string;
    pid?: number;
    command: string;
    args: string[];
    status: ProcessStatus;
    startTime: Date;
    endTime?: Date;
    exitCode?: number;
}
export interface ProcessLogs {
    stdout: string;
    stderr: string;
}
export declare class ProcessMonitor {
    private processDir;
    private processes;
    private logs;
    constructor(processDir: string);
    start(command: string, args: string[], id?: string): Promise<ProcessInfo>;
    monitor(id: string): Promise<ProcessInfo | undefined>;
    kill(id: string): Promise<boolean>;
    getLogs(id: string): Promise<ProcessLogs>;
    list(): Promise<ProcessInfo[]>;
    killAll(): Promise<void>;
    private persistLogs;
}
//# sourceMappingURL=ProcessMonitor.d.ts.map