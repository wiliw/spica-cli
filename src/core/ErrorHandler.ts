export enum ErrorCategory {
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  PROCESS = 'process',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
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

export class ErrorHandler {
  private autoFixHandlers: Map<ErrorCategory, AutoFixHandler> = new Map();
  private reports: ErrorReport[] = [];

  categorize(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (
      message.includes('enoent') ||
      message.includes('eacces') ||
      message.includes('enotdir') ||
      message.includes('file') ||
      message.includes('directory')
    ) {
      return ErrorCategory.FILE_SYSTEM;
    }

    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('network') ||
      message.includes('socket')
    ) {
      return ErrorCategory.NETWORK;
    }

    if (
      message.includes('process') ||
      message.includes('exited') ||
      message.includes('killed') ||
      message.includes('spawn')
    ) {
      return ErrorCategory.PROCESS;
    }

    if (
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('validation')
    ) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  async handle(
    error: Error,
    options?: { autoFix?: boolean }
  ): Promise<ErrorResult> {
    const category = this.categorize(error);
    let fixed = false;
    let fixError: string | undefined;

    if (options?.autoFix !== false && this.autoFixHandlers.has(category)) {
      try {
        const handler = this.autoFixHandlers.get(category)!;
        fixed = await handler(error);
      } catch (e) {
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

  registerAutoFix(category: ErrorCategory, handler: AutoFixHandler): void {
    this.autoFixHandlers.set(category, handler);
  }

  async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxRetries, backoff = 'linear', initialDelay = 100, onRetry } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          if (onRetry) {
            onRetry(attempt, lastError);
          }

          const delay =
            backoff === 'exponential'
              ? initialDelay * Math.pow(2, attempt - 1)
              : initialDelay * attempt;

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  getReports(): ErrorReport[] {
    return [...this.reports];
  }

  clearReports(): void {
    this.reports = [];
  }
}