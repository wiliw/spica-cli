import fs from 'fs-extra';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export enum LogCategory {
  SYSTEM = 'system',
  SESSION = 'session',
  PROCESS = 'process',
  PERFORMANCE = 'performance',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

export class LogManager {
  private logs: LogEntry[] = [];
  private minLevel: LogLevel = LogLevel.DEBUG;
  private logDir: string;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  async log(
    level: LogLevel,
    message: string,
    category: LogCategory,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
    };

    this.logs.push(entry);
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  async getLogs(category?: LogCategory): Promise<LogEntry[]> {
    let filtered = this.logs.filter(log => log.level >= this.minLevel);
    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }
    return [...filtered];
  }

  async performance(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log(
      LogLevel.INFO,
      `Performance: ${operation}`,
      LogCategory.PERFORMANCE,
      { ...metadata, duration }
    );
  }

  async flush(): Promise<void> {
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