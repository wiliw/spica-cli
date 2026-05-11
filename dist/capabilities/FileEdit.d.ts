import { Capability, CapabilityResult, FileEditParams, FileEditResult } from './types';
export declare class FileEditCapability implements Capability<FileEditParams, FileEditResult> {
    name: string;
    description: string;
    execute(params: FileEditParams): Promise<CapabilityResult<FileEditResult>>;
}
//# sourceMappingURL=FileEdit.d.ts.map