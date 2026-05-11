import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
export var ProcessStatus;
(function (ProcessStatus) {
    ProcessStatus["RUNNING"] = "running";
    ProcessStatus["EXITED"] = "exited";
    ProcessStatus["KILLED"] = "killed";
    ProcessStatus["FAILED"] = "failed";
})(ProcessStatus || (ProcessStatus = {}));
export class ProcessMonitor {
    processDir;
    processes = new Map();
    logs = new Map();
    constructor(processDir) {
        this.processDir = processDir;
    }
    async start(command, args, id) {
        const processId = id || randomUUID();
        return new Promise((resolve, reject) => {
            const childProcess = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            const info = {
                id: processId,
                pid: childProcess.pid,
                command,
                args,
                status: ProcessStatus.RUNNING,
                startTime: new Date(),
            };
            this.processes.set(processId, { info, process: childProcess });
            this.logs.set(processId, { stdout: '', stderr: '' });
            const logHandler = (stream) => (data) => {
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
    async monitor(id) {
        const stored = this.processes.get(id);
        return stored?.info;
    }
    async kill(id) {
        const stored = this.processes.get(id);
        if (!stored?.process)
            return false;
        return new Promise((resolve) => {
            const process = stored.process;
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
    async getLogs(id) {
        return this.logs.get(id) || { stdout: '', stderr: '' };
    }
    async list() {
        return Array.from(this.processes.values()).map(p => p.info);
    }
    async killAll() {
        const killPromises = [];
        for (const [id, stored] of this.processes) {
            if (stored.info.status === ProcessStatus.RUNNING && stored.process) {
                killPromises.push(this.kill(id));
            }
        }
        await Promise.all(killPromises);
    }
    async persistLogs(id) {
        const logs = this.logs.get(id);
        if (!logs)
            return;
        try {
            await fs.ensureDir(this.processDir);
            const logPath = path.join(this.processDir, `${id}.log`);
            const content = `STDOUT:\n${logs.stdout}\n\nSTDERR:\n${logs.stderr}`;
            await fs.writeFile(logPath, content);
        }
        catch {
            // ignore persistence errors
        }
    }
}
//# sourceMappingURL=ProcessMonitor.js.map