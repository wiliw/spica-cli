import { Capability, CapabilityResult, FileWriteParams, FileWriteResult } from './types';
export declare class FileWriteCapability implements Capability<FileWriteParams, FileWriteResult> {
    name: string;
    description: string;
    execute(params: FileWriteParams): Promise<CapabilityResult<FileWriteResult>>;
}
//# sourceMappingURL=FileWrite.d.ts.map