import { execa } from 'execa';
export class BashRunnerCapability {
    name = 'bash_run';
    description = 'Execute a bash command and return the result';
    async execute(params) {
        const startTime = Date.now();
        try {
            const result = await execa(params.command, {
                shell: true,
                cwd: params.cwd,
                timeout: params.timeout,
                env: { ...process.env, ...params.env },
                reject: false,
            });
            const duration = Date.now() - startTime;
            return {
                success: result.exitCode === 0,
                data: {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode ?? 1,
                    command: params.command,
                    duration,
                },
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            return {
                success: false,
                error: error.message,
                metadata: {
                    duration,
                    command: params.command,
                },
            };
        }
    }
}
//# sourceMappingURL=BashRunner.js.map