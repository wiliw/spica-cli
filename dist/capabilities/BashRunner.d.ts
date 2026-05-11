import { Capability, CapabilityResult, BashRunParams, BashRunResult } from './types';
export declare class BashRunnerCapability implements Capability<BashRunParams, BashRunResult> {
    name: string;
    description: string;
    execute(params: BashRunParams): Promise<CapabilityResult<BashRunResult>>;
}
//# sourceMappingURL=BashRunner.d.ts.map