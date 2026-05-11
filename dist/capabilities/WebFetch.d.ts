import { Capability, CapabilityResult, WebFetchParams, WebFetchResult } from './types';
export declare class WebFetchCapability implements Capability<WebFetchParams, WebFetchResult> {
    name: string;
    description: string;
    execute(params: WebFetchParams): Promise<CapabilityResult<WebFetchResult>>;
}
//# sourceMappingURL=WebFetch.d.ts.map