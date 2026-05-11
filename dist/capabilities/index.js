export * from './types';
export { FileReadCapability } from './FileRead';
export { FileWriteCapability } from './FileWrite';
export { FileEditCapability } from './FileEdit';
export { FileSearchCapability } from './FileSearch';
export { BashRunnerCapability } from './BashRunner';
export { BashMonitorCapability } from './BashMonitor';
export { GitOperationsCapability } from './GitOperations';
export { WebFetchCapability } from './WebFetch';
export { BuildRunnerCapability } from './BuildRunner';
export { TestRunnerCapability } from './TestRunner';
import { FileReadCapability } from './FileRead';
import { FileWriteCapability } from './FileWrite';
import { FileEditCapability } from './FileEdit';
import { FileSearchCapability } from './FileSearch';
import { BashRunnerCapability } from './BashRunner';
import { BashMonitorCapability } from './BashMonitor';
import { GitOperationsCapability } from './GitOperations';
import { WebFetchCapability } from './WebFetch';
import { BuildRunnerCapability } from './BuildRunner';
import { TestRunnerCapability } from './TestRunner';
export function createCapabilityRegistry() {
    return {
        file_read: new FileReadCapability(),
        file_write: new FileWriteCapability(),
        file_edit: new FileEditCapability(),
        file_search: new FileSearchCapability(),
        bash_run: new BashRunnerCapability(),
        bash_monitor: new BashMonitorCapability(),
        web_fetch: new WebFetchCapability(),
        build_run: new BuildRunnerCapability(),
        test_run: new TestRunnerCapability(),
    };
}
export function createGitCapability() {
    return new GitOperationsCapability();
}
export const ALL_CAPABILITIES = [
    { name: 'file_read', description: 'Read file content' },
    { name: 'file_write', description: 'Write file content' },
    { name: 'file_edit', description: 'Edit file by replacing text' },
    { name: 'file_search', description: 'Search for files and content' },
    { name: 'bash_run', description: 'Execute bash command' },
    { name: 'bash_monitor', description: 'Monitor bash command output' },
    { name: 'git_status', description: 'Get git repository status' },
    { name: 'git_commit', description: 'Commit changes to git' },
    { name: 'git_diff', description: 'Show git diff' },
    { name: 'git_history', description: 'Show git commit history' },
    { name: 'web_fetch', description: 'Fetch data from URL' },
    { name: 'build_run', description: 'Run build command' },
    { name: 'test_run', description: 'Run tests' },
];
//# sourceMappingURL=index.js.map