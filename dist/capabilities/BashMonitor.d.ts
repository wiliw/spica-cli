import { Capability, CapabilityResult, BashMonitorParams, BashMonitorResult } from './types';
export declare class BashMonitorCapability implements Capability<BashMonitorParams, BashMonitorResult> {
    name: string;
    description: string;
    execute(params: BashMonitorParams): Promise<CapabilityResult<BashMonitorResult>>;
}
//# sourceMappingURL=BashMonitor.d.ts.map