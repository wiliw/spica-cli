import { Capability, CapabilityResult, TestRunParams, TestRunResult } from './types';
export declare class TestRunnerCapability implements Capability<TestRunParams, TestRunResult> {
    name: string;
    description: string;
    execute(params: TestRunParams): Promise<CapabilityResult<TestRunResult>>;
    private parseTestOutput;
}
//# sourceMappingURL=TestRunner.d.ts.map