import { CapabilityResult, GitStatusParams, GitStatusResult, GitCommitParams, GitCommitResult, GitDiffParams, GitDiffResult, GitHistoryParams, GitHistoryResult } from './types';
export declare class GitOperationsCapability {
    private git;
    constructor(cwd?: string);
    status(params: GitStatusParams): Promise<CapabilityResult<GitStatusResult>>;
    commit(params: GitCommitParams): Promise<CapabilityResult<GitCommitResult>>;
    diff(params: GitDiffParams): Promise<CapabilityResult<GitDiffResult>>;
    history(params: GitHistoryParams): Promise<CapabilityResult<GitHistoryResult>>;
}
//# sourceMappingURL=GitOperations.d.ts.map