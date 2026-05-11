import { spawn } from 'child_process';
export class BashMonitorCapability {
    name = 'bash_monitor';
    description = 'Execute a bash command and monitor its output in real-time';
    async execute(params) {
        return new Promise((resolve) => {
            const stdout = [];
            const stderr = [];
            let processId = 0;
            const child = spawn(params.command, [], {
                shell: true,
                cwd: params.cwd,
                detached: false,
            });
            processId = child.pid ?? 0;
            child.stdout.on('data', (data) => {
                const output = data.toString();
                stdout.push(output);
                if (params.onOutput) {
                    params.onOutput(output);
                }
            });
            child.stderr.on('data', (data) => {
                const output = data.toString();
                stderr.push(output);
                if (params.onError) {
                    params.onError(output);
                }
            });
            child.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    data: {
                        processId,
                        stdout,
                        stderr,
                        running: false,
                    },
                });
            });
            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    data: {
                        processId,
                        stdout,
                        stderr,
                        running: false,
                    },
                });
            });
            setTimeout(() => {
                resolve({
                    success: true,
                    data: {
                        processId,
                        stdout,
                        stderr,
                        running: child.exitCode === null,
                    },
                });
            }, 100);
        });
    }
}
//# sourceMappingURL=BashMonitor.js.map