import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, ErrorCategory } from '../ErrorHandler';
describe('ErrorHandler', () => {
    let errorHandler;
    beforeEach(() => {
        errorHandler = new ErrorHandler();
    });
    describe('handle', () => {
        it('categorizes errors', async () => {
            const error = new Error('ENOENT: no such file');
            const result = await errorHandler.handle(error);
            expect(result.category).toBe(ErrorCategory.FILE_SYSTEM);
        });
        it('categorizes network errors', async () => {
            const error = new Error('ECONNREFUSED');
            const result = await errorHandler.handle(error);
            expect(result.category).toBe(ErrorCategory.NETWORK);
        });
        it('categorizes process errors', async () => {
            const error = new Error('Process exited with code 1');
            const result = await errorHandler.handle(error);
            expect(result.category).toBe(ErrorCategory.PROCESS);
        });
    });
    describe('retry', () => {
        it('retries failed operations', async () => {
            let attempts = 0;
            const operation = async () => {
                attempts++;
                if (attempts < 3)
                    throw new Error('Temporary failure');
                return 'success';
            };
            const result = await errorHandler.retry(operation, { maxRetries: 3 });
            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });
        it('throws after max retries', async () => {
            const operation = async () => {
                throw new Error('Always fails');
            };
            await expect(errorHandler.retry(operation, { maxRetries: 2 })).rejects.toThrow('Always fails');
        });
        it('calls onRetry callback', async () => {
            const onRetry = vi.fn();
            let attempts = 0;
            await errorHandler.retry(async () => {
                attempts++;
                if (attempts < 2)
                    throw new Error('Retry me');
            }, { maxRetries: 3, onRetry });
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
        });
        it('supports exponential backoff delay', async () => {
            let attempts = 0;
            const start = Date.now();
            await errorHandler.retry(async () => {
                attempts++;
                if (attempts < 2)
                    throw new Error('Retry');
            }, { maxRetries: 3, backoff: 'exponential', initialDelay: 100 });
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(100);
        });
    });
    describe('auto-fix', () => {
        it('executes auto-fix handlers', async () => {
            const error = new Error('ENOENT: file not found');
            const fixHandler = vi.fn().mockResolvedValue(true);
            errorHandler.registerAutoFix(ErrorCategory.FILE_SYSTEM, fixHandler);
            const result = await errorHandler.handle(error, { autoFix: true });
            expect(fixHandler).toHaveBeenCalled();
            expect(result.fixed).toBe(true);
        });
        it('skips auto-fix when disabled', async () => {
            const error = new Error('ENOENT: file not found');
            const fixHandler = vi.fn();
            errorHandler.registerAutoFix(ErrorCategory.FILE_SYSTEM, fixHandler);
            const result = await errorHandler.handle(error, { autoFix: false });
            expect(fixHandler).not.toHaveBeenCalled();
            expect(result.fixed).toBe(false);
        });
        it('handles auto-fix failure gracefully', async () => {
            const error = new Error('ENOENT: file not found');
            const fixHandler = vi.fn().mockRejectedValue(new Error('Fix failed'));
            errorHandler.registerAutoFix(ErrorCategory.FILE_SYSTEM, fixHandler);
            const result = await errorHandler.handle(error, { autoFix: true });
            expect(result.fixed).toBe(false);
            expect(result.fixError).toBeDefined();
        });
    });
    describe('error reporting', () => {
        it('collects error reports', async () => {
            const error = new Error('Test error');
            await errorHandler.handle(error);
            const reports = errorHandler.getReports();
            expect(reports).toHaveLength(1);
            expect(reports[0].message).toBe('Test error');
        });
        it('clears error reports', async () => {
            await errorHandler.handle(new Error('Error 1'));
            await errorHandler.handle(new Error('Error 2'));
            errorHandler.clearReports();
            expect(errorHandler.getReports()).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=ErrorHandler.test.js.map