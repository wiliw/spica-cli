import { execa } from 'execa';
export class BuildRunnerCapability {
    name = 'build_run';
    description = 'Execute build commands and monitor the build process';
    async execute(params) {
        const startTime = Date.now();
        const command = params.command || 'npm run build';
        try {
            const result = await execa(command, {
                shell: true,
                cwd: params.cwd,
                reject: false,
            });
            const duration = Date.now() - startTime;
            const success = result.exitCode === 0;
            return {
                success,
                data: {
                    success,
                    output: result.stdout + '\n' + result.stderr,
                    errors: success ? [] : [result.stderr],
                    duration,
                },
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            return {
                success: false,
                error: error.message,
                data: {
                    success: false,
                    output: error.message,
                    errors: [error.message],
                    duration,
                },
            };
        }
    }
}
//# sourceMappingURL=BuildRunner.js.map