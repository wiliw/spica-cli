import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { LogManager, LogLevel, LogCategory } from '../LogManager';
const TEST_LOG_DIR = '/tmp/spica-test-logs';
describe('LogManager', () => {
    let logManager;
    beforeEach(async () => {
        await fs.ensureDir(TEST_LOG_DIR);
        logManager = new LogManager(TEST_LOG_DIR);
    });
    afterEach(async () => {
        await fs.remove(TEST_LOG_DIR);
    });
    describe('log levels', () => {
        it('logs with different levels', async () => {
            await logManager.log(LogLevel.INFO, 'Test message', LogCategory.SYSTEM);
            await logManager.log(LogLevel.ERROR, 'Error message', LogCategory.PROCESS);
            await logManager.log(LogLevel.DEBUG, 'Debug message', LogCategory.PERFORMANCE);
            const logs = await logManager.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs[0].level).toBe(LogLevel.INFO);
            expect(logs[1].level).toBe(LogLevel.ERROR);
            expect(logs[2].level).toBe(LogLevel.DEBUG);
        });
        it('filters logs by level', async () => {
            await logManager.log(LogLevel.DEBUG, 'Debug', LogCategory.SYSTEM);
            await logManager.log(LogLevel.INFO, 'Info', LogCategory.SYSTEM);
            await logManager.log(LogLevel.WARN, 'Warn', LogCategory.SYSTEM);
            await logManager.log(LogLevel.ERROR, 'Error', LogCategory.SYSTEM);
            logManager.setMinLevel(LogLevel.WARN);
            const logs = await logManager.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].level).toBe(LogLevel.WARN);
            expect(logs[1].level).toBe(LogLevel.ERROR);
        });
    });
    describe('categories', () => {
        it('logs with categories', async () => {
            await logManager.log(LogLevel.INFO, 'Session msg', LogCategory.SESSION);
            await logManager.log(LogLevel.INFO, 'Process msg', LogCategory.PROCESS);
            const sessionLogs = await logManager.getLogs(LogCategory.SESSION);
            expect(sessionLogs).toHaveLength(1);
            expect(sessionLogs[0].message).toBe('Session msg');
        });
    });
    describe('structured data', () => {
        it('includes metadata in log entries', async () => {
            const metadata = { sessionId: '123', duration: 500 };
            await logManager.log(LogLevel.INFO, 'Operation', LogCategory.PERFORMANCE, metadata);
            const logs = await logManager.getLogs();
            expect(logs[0].metadata).toEqual(metadata);
            expect(logs[0].timestamp).toBeDefined();
        });
    });
    describe('performance logging', () => {
        it('logs performance metrics', async () => {
            await logManager.performance('task-execution', 1500, { task: 'build' });
            const logs = await logManager.getLogs(LogCategory.PERFORMANCE);
            expect(logs).toHaveLength(1);
            expect(logs[0].message).toContain('task-execution');
            expect(logs[0].metadata?.duration).toBe(1500);
        });
    });
    describe('persistence', () => {
        it('persists logs to file', async () => {
            await logManager.log(LogLevel.INFO, 'Persist me', LogCategory.SYSTEM);
            await logManager.flush();
            const logFiles = await fs.readdir(TEST_LOG_DIR);
            expect(logFiles.length).toBeGreaterThan(0);
        });
        it('rotates logs by date', async () => {
            const today = new Date().toISOString().split('T')[0];
            await logManager.log(LogLevel.INFO, 'Test', LogCategory.SYSTEM);
            await logManager.flush();
            const logFiles = await fs.readdir(TEST_LOG_DIR);
            expect(logFiles.some(f => f.includes(today))).toBe(true);
        });
    });
});
//# sourceMappingURL=LogManager.test.js.map