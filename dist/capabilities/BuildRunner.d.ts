import { Capability, CapabilityResult, BuildRunParams, BuildRunResult } from './types';
export declare class BuildRunnerCapability implements Capability<BuildRunParams, BuildRunResult> {
    name: string;
    description: string;
    execute(params: BuildRunParams): Promise<CapabilityResult<BuildRunResult>>;
}
//# sourceMappingURL=BuildRunner.d.ts.map