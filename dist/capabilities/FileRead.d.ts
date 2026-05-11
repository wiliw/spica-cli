import { Capability, CapabilityResult, FileReadParams, FileReadResult } from './types';
export declare class FileReadCapability implements Capability<FileReadParams, FileReadResult> {
    name: string;
    description: string;
    execute(params: FileReadParams): Promise<CapabilityResult<FileReadResult>>;
}
//# sourceMappingURL=FileRead.d.ts.map