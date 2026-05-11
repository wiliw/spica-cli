import fs from 'fs-extra';
import path from 'path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export var LogCategory;
(function (LogCategory) {
    LogCategory["SYSTEM"] = "system";
    LogCategory["SESSION"] = "session";
    LogCategory["PROCESS"] = "process";
    LogCategory["PERFORMANCE"] = "performance";
    LogCategory["ERROR"] = "error";
})(LogCategory || (LogCategory = {}));
export class LogManager {
    logs = [];
    minLevel = LogLevel.DEBUG;
    logDir;
    flushPromise = Promise.resolve();
    constructor(logDir) {
        this.logDir = logDir;
    }
    async log(level, message, category, metadata) {
        if (level < this.minLevel)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            metadata,
        };
        this.logs.push(entry);
    }
    setMinLevel(level) {
        this.minLevel = level;
    }
    async getLogs(category) {
        let filtered = this.logs.filter(log => log.level >= this.minLevel);
        if (category) {
            filtered = filtered.filter(log => log.category === category);
        }
        return [...filtered];
    }
    async performance(operation, duration, metadata) {
        await this.log(LogLevel.INFO, `Performance: ${operation}`, LogCategory.PERFORMANCE, { ...metadata, duration });
    }
    async flush() {
        await this.flushPromise;
        this.flushPromise = (async () => {
            await fs.ensureDir(this.logDir);
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `spica-${today}.log`);
            const logData = this.logs.map(log => JSON.stringify(log)).join('\n') + '\n';
            await fs.appendFile(logFile, logData);
            this.logs = [];
        })();
        await this.flushPromise;
    }
}
//# sourceMappingURL=LogManager.js.map