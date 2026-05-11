export interface CapabilityResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: Record<string, any>;
}
export interface Capability<TParams = any, TResult = any> {
    name: string;
    description: string;
    execute(params: TParams): Promise<CapabilityResult<TResult>>;
}
export interface FileReadParams {
    path: string;
    encoding?: BufferEncoding;
}
export interface FileReadResult {
    content: string;
    size: number;
    path: string;
}
export interface FileWriteParams {
    path: string;
    content: string;
    encoding?: BufferEncoding;
}
export interface FileWriteResult {
    path: string;
    bytesWritten: number;
}
export interface FileEditParams {
    path: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
}
export interface FileEditResult {
    path: string;
    replacements: number;
}
export interface FileSearchParams {
    pattern: string;
    path: string;
    include?: string;
    exclude?: string;
}
export interface FileSearchResult {
    matches: Array<{
        file: string;
        line: number;
        content: string;
    }>;
    totalMatches: number;
}
export interface BashRunParams {
    command: string;
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
}
export interface BashRunResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
    duration: number;
}
export interface BashMonitorParams {
    command: string;
    cwd?: string;
    onOutput?: (data: string) => void;
    onError?: (data: string) => void;
}
export interface BashMonitorResult {
    processId: number;
    stdout: string[];
    stderr: string[];
    running: boolean;
}
export interface GitStatusParams {
    cwd?: string;
}
export interface GitStatusResult {
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
    branch: string;
    ahead: number;
    behind: number;
}
export interface GitCommitParams {
    message: string;
    files?: string[];
    cwd?: string;
}
export interface GitCommitResult {
    commitHash: string;
    message: string;
    files: string[];
}
export interface GitDiffParams {
    cwd?: string;
    staged?: boolean;
    file?: string;
}
export interface GitDiffResult {
    diff: string;
    files: string[];
}
export interface GitHistoryParams {
    cwd?: string;
    maxCount?: number;
    file?: string;
}
export interface GitHistoryResult {
    commits: Array<{
        hash: string;
        author: string;
        date: string;
        message: string;
    }>;
}
export interface WebFetchParams {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
}
export interface WebFetchResult {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    url: string;
}
export interface BuildRunParams {
    command?: string;
    cwd?: string;
    watch?: boolean;
}
export interface BuildRunResult {
    success: boolean;
    output: string;
    errors: string[];
    duration: number;
}
export interface TestRunParams {
    command?: string;
    cwd?: string;
    pattern?: string;
    watch?: boolean;
}
export interface TestRunResult {
    success: boolean;
    passed: number;
    failed: number;
    skipped: number;
    output: string;
    duration: number;
}
//# sourceMappingURL=types.d.ts.map