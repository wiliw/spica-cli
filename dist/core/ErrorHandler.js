export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["FILE_SYSTEM"] = "file_system";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["PROCESS"] = "process";
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["UNKNOWN"] = "unknown";
})(ErrorCategory || (ErrorCategory = {}));
export class ErrorHandler {
    autoFixHandlers = new Map();
    reports = [];
    categorize(error) {
        const message = error.message.toLowerCase();
        if (message.includes('enoent') ||
            message.includes('eacces') ||
            message.includes('enotdir') ||
            message.includes('file') ||
            message.includes('directory')) {
            return ErrorCategory.FILE_SYSTEM;
        }
        if (message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('etimedout') ||
            message.includes('network') ||
            message.includes('socket')) {
            return ErrorCategory.NETWORK;
        }
        if (message.includes('process') ||
            message.includes('exited') ||
            message.includes('killed') ||
            message.includes('spawn')) {
            return ErrorCategory.PROCESS;
        }
        if (message.includes('invalid') ||
            message.includes('required') ||
            message.includes('validation')) {
            return ErrorCategory.VALIDATION;
        }
        return ErrorCategory.UNKNOWN;
    }
    async handle(error, options) {
        const category = this.categorize(error);
        let fixed = false;
        let fixError;
        if (options?.autoFix !== false && this.autoFixHandlers.has(category)) {
            try {
                const handler = this.autoFixHandlers.get(category);
                fixed = await handler(error);
            }
            catch (e) {
                fixError = e instanceof Error ? e.message : String(e);
            }
        }
        this.reports.push({
            timestamp: new Date(),
            message: error.message,
            category,
            stack: error.stack,
            fixed,
            fixError,
        });
        return { category, fixed, fixError };
    }
    registerAutoFix(category, handler) {
        this.autoFixHandlers.set(category, handler);
    }
    async retry(operation, options) {
        const { maxRetries, backoff = 'linear', initialDelay = 100, onRetry } = options;
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxRetries) {
                    if (onRetry) {
                        onRetry(attempt, lastError);
                    }
                    const delay = backoff === 'exponential'
                        ? initialDelay * Math.pow(2, attempt - 1)
                        : initialDelay * attempt;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }
    getReports() {
        return [...this.reports];
    }
    clearReports() {
        this.reports = [];
    }
}
//# sourceMappingURL=ErrorHandler.js.map