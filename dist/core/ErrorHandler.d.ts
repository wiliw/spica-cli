export declare enum ErrorCategory {
    FILE_SYSTEM = "file_system",
    NETWORK = "network",
    PROCESS = "process",
    VALIDATION = "validation",
    UNKNOWN = "unknown"
}
export interface ErrorReport {
    timestamp: Date;
    message: string;
    category: ErrorCategory;
    stack?: string;
    fixed: boolean;
    fixError?: string;
}
export interface ErrorResult {
    category: ErrorCategory;
    fixed: boolean;
    fixError?: string;
}
export interface RetryOptions {
    maxRetries: number;
    backoff?: 'linear' | 'exponential';
    initialDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
}
type AutoFixHandler = (error: Error) => Promise<boolean>;
export declare class ErrorHandler {
    private autoFixHandlers;
    private reports;
    categorize(error: Error): ErrorCategory;
    handle(error: Error, options?: {
        autoFix?: boolean;
    }): Promise<ErrorResult>;
    registerAutoFix(category: ErrorCategory, handler: AutoFixHandler): void;
    retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T>;
    getReports(): ErrorReport[];
    clearReports(): void;
}
export {};
//# sourceMappingURL=ErrorHandler.d.ts.map