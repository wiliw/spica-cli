import { Capability, CapabilityResult, FileSearchParams, FileSearchResult } from './types';
export declare class FileSearchCapability implements Capability<FileSearchParams, FileSearchResult> {
    name: string;
    description: string;
    execute(params: FileSearchParams): Promise<CapabilityResult<FileSearchResult>>;
}
//# sourceMappingURL=FileSearch.d.ts.map