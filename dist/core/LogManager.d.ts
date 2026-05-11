export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare enum LogCategory {
    SYSTEM = "system",
    SESSION = "session",
    PROCESS = "process",
    PERFORMANCE = "performance",
    ERROR = "error"
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    metadata?: Record<string, unknown>;
}
export declare class LogManager {
    private logs;
    private minLevel;
    private logDir;
    private flushPromise;
    constructor(logDir: string);
    log(level: LogLevel, message: string, category: LogCategory, metadata?: Record<string, unknown>): Promise<void>;
    setMinLevel(level: LogLevel): void;
    getLogs(category?: LogCategory): Promise<LogEntry[]>;
    performance(operation: string, duration: number, metadata?: Record<string, unknown>): Promise<void>;
    flush(): Promise<void>;
}
//# sourceMappingURL=LogManager.d.ts.map