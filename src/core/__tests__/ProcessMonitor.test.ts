import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { ProcessMonitor, ProcessInfo, ProcessStatus } from '../ProcessMonitor';

const getTestProcessDir = () => `/tmp/spica-test-processes-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe('ProcessMonitor', () => {
  let monitor: ProcessMonitor;
  let testProcessDir: string;

  beforeEach(async () => {
    testProcessDir = getTestProcessDir();
    await fs.ensureDir(testProcessDir);
    monitor = new ProcessMonitor(testProcessDir);
  });

  afterEach(async () => {
    await monitor.killAll();
    await fs.remove(testProcessDir);
  });

  describe('start', () => {
    it('starts a process and tracks it', async () => {
      const info = await monitor.start('echo', ['hello'], 'test-process');

      expect(info.id).toBe('test-process');
      expect(info.pid).toBeDefined();
      expect(info.status).toBe(ProcessStatus.RUNNING);
    });

    it('assigns unique id if not provided', async () => {
      const info = await monitor.start('echo', ['test']);

      expect(info.id).toBeDefined();
      expect(info.id.length).toBeGreaterThan(0);
    });

    it('throws if process fails to start', async () => {
      await expect(
        monitor.start('nonexistent-command-xyz', [])
      ).rejects.toThrow();
    });
  });

  describe('monitor', () => {
    it('returns process info by id', async () => {
      const started = await monitor.start('sleep', ['1'], 'sleepy');
      const info = await monitor.monitor('sleepy');

      expect(info).toBeDefined();
      expect(info?.pid).toBe(started.pid);
    });

    it('returns undefined for unknown process', async () => {
      const info = await monitor.monitor('unknown');
      expect(info).toBeUndefined();
    });

    it('detects when process exits', async () => {
      await monitor.start('echo', ['quick'], 'quick-process');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const info = await monitor.monitor('quick-process');
      expect(info?.status).toBe(ProcessStatus.EXITED);
    });
  });

  describe('kill', () => {
    it('kills a running process', async () => {
      await monitor.start('sleep', ['100'], 'long-sleep');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const killed = await monitor.kill('long-sleep');
      expect(killed).toBe(true);

      const info = await monitor.monitor('long-sleep');
      expect([ProcessStatus.KILLED, ProcessStatus.EXITED]).toContain(info?.status);
    });

    it('returns false for unknown process', async () => {
      const killed = await monitor.kill('unknown');
      expect(killed).toBe(false);
    });
  });

  describe('logs', () => {
    it('captures stdout', async () => {
      await monitor.start('echo', ['output'], 'logger');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await monitor.getLogs('logger');
      expect(logs.stdout).toContain('output');
    });

    it('captures stderr', async () => {
      const info = await monitor.start('node', ['-e', 'console.error("error output")'], 'stderr-test');

      // Wait for process to exit (check status)
      for (let i = 0; i < 20; i++) {
        const currentInfo = await monitor.monitor('stderr-test');
        if (currentInfo?.status === ProcessStatus.EXITED) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const logs = await monitor.getLogs('stderr-test');
      expect(logs.stderr).toContain('error output');
    });

    it('persists logs to file', async () => {
      await monitor.start('echo', ['persisted'], 'persist-test');

      await new Promise(resolve => setTimeout(resolve, 100));

      const logPath = `${testProcessDir}/persist-test.log`;
      const exists = await fs.pathExists(logPath);
      expect(exists).toBe(true);
    });
  });

  describe('list', () => {
    it('lists all tracked processes', async () => {
      await monitor.start('sleep', ['1'], 'p1');
      await monitor.start('sleep', ['1'], 'p2');

      const processes = await monitor.list();
      expect(processes).toHaveLength(2);
      expect(processes.map(p => p.id)).toContain('p1');
      expect(processes.map(p => p.id)).toContain('p2');
    });
  });

  describe('killAll', () => {
    it('kills all tracked processes', async () => {
      await monitor.start('sleep', ['10'], 'kill1');
      await monitor.start('sleep', ['10'], 'kill2');

      await monitor.killAll();

      const processes = await monitor.list();
      processes.forEach(p => {
        expect([ProcessStatus.KILLED, ProcessStatus.EXITED]).toContain(p.status);
      });
    });
  });
});