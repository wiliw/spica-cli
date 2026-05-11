import { execa } from 'execa';
export class TestRunnerCapability {
    name = 'test_run';
    description = 'Execute test commands and parse test results';
    async execute(params) {
        const startTime = Date.now();
        let command = params.command || 'npm test';
        if (params.pattern) {
            command = `${command} ${params.pattern}`;
        }
        try {
            const result = await execa(command, {
                shell: true,
                cwd: params.cwd,
                reject: false,
            });
            const duration = Date.now() - startTime;
            const output = result.stdout + '\n' + result.stderr;
            const success = result.exitCode === 0;
            const testResults = this.parseTestOutput(output);
            return {
                success,
                data: {
                    success,
                    passed: testResults.passed,
                    failed: testResults.failed,
                    skipped: testResults.skipped,
                    output,
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
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    output: error.message,
                    duration,
                },
            };
        }
    }
    parseTestOutput(output) {
        const passed = (output.match(/(\d+)\s+passed/gi) || [])[1] || '0';
        const failed = (output.match(/(\d+)\s+failed/gi) || [])[1] || '0';
        const skipped = (output.match(/(\d+)\s+skipped/gi) || [])[1] || '0';
        const jestPassed = output.match(/Tests:\s+(\d+)\s+passed/);
        const jestFailed = output.match(/(\d+)\s+failed/);
        const jestSkipped = output.match(/(\d+)\s+skipped/);
        if (jestPassed) {
            return {
                passed: parseInt(jestPassed[1]) || 0,
                failed: jestFailed ? parseInt(jestFailed[1]) : 0,
                skipped: jestSkipped ? parseInt(jestSkipped[1]) : 0,
            };
        }
        return {
            passed: parseInt(passed) || 0,
            failed: parseInt(failed) || 0,
            skipped: parseInt(skipped) || 0,
        };
    }
}
//# sourceMappingURL=TestRunner.js.map