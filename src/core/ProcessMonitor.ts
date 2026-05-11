import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

export enum ProcessStatus {
  RUNNING = 'running',
  EXITED = 'exited',
  KILLED = 'killed',
  FAILED = 'failed',
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

export class ProcessMonitor {
  private processDir: string;
  private processes: Map<string, { info: ProcessInfo; process?: ChildProcess }> = new Map();
  private logs: Map<string, ProcessLogs> = new Map();

  constructor(processDir: string) {
    this.processDir = processDir;
  }

  async start(
    command: string,
    args: string[],
    id?: string
  ): Promise<ProcessInfo> {
    const processId = id || randomUUID();

    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const info: ProcessInfo = {
        id: processId,
        pid: childProcess.pid,
        command,
        args,
        status: ProcessStatus.RUNNING,
        startTime: new Date(),
      };

      this.processes.set(processId, { info, process: childProcess });
      this.logs.set(processId, { stdout: '', stderr: '' });

      const logHandler = (stream: 'stdout' | 'stderr') => (data: Buffer) => {
        const logs = this.logs.get(processId);
        if (logs) {
          logs[stream] += data.toString();
        }
      };

      childProcess.stdout?.on('data', logHandler('stdout'));
      childProcess.stderr?.on('data', logHandler('stderr'));

      childProcess.on('error', (err) => {
        const stored = this.processes.get(processId);
        if (stored) {
          stored.info.status = ProcessStatus.FAILED;
          stored.info.endTime = new Date();
        }
        this.persistLogs(processId);
        reject(err);
      });

      childProcess.on('spawn', () => {
        info.pid = childProcess.pid;
        resolve(info);
      });

      childProcess.on('close', (code) => {
        const stored = this.processes.get(processId);
        if (stored) {
          stored.info.status = ProcessStatus.EXITED;
          stored.info.endTime = new Date();
          stored.info.exitCode = code ?? 0;
        }
        this.persistLogs(processId);
      });
    });
  }

  async monitor(id: string): Promise<ProcessInfo | undefined> {
    const stored = this.processes.get(id);
    return stored?.info;
  }

  async kill(id: string): Promise<boolean> {
    const stored = this.processes.get(id);
    if (!stored?.process) return false;

    return new Promise((resolve) => {
      const process = stored.process!;
      
      process.on('close', () => {
        resolve(true);
      });

      stored.info.status = ProcessStatus.KILLED;
      stored.info.endTime = new Date();
      process.kill('SIGTERM');

      setTimeout(() => {
        if (stored.info.status === ProcessStatus.KILLED) {
          process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  async getLogs(id: string): Promise<ProcessLogs> {
    return this.logs.get(id) || { stdout: '', stderr: '' };
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this.processes.values()).map(p => p.info);
  }

  async killAll(): Promise<void> {
    const killPromises: Promise<boolean>[] = [];

    for (const [id, stored] of this.processes) {
      if (stored.info.status === ProcessStatus.RUNNING && stored.process) {
        killPromises.push(this.kill(id));
      }
    }

    await Promise.all(killPromises);
  }

  private async persistLogs(id: string): Promise<void> {
    const logs = this.logs.get(id);
    if (!logs) return;
    
    try {
      await fs.ensureDir(this.processDir);
      const logPath = path.join(this.processDir, `${id}.log`);
      const content = `STDOUT:\n${logs.stdout}\n\nSTDERR:\n${logs.stderr}`;
      await fs.writeFile(logPath, content);
    } catch {
      // ignore persistence errors
    }
  }
}